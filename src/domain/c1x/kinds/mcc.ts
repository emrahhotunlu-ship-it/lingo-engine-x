import type { C1Response, C1Score, Mcc } from '../types';
import { BRITISH, wordCount, type Problems } from './common';

/** `mcc`: Auswahl A–D, 1 Punkt, nie frei. */
export function scoreMcc(item: Mcc, r: Extract<C1Response, { kind: 'mcc' }>): C1Score {
  const ok = r.pick === item.answer;
  return { got: ok ? 1 : 0, max: 1, parts: [{ id: 'a', ok }], verdict: ok ? 'correct' : 'wrong', free: false };
}

export function checkMcc(item: Mcc): Problems {
  const out: Problems = [];
  const n = wordCount(item.text);
  if (n < 8 || n > 30) out.push(`Satz hat ${n} Wörter (8–30)`);
  const opts = item.options.map((o) => o.trim().toLowerCase());
  if (new Set(opts).size !== 4) out.push('Optionen nicht alle verschieden');
  const right = item.options[item.answer];
  if (!right) out.push('answer zeigt auf keine Option');
  else if (new RegExp(`\\b${right.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(item.text.replace(/_{3,}/, ' '))) out.push('Lösungswort steht schon im Satz');
  item.options.forEach((o, i) => {
    if (i === item.answer) return;
    if (!item.why.wrong.some((r) => r.opt !== undefined && r.opt.trim().toLowerCase() === o.trim().toLowerCase())) out.push(`falsche Option „${o}“ ohne Begründung (WhyRule mit opt)`);
  });
  if (BRITISH.test(item.text) || item.options.some((o) => BRITISH.test(o))) out.push('britische Schreibweise');
  return out;
}
