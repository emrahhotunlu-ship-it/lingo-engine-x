import { cmp, lowerWords, BRITISH, type Problems } from './common';
import type { C1Response, C1Score, Cnet } from '../types';

// `cnet`: Wortpartner im Netz. Treffer h, Fehlgriffe f, richtige Partner R: Punkte = max(0, h − f), höchstens R.
// `correct` bei h = R und f = 0, `near` ab der Hälfte, sonst `wrong`. Einträge in `also` erscheinen nicht als Chip und zählen nie als Fehlgriff.

export function scoreCnet(item: Cnet, r: Extract<C1Response, { kind: 'cnet' }>): C1Score {
  const picks = [...new Set(r.picks.map(cmp))];
  const right = item.right.map((x) => cmp(x.w));
  const also = new Set((item.also ?? []).map((x) => cmp(x.w)));
  const h = right.filter((w) => picks.includes(w)).length;
  const f = picks.filter((p) => !right.includes(p) && !also.has(p)).length;
  const R = right.length;
  const got = Math.min(R, Math.max(0, h - f));
  const verdict = h === R && f === 0 ? 'correct' : got * 2 >= R && got > 0 ? 'near' : 'wrong';
  return { got, max: R, parts: right.map((w, i) => ({ id: `link${i}` as const, ok: picks.includes(w) })), verdict, free: false };
}

export function checkCnet(item: Cnet): Problems {
  const out: Problems = [];
  const hub = item.hub.toLowerCase();
  const right = item.right.map((x) => cmp(x.w));
  const wrong = item.wrong.map((x) => cmp(x.w));
  const also = (item.also ?? []).map((x) => cmp(x.w));
  for (const [a, b, name] of [[right, wrong, 'right/wrong'], [right, also, 'right/also'], [wrong, also, 'wrong/also']] as const) if (a.some((w) => b.includes(w))) out.push(`${name}: gleiche Wörter in beiden Listen`);
  for (const x of item.right) {
    const words = lowerWords(x.ex);
    if (!words.includes(hub) && !words.some((w) => w.startsWith(hub.slice(0, Math.max(3, hub.length - 2))))) out.push(`Beispiel zu „${x.w}“ enthält ${item.hub} nicht`);
    const stem = x.w.toLowerCase().split(' ')[0] ?? '';
    if (!words.some((w) => w.startsWith(stem.slice(0, Math.max(3, stem.length - 3))))) out.push(`Beispiel zu „${x.w}“ enthält den Partner nicht`);
    if (BRITISH.test(x.ex)) out.push('britische Schreibweise im Beispiel');
  }
  for (const x of item.wrong) {
    if (!item.why.wrong.some((r) => r.opt !== undefined && r.opt.trim().toLowerCase() === x.w.trim().toLowerCase())) out.push(`falscher Partner „${x.w}“ ohne Begründung (WhyRule mit opt)`);
  }
  return out;
}
