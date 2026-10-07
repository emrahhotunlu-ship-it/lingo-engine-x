import { editDistance } from '../../answer/diff';
import { typoBudget } from '../../answer/check';
import type { C1Response, C1Score, Ocl } from '../types';
import { BRITISH, cmp, usHint, wordCount, type Problems } from './common';

/**
 * `ocl`: ein Wort tippen (`accept`), 1 Punkt, getippt = frei. Tippfehler im Budget (0 bis 4 Buchstaben, 1 bei 5–8, 2 ab 9) ist „Fast“
 * (`near`, Note 2): Cambridge wertet falsch geschriebene Wörter nicht, die App zählt sie nicht als ganz falsch.
 */
export function scoreOcl(item: Ocl, r: Extract<C1Response, { kind: 'ocl' }>): C1Score {
  const g = cmp(r.text);
  const targets = item.accept.map(cmp);
  if (g && targets.includes(g)) {
    const us = usHint(r.text, item.accept);
    return { got: 1, max: 1, parts: [{ id: 'a', ok: true }], verdict: 'correct', free: true, ...(us ? { us } : {}) };
  }
  const typo = g.length > 0 && targets.some((t) => t.length > 4 && editDistance(g, t) <= typoBudget(t.length));
  return { got: 0, max: 1, parts: [{ id: 'a', ok: false }], verdict: typo ? 'near' : 'wrong', free: true, ...(typo ? { reason: 'typo' as const } : {}) };
}

export function checkOcl(item: Ocl): Problems {
  const out: Problems = [];
  const n = wordCount(item.text);
  if (n < 8 || n > 30) out.push(`Satz hat ${n} Wörter (8–30)`);
  const acc = new Set(item.accept.map((a) => a.toLowerCase()));
  for (const c of item.chips) if (acc.has(c.toLowerCase())) out.push(`Chip „${c}“ ist eine Lösung`);
  if (new Set(item.chips.map((c) => c.toLowerCase())).size !== 3) out.push('Chips nicht alle verschieden');
  if (BRITISH.test(item.text)) out.push('britische Schreibweise');
  return out;
}
