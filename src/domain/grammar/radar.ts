import { asText } from '../text/str';
import type { RadarEvent } from '../learn/types';

// Fehler-Radar `app/radar.events` in der Form der alten App `{c, s, t, q≤160, g≤100, a≤100}`
// (phase2-plan §4.6). Höchstens 400 Einträge und 240 KiB; doppelte (t|c|q) nur einmal.

export const RADAR_MAX = 400;
export const RADAR_MAX_BYTES = 240 * 1024;

/** Kategorien der alten App (models.js ERR_CATS). */
export const CAT_IDS = ['tense', 'cond', 'verbform', 'pattern', 'modals', 'passive', 'reported', 'relative', 'articles', 'prep', 'order', 'wordchoice', 'register', 'spelling'] as const;
export type RadarCat = (typeof CAT_IDS)[number];

const TOPIC_CAT: Record<string, RadarCat> = {
  conditionals: 'cond',
  'mixed-cond': 'cond',
  'gerund-inf': 'pattern',
  'used-to': 'pattern',
  'modals-deduction': 'modals',
  passive: 'passive',
  reported: 'reported',
  relative: 'relative',
  articles: 'articles',
  prepositions: 'prep',
  // C1-Werkzeugkasten (Lernberatung 27.09., Vorschlag 7): Ton, Satzbau, Wortwahl – keine Zeiten.
  'c1-hedging': 'register',
  'c1-diplomacy': 'register',
  'c1-emphasis': 'order',
  'c1-discourse': 'wordchoice',
  'c1-nominal': 'register',
  'c1-participle': 'verbform',
  'c1-precision': 'wordchoice',
};

/** Kategorie eines Grammatikthemas (alle Zeiten → tense). */
export const topicCat = (topic: string): RadarCat => TOPIC_CAT[topic] ?? 'tense';

/** Unbekannte Kategorien (z. B. aus der KI) → wordchoice, wie in der alten App. */
export function normCat(c: unknown): RadarCat {
  const v = asText(c)
    .toLowerCase()
    .trim();
  return (CAT_IDS as readonly string[]).includes(v) ? (v as RadarCat) : 'wordchoice';
}

export function radarEvent(c: unknown, s: RadarEvent['s'], t: number, ex: { q?: string; g?: string; a?: string }): RadarEvent {
  return { c: normCat(c), s, t, q: String(ex.q ?? '').slice(0, 160), g: String(ex.g ?? '').slice(0, 100), a: String(ex.a ?? '').slice(0, 100) };
}

const keyOf = (e: unknown): string => {
  const r = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
  return `${String(r.t)}|${String(r.c)}|${String(r.q)}`;
};
const tOf = (e: unknown): number => {
  const t = e && typeof e === 'object' ? (e as Record<string, unknown>).t : undefined;
  return typeof t === 'number' && Number.isFinite(t) ? t : 0;
};

/** Neue Liste aus frischem Stand und neuen Ereignissen: ohne Doppelte, nach Zeit, gekappt. */
export function mergeRadar(current: readonly unknown[], added: readonly RadarEvent[]): unknown[] {
  const seen = new Set<string>();
  const all: unknown[] = [];
  for (const e of [...current, ...added]) {
    const k = keyOf(e);
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(e);
  }
  const sorted = all
    .map((e, i) => ({ e, i }))
    .sort((a, b) => tOf(a.e) - tOf(b.e) || a.i - b.i)
    .map((x) => x.e);
  let out = sorted.slice(-RADAR_MAX);
  while (out.length > 1 && new TextEncoder().encode(JSON.stringify(out)).length > RADAR_MAX_BYTES) out = out.slice(1);
  return out;
}
