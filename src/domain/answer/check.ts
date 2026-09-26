import type { CheckResult } from '../srs/types';
import { editDistance, markDiff } from './diff';
import { normalize, withoutTo } from './normalize';
import { toUS } from './spelling';
import { lemmaCandidates } from '../text/lemma';

// Prüfung getippter Antworten (Lern-Entwurf §2.2). Reihenfolge, die erste passende Regel gilt:
// gleich → britische Variante (richtig) → andere Form desselben Worts (fast richtig) →
// ein anderes Wort aus deinem Wortschatz (falsch) → Tippfehler (fast richtig) → falsch.

/** Erlaubte Tippfehler: 0 bei ≤ 4 Zeichen, 1 bei 5–8, 2 ab 9. */
export const typoBudget = (len: number): number => (len <= 4 ? 0 : len <= 8 ? 1 : 2);

export type CheckDeps = {
  /** Grundform des gesuchten Worts (für „andere Form"). */
  lemma: string;
  /** Wörter anderer Karten (normalisiert) – ein Treffer dort ist eine Verwechslung, kein Tippfehler. */
  knownWords?: ReadonlySet<string>;
};

export function checkTyped(givenRaw: string, accepted: readonly string[], deps: CheckDeps): CheckResult {
  const given = normalize(givenRaw);
  const targets = [...new Set(accepted.map(normalize).flatMap((a) => [a, withoutTo(a)]))].filter(Boolean);
  if (!given) return { verdict: 'wrong' };
  const g = withoutTo(given);
  if (targets.includes(given) || targets.includes(g)) return { verdict: 'correct' };

  const us = toUS(g);
  if (targets.some((t) => toUS(t) === us)) return us !== g ? { verdict: 'correct', variant: 'uk', us } : { verdict: 'correct' };

  const lemma = withoutTo(normalize(deps.lemma));
  // Dasselbe Wort in einer anderen Form (persuade statt persuaded, went statt gone).
  if (lemma && (g === lemma || (!g.includes(' ') && lemmaCandidates(g).includes(lemma)))) return { verdict: 'near', kind: 'form' };

  if (deps.knownWords?.has(g) && !targets.includes(g)) return { verdict: 'wrong', kind: 'confusable', otherWord: g };

  const best = targets.map((t) => ({ t, d: editDistance(g, t) })).sort((a, b) => a.d - b.d)[0];
  if (best && best.d > 0 && best.d <= typoBudget(best.t.length)) return { verdict: 'near', kind: 'typo', marks: markDiff(g, best.t) };
  return { verdict: 'wrong', marks: best ? markDiff(g, best.t) : [] };
}
