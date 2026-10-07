import { patternById } from '../../domain/grammar/patterns';
import { patsOf, patternState, patternStateNo } from '../../domain/metrics/pattern';
import type { PatState } from '../../domain/plan/types';

// Abschlusskarte Heute (Lernplattform 2.0 §5.10): Die Wahrheitszeile vergleicht die Musterzustände vom Morgen (`u.ps`, eingefroren) mit
// denen von jetzt (`patternState`). Genannt wird nur ein Zustandswechsel, der wirklich stattfand: von Neu/Lernt auf Sicher oder Fest.

type Doc = Readonly<Record<string, unknown>>;

/** Namen der Muster, die seit dem Morgen „Sicher“ (oder „Fest“) geworden sind; höchstens `max`. */
export function patternGains(i: { ps: Readonly<Record<string, PatState>> | undefined; grammarDocs: ReadonlyMap<string, Doc>; today: string; lang: 'de' | 'en'; max?: number }): { count: number; names: string[] } {
  const names: string[] = [];
  let count = 0;
  for (const [id, before] of Object.entries(i.ps ?? {})) {
    if (before >= 2) continue;
    const pat = patternById(id);
    if (!pat) continue;
    const now = patternStateNo(patternState(patsOf(i.grammarDocs.get(pat.topic))[pat.id], i.today));
    if (now < 2) continue;
    count += 1;
    if (names.length < (i.max ?? 3)) names.push(pat.name[i.lang]);
  }
  return { count, names };
}

/** Die eine große Zahl der Abschlusskarte: tatsächlich Gefestigtes (Wörter, sonst Muster), nie eine Antwortzahl. `null`, wenn nichts Neues sicher wurde. */
export function bigGain(i: { wordsSure: number | null; patterns: number }): { kind: 'words' | 'patterns'; n: number } | null {
  if (i.wordsSure !== null && i.wordsSure > 0) return { kind: 'words', n: i.wordsSure };
  if (i.patterns > 0) return { kind: 'patterns', n: i.patterns };
  return null;
}
