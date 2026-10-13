import { TOPIC_KEYS } from '../schemas';
import type { TopicKey } from '../schemas';
import { CUSTOM_TOPICS_MAX } from './docs';
import type { Prefs } from './docs';

// Themenwahl (docs/umbau/lesen-plan.md §3.3), rein und mit festem `rand` deterministisch:
// gewichtete Auswahl der aktiven Chips; die letzten 2 Themen werden abgewertet (nie dreimal dasselbe hintereinander);
// Neuheits-Bias: je länger ein Thema pausiert, desto eher; eigene Themen (≤ 5) zählen wie Chips mit Gewicht 2.

export const CUSTOM_TOPIC_MAX_CHARS = 60;
const CUSTOM_WEIGHT = 2;
/** Abwertung der zuletzt benutzten Themen (neuestes, zweitneuestes). */
const RECENT_FACTOR = [0.15, 0.4] as const;
/** Ab so vielen Lesetagen Pause gilt ein Thema als „lange nicht“ (Deckel des Bonus). */
const PAUSE_CAP = 12;

export type TopicChoice = { topic: TopicKey; custom?: string; id: string };
export type TopicHistoryItem = { topic: string; custom?: string | null };

/** Eindeutige Kennung eines Themas im Verlauf: Chip-Schlüssel, bei eigenen Themen mit Text. */
export const topicId = (topic: string, custom?: string | null): string => (topic === 'custom' && custom ? `custom:${custom.trim().toLowerCase()}` : topic);

/** Eigenes Thema säubern: ein Zeilenstück, ≤ 60 Zeichen; leer oder nur Steuerzeichen → null. Der Text kommt später als Daten in den Prompt. */
export function sanitizeCustomTopic(input: string): string | null {
  // eslint-disable-next-line no-control-regex -- Steuerzeichen werden bewusst zu Leerraum
  const flat = input.replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  const chars = Array.from(flat);
  return chars.length <= CUSTOM_TOPIC_MAX_CHARS ? flat : chars.slice(0, CUSTOM_TOPIC_MAX_CHARS).join('').trimEnd();
}

type Candidate = { id: string; topic: TopicKey; custom?: string; weight: number };

/** Kandidaten und Grundgewichte aus den Einstellungen. Ohne aktiven Chip gelten alle sieben festen Themen mit Gewicht 1. */
export function candidates(prefs: Pick<Prefs, 'topics' | 'custom'>): Candidate[] {
  const out: Candidate[] = [];
  for (const k of TOPIC_KEYS) {
    if (k === 'custom') continue;
    const w = prefs.topics[k];
    if (typeof w === 'number' && w > 0) out.push({ id: k, topic: k, weight: w });
  }
  const seen = new Set<string>();
  for (const raw of prefs.custom) {
    if (seen.size >= CUSTOM_TOPICS_MAX) break;
    const text = sanitizeCustomTopic(raw);
    if (!text) continue;
    const id = topicId('custom', text);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, topic: 'custom', custom: text, weight: CUSTOM_WEIGHT });
  }
  if (out.length > 0) return out;
  return TOPIC_KEYS.filter((k) => k !== 'custom').map((k) => ({ id: k, topic: k, weight: 1 }));
}

/**
 * Nächstes Thema. `history` = bisherige Artikel, NEUESTE ZUERST. `rand` liefert Zahlen in [0, 1).
 * Regeln: dasselbe Thema nie dreimal hintereinander (solange es eine Alternative gibt); die letzten zwei Themen werden abgewertet;
 * je länger die Pause, desto größer das Gewicht (bis `PAUSE_CAP`).
 */
export function pickTopic(prefs: Pick<Prefs, 'topics' | 'custom'>, history: readonly TopicHistoryItem[], rand: () => number): TopicChoice {
  let pool = candidates(prefs);
  const ids = history.map((h) => topicId(h.topic, h.custom));
  if (ids.length >= 2 && ids[0] === ids[1] && pool.length > 1) {
    const rest = pool.filter((c) => c.id !== ids[0]);
    if (rest.length > 0) pool = rest;
  }
  const weights = pool.map((c) => {
    const at = ids.indexOf(c.id);
    const pause = at === -1 ? PAUSE_CAP : Math.min(at, PAUSE_CAP);
    let w = c.weight * (1 + pause / PAUSE_CAP);
    if (at === 0) w *= RECENT_FACTOR[0];
    else if (at === 1) w *= RECENT_FACTOR[1];
    return Math.max(w, 0.0001);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const r = Math.min(Math.max(rand(), 0), 0.999999999) * sum;
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i] ?? 0;
    if (r < acc) return choice(pool[i]!);
  }
  return choice(pool[pool.length - 1]!);
}

function choice(c: Candidate): TopicChoice {
  return c.custom ? { topic: c.topic, custom: c.custom, id: c.id } : { topic: c.topic, id: c.id };
}
