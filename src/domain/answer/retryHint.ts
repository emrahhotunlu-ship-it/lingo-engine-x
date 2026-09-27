import type { CheckResult } from '../srs/types';
import { editDistance } from './diff';
import { normalize, withoutTo } from './normalize';
import { lemmaCandidates } from '../text/lemma';

// „Erst ein Hinweis, dann die Lösung" (docs/lernberatung.md, Vorschlag 4): Ist eine getippte
// Antwort falsch, bekommt Emrah zuerst einen gezielten Hinweis und einen zweiten Versuch.
// Lokal, ohne KI. „Fast richtig" (Tippfehler im Budget, andere Form) bleibt wie bisher: dafür
// gibt es keinen Hinweis, sondern gleich das Ergebnis.

export type RetryHint =
  /** Nah dran: Abstand ≤ 2 zur Lösung (aber außerhalb des Tippfehler-Budgets). */
  | { kind: 'spelling' }
  /** Dasselbe Wort (bzw. dieselben Wörter) in einer anderen Form. */
  | { kind: 'form' }
  /** Ein anderes Wort: Anfang der Lösung und Länge (Buchstaben bzw. Wörter bei Wendungen). */
  | { kind: 'start'; start: string; letters: number; words: number };

const LETTER = /[\p{L}\p{N}]/u;
const words = (s: string): string[] => s.split(' ').filter(Boolean);

/** Gleiche Wortzahl, und jedes abweichende Wort teilt eine Grundform mit dem gesuchten. */
function sameWordsOtherForm(g: string, t: string): boolean {
  const gw = words(g);
  const tw = words(t);
  if (!gw.length || gw.length !== tw.length) return false;
  let diff = 0;
  for (let k = 0; k < gw.length; k++) {
    const a = gw[k] as string;
    const b = tw[k] as string;
    if (a === b) continue;
    diff++;
    const la = lemmaCandidates(a);
    if (!lemmaCandidates(b).some((x) => la.includes(x))) return false;
  }
  return diff > 0;
}

/** Anfang der Lösung: 1 Buchstabe bei ≤ 4 Buchstaben, sonst 2 (nur Buchstaben des ersten Worts). */
export function startOf(solution: string): string {
  const first = solution.trim().replace(/^to\s+/i, '').split(/\s+/)[0] ?? '';
  const letters = Array.from(first).filter((c) => LETTER.test(c));
  const n = letters.length <= 4 ? 1 : 2;
  return letters.slice(0, n).join('');
}

/**
 * Hinweis für den zweiten Versuch – oder `null`, wenn es keinen gibt (richtig oder „fast richtig":
 * dann gilt das Ergebnis sofort). `solution` ist die angezeigte Lösung (erste akzeptierte Form).
 */
export function retryHint(givenRaw: string, accepted: readonly string[], lemma: string, result: Pick<CheckResult, 'verdict'>): RetryHint | null {
  if (result.verdict !== 'wrong') return null;
  const solution = (accepted[0] ?? '').trim();
  if (!solution) return null;
  const g = withoutTo(normalize(givenRaw));
  const targets = [...new Set(accepted.map((a) => withoutTo(normalize(a))))].filter(Boolean);
  if (g) {
    const lem = withoutTo(normalize(lemma));
    if (targets.some((t) => sameWordsOtherForm(g, t)) || (lem && sameWordsOtherForm(g, lem))) return { kind: 'form' };
    // Abstand ≤ 2, aber nie bei sehr kurzen Wörtern, wo zwei Zeichen schon das halbe Wort sind.
    if (targets.some((t) => t.length >= 4 && editDistance(g, t) <= 2)) return { kind: 'spelling' };
  }
  const bare = solution.replace(/^to\s+/i, '');
  // „to" bleibt im Anfang stehen, damit er zu den Platzhaltern der Lücke passt („to pe…").
  const to = bare !== solution ? 'to ' : '';
  return {
    kind: 'start',
    start: to + startOf(bare),
    letters: Array.from(bare).filter((c) => LETTER.test(c)).length,
    words: words(normalize(bare)).length,
  };
}
