import { splitWords } from '../../answer/align';
import { legacyNorm } from '../../grammar/key';
import { BRITISH, cmp, type Problems } from './common';
import type { C1Response, C1Score, Para } from '../types';

// `para`: Satz-Paraphrase. Handy: den gleichbedeutenden Satz wählen (1 Punkt). Laptop: den Satz mit festem Anfang schreiben (2 Punkte:
// Bedeutung + Form); ein Satz aus `answers` gibt 2/2. Ein sehr ähnlicher Satz (≥ 75 % gleiche Wörter) ist „nicht sicher prüfbar“
// (`near`, `unsure`), jeder andere 0.

function close(item: Para, text: string): boolean {
  const words = (s: string) => splitWords(legacyNorm(s));
  const g = words(text);
  if (!g.length) return false;
  return item.answers.some((a) => {
    const w = words(a);
    if (!w.length || Math.abs(w.length - g.length) > 2) return false;
    const pool = [...w];
    let hit = 0;
    for (const x of g) {
      const i = pool.indexOf(x);
      if (i >= 0) {
        hit++;
        pool.splice(i, 1);
      }
    }
    return hit / Math.max(w.length, g.length) >= 0.75;
  });
}

export function scorePara(item: Para, r: Extract<C1Response, { kind: 'para' }>): C1Score {
  if (r.text !== undefined) {
    const norm = cmp(r.text);
    if (item.answers.some((a) => cmp(a) === norm)) return { got: 2, max: 2, parts: [{ id: 'meaning', ok: true }, { id: 'form', ok: true }], verdict: 'correct', free: true };
    const unsure = close(item, r.text);
    return { got: 0, max: 2, parts: [{ id: 'meaning', ok: false }, { id: 'form', ok: false }], verdict: unsure ? 'near' : 'wrong', free: true, ...(unsure ? { reason: 'unsure' as const } : {}) };
  }
  const ok = r.pick === item.answer;
  return { got: ok ? 1 : 0, max: 1, parts: [{ id: 'a', ok }], verdict: ok ? 'correct' : 'wrong', free: false };
}

export function checkPara(item: Para): Problems {
  const out: Problems = [];
  const start = cmp(item.start);
  for (const a of item.answers) if (!cmp(a).startsWith(start)) out.push(`answer „${a}“ beginnt nicht mit „${item.start}“`);
  const right = item.options[item.answer];
  const ans = new Set(item.answers.map(cmp));
  if (right === undefined || !ans.has(cmp(right))) out.push('options[answer] steht nicht in answers');
  item.options.forEach((o, i) => {
    if (i === item.answer) return;
    if (ans.has(cmp(o))) out.push(`falsche Option „${o}“ steht in answers`);
    if (!item.why.wrong.some((r) => r.opt !== undefined && r.opt.trim().toLowerCase() === o.trim().toLowerCase())) out.push(`falsche Option „${o}“ ohne Begründung (WhyRule mit opt)`);
  });
  if (new Set(item.options.map(cmp)).size !== 4) out.push('Optionen nicht alle verschieden');
  if (BRITISH.test(item.a) || item.options.some((o) => BRITISH.test(o))) out.push('britische Schreibweise');
  return out;
}
