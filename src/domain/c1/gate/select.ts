import type { C1Item, C1Kind } from '../../c1x/types';
import { hash32, mulberry32, shuffle } from '../../random';
import type { ProgramChapter } from '../programTypes';
import { GATE } from './trigger';

// Kapitelprüfung, Auswahl der Grammatikaufgaben (Lernplattform 3.0 §4.4, P42/P43). Der Vorrat (`pool: 'gate'`, 8 Aufgaben je Thema) liegt im eigenen
// Bündel `c1x-gate` und erscheint in keiner Übungsrunde. Jeder Versuch zieht 2 Aufgaben je Thema; die nächste Zuordnung ist von der Zahl der bisherigen
// Versuche abhängig (nicht von gespeicherten Kennungen, das Dokument bleibt klein): Versuch 1 nimmt die Plätze 0 und 1 der nach Kennung geordneten Aufgaben
// des Themas, Versuch 2 die Plätze 2 und 3, usw.; nach vier Versuchen beginnt es von vorn. Der Vorrat ist so geordnet, dass jedes Paar zwei Arten mischt.

/** Arten, die in der Kapitelprüfung vorkommen: nur freie Aufgaben (Lücke tippen, Umformen, Fehler finden). */
export const GATE_KINDS: readonly C1Kind[] = ['ocl', 'kwt', 'err'];

export const isGateItem = (it: C1Item): boolean => it.pool === 'gate' && GATE_KINDS.includes(it.kind) && it.area === 'gram' && !!it.topic;

/** Aufgaben eines Themas im Vorrat, nach Kennung geordnet. */
export function gatePoolOf(items: readonly C1Item[], topic: string): C1Item[] {
  return items.filter((it) => isGateItem(it) && it.topic === topic).sort((a, b) => a.id.localeCompare(b.id));
}

/** Die zwei Aufgaben eines Themas für den Versuch `attempt` (0-basiert). Weniger als zwei im Vorrat: so viele wie da sind. */
export function gatePair(items: readonly C1Item[], topic: string, attempt: number): C1Item[] {
  const pool = gatePoolOf(items, topic);
  if (pool.length <= GATE.perTopic) return pool;
  const start = (attempt * GATE.perTopic) % pool.length;
  return Array.from({ length: GATE.perTopic }, (_, k) => pool[(start + k) % pool.length] as C1Item);
}

/** Das Thema ohne Nachbarn gleichen Themas, wo es geht (gemischt, mit festem Startwert). */
function spread(items: readonly C1Item[], seed: string): C1Item[] {
  const rng = mulberry32(hash32(seed));
  const pool = shuffle(items, rng);
  const out: C1Item[] = [];
  while (pool.length) {
    const last = out.at(-1)?.topic;
    const i = pool.findIndex((x) => x.topic !== last);
    out.push(pool.splice(i < 0 ? 0 : i, 1)[0] as C1Item);
  }
  return out;
}

/** Alle Grammatikaufgaben einer Prüfung: 2 je vorhandenes Thema des Kapitels, gemischt. `attempt` = Zahl der bisherigen Versuche des Kapitels. */
export function gateRound(items: readonly C1Item[], chapter: Pick<ProgramChapter, 'id' | 'topics'>, attempt: number, liveTopics: readonly string[]): C1Item[] {
  const live = new Set(liveTopics);
  const picked = chapter.topics.filter((t) => live.has(t)).flatMap((t) => gatePair(items, t, attempt));
  return spread(picked, `${chapter.id}:${attempt}`);
}

/**
 * Der fertig ausgeschriebene richtige Satz einer Aufgabe, als Beleg („drei eigene richtige Sätze“). `null`, wenn sich keiner bilden lässt.
 * ocl: Lücke mit der ersten Lösung · kwt: Satz B mit der ersten ganzen Lösung · err: der Satz mit der Korrektur (fehlerfrei: unverändert).
 */
export function correctSentence(it: C1Item): string | null {
  const tidy = (s: string): string => s.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  if (it.kind === 'ocl') {
    const w = it.accept[0];
    return w ? tidy(it.text.replace(/_{2,}/, w)) : null;
  }
  if (it.kind === 'kwt') {
    const k = it.keys[0];
    if (!k) return null;
    // Das Schlüsselwort steht schon in Teil A oder B (`solutionsOf`: Antwort = `${a} ${b}`).
    return tidy(`${it.before} ${k.a[0] ?? ''} ${k.b[0] ?? ''} ${it.after}`);
  }
  if (it.kind === 'err') {
    if (!it.bad) return tidy(it.text);
    const fix = it.bad.fix[0];
    if (fix === undefined) return null;
    const at = it.text.indexOf(it.bad.span);
    if (at < 0) return null;
    return tidy(it.text.slice(0, at) + fix + it.text.slice(at + it.bad.span.length));
  }
  return null;
}
