import { splitWords } from '../../answer/align';
import { legacyNorm } from '../../grammar/key';
import { BRITISH, cmp, type Problems } from './common';
import type { C1Response, C1Score, Reg } from '../types';

// `reg`: Register umschreiben. Handy: je Abschnitt ein Chip (1 Punkt je Abschnitt). Laptop: je Abschnitt 1 Punkt, wenn eine `accept`-Fassung
// im Text steht und die alte Fassung nicht mehr; ein Satz aus `answers` gibt volle Punkte. Sind alle Abschnitte erfüllt, der Satz aber nicht
// in `answers`: `verdict: 'near'` mit `reason: 'unsure'` („nicht sicher prüfbar“, Urteil von Claude nur auf Knopfdruck, später).

const inText = (norm: string, phrase: string): boolean => ` ${norm} `.includes(` ${legacyNorm(phrase)} `);

export function scoreReg(item: Reg, r: Extract<C1Response, { kind: 'reg' }>): C1Score {
  const max = item.segs.length;
  const seg = (ok: boolean, i: number) => ({ id: `seg${i}` as const, ok });
  if (r.text !== undefined) {
    const norm = cmp(r.text);
    if (item.answers.some((a) => cmp(a) === norm)) return { got: max, max, parts: item.segs.map((_, i) => seg(true, i)), verdict: 'correct', free: true };
    const ok = item.segs.map((s) => s.accept.some((a) => inText(norm, a)) && !inText(norm, s.span));
    const got = ok.filter(Boolean).length;
    const parts = ok.map(seg);
    if (got === max) return { got, max, parts, verdict: 'near', free: true, reason: 'unsure' };
    return { got, max, parts, verdict: got > 0 ? 'near' : 'wrong', free: true };
  }
  const picks = r.picks ?? [];
  const ok = item.segs.map((s, i) => {
    const p = picks[i];
    return p !== undefined && s.accept.some((a) => cmp(a) === cmp(p));
  });
  const got = ok.filter(Boolean).length;
  return { got, max, parts: ok.map(seg), verdict: got >= max ? 'correct' : got > 0 ? 'near' : 'wrong', free: false };
}

export function checkReg(item: Reg): Problems {
  const out: Problems = [];
  const text = ` ${legacyNorm(item.text)} `;
  for (const s of item.segs) {
    if (!text.includes(` ${legacyNorm(s.span)} `)) out.push(`Abschnitt „${s.span}“ steht nicht im Text`);
    const acc = s.accept.map(cmp);
    if (s.choices.filter((c) => acc.includes(cmp(c))).length !== 1) out.push(`Abschnitt „${s.span}“: genau ein choice muss in accept stehen`);
    if (BRITISH.test(s.accept.join(' '))) out.push('britische Schreibweise in accept');
  }
  for (const a of item.answers) {
    const norm = ` ${cmp(a)} `;
    for (const s of item.segs) if (!s.accept.some((x) => norm.includes(` ${cmp(x)} `)) || norm.includes(` ${cmp(s.span)} `)) out.push(`answer „${a}“ erfüllt Abschnitt „${s.span}“ nicht`);
  }
  if (splitWords(item.text).length < 4) out.push('Text zu kurz');
  return out;
}
