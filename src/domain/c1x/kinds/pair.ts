import { cmp, BRITISH, wordCount, type Problems } from './common';
import type { C1Response, C1Score, Pair } from '../types';

// `pair`: zwei Sätze mit je der richtigen Bedeutung verbinden (1 Punkt je Verbindung). Am Laptop dazu die Transfer-Lücke (1 Punkt).
// Auswahl ist ratbar (Rate-Wahrscheinlichkeit für beide Verbindungen 1/6, BKT-`nOptions` 6, P13) und nie freier Abruf.

export function scorePair(item: Pair, r: Extract<C1Response, { kind: 'pair' }>): C1Score {
  const linkA = r.links[0] === 0;
  const linkB = r.links[1] === 1;
  const parts: C1Score['parts'] = [{ id: 'link0', ok: linkA }, { id: 'link1', ok: linkB }];
  let got = (linkA ? 1 : 0) + (linkB ? 1 : 0);
  let max = 2;
  if (item.transfer && r.transfer !== undefined) {
    const ok = r.transfer.trim() !== '' && item.transfer.accept.some((a) => cmp(a) === cmp(r.transfer ?? ''));
    parts.push({ id: 'transfer', ok });
    got += ok ? 1 : 0;
    max = 3;
  }
  return { got, max, parts, verdict: got >= max ? 'correct' : got > 0 ? 'near' : 'wrong', free: false };
}

export function checkPair(item: Pair): Problems {
  const out: Problems = [];
  for (const [name, s] of [['sa', item.sa], ['sb', item.sb]] as const) {
    const n = wordCount(s);
    if (n < 5 || n > 25) out.push(`Satz ${name} hat ${n} Wörter (5–25)`);
    if (BRITISH.test(s)) out.push(`britische Schreibweise in ${name}`);
  }
  if (cmp(item.sa) === cmp(item.sb)) out.push('Satz a und b sind gleich');
  if (new Set(item.means.map((m) => cmp(m.en))).size !== 3) out.push('Bedeutungen nicht alle verschieden');
  if (item.transfer && !item.transfer.accept.length) out.push('transfer ohne accept');
  return out;
}
