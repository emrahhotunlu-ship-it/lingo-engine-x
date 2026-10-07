import { hasKey, kwtText, kwtWords } from '../kwtNorm';
import type { C1Response, C1Score, Kwt } from '../types';
import { BRITISH, ruleMatches, wordCount, type Problems } from './common';

// `kwt` (Cambridge Teil 4): Schlüsselwort unverändert, 3–6 Wörter, 2 Teilpunkte (Teil A + Teil B), beste GANZE Variante.
// Teile aus verschiedenen Varianten werden nie gemischt (Teile hängen zusammen: had not been so high / had been lower).
// 1 von 2 ist „Fast“ (Note 2), keine Teilnote darüber. Treffer einer typischen Falle liefert `trap` (Begründung aus `why.wrong`).

const startsWith = (hay: readonly string[], seq: readonly string[]): boolean => seq.length > 0 && seq.length <= hay.length && seq.every((w, i) => hay[i] === w);
const endsWith = (hay: readonly string[], seq: readonly string[]): boolean => seq.length > 0 && seq.length <= hay.length && seq.every((w, i) => hay[hay.length - seq.length + i] === w);

export function scoreKwt(item: Kwt, r: Extract<C1Response, { kind: 'kwt' }>): C1Score {
  const toks = kwtWords(r.text);
  const text = toks.join(' ');
  const free = r.typed === true;
  const trap = (item.traps ?? []).findIndex((t) => kwtText(t) === text);
  const trapPart = trap >= 0 ? { trap } : {};
  const zero = { got: 0, max: 2, parts: [{ id: 'a' as const, ok: false }, { id: 'b' as const, ok: false }], verdict: 'wrong' as const, free, ...trapPart };
  if (!hasKey(toks, item.key)) return { ...zero, reason: 'key' };
  const [lo, hi] = item.words ?? [3, 6];
  if (toks.length < lo || toks.length > hi) return { ...zero, reason: 'length' };
  let best = { a: false, b: false, got: 0 };
  for (const k of item.keys) {
    for (const a of k.a.map(kwtWords)) {
      for (const b of k.b.map(kwtWords)) {
        const whole = [...a, ...b];
        const single = a.length > 0 && a.join(' ') === b.join(' ');
        const full = (whole.length === toks.length && whole.every((w, i) => w === toks[i])) || (single && a.length === toks.length && a.every((w, i) => w === toks[i]));
        const pa = startsWith(toks, a);
        const pb = endsWith(toks, b);
        // Überlappen A und B (zusammen länger als die Antwort), zählt nur eines von beiden.
        const overlap = a.length + b.length > toks.length;
        const got = full ? 2 : pa && pb && !overlap ? 2 : pa || pb ? 1 : 0;
        if (got > best.got) best = { a: full || pa, b: full || pb, got };
      }
    }
  }
  const parts = [{ id: 'a' as const, ok: best.a && best.got > 0 }, { id: 'b' as const, ok: best.b && best.got > 0 }];
  const verdict = best.got >= 2 ? 'correct' : best.got > 0 ? 'near' : 'wrong';
  return { got: best.got, max: 2, parts, verdict, free, ...trapPart, ...(trap >= 0 && best.got < 2 ? { reason: 'trap' as const } : {}) };
}

export function checkKwt(item: Kwt): Problems {
  const out: Problems = [];
  const key = item.key.toLowerCase();
  const legacy = /^kwt-v2-/.test(item.id);
  const first = item.keys[0];
  if (!first) return ['keys leer'];
  const a0 = first.a[0] ?? '';
  const b0 = first.b[0] ?? '';
  const sol = kwtWords(`${a0} ${b0}`);
  // Lösung 3–6 Wörter, enthält das Schlüsselwort unverändert (jede Variante, jede Kombination).
  for (const k of item.keys) {
    for (const a of k.a) {
      for (const b of k.b) {
        const w = kwtWords(`${a} ${b}`);
        const [lo, hi] = item.words ?? [3, 6];
        if (w.length < lo || w.length > hi) out.push(`Lösung „${a} ${b}“ hat ${w.length} Wörter (${lo}–${hi})`);
        if (!hasKey(w, key)) out.push(`Lösung „${a} ${b}“ enthält das Schlüsselwort ${item.key} nicht unverändert`);
      }
    }
  }
  // Das musterbildende Wort gehört in Teil B, nie in Teil A (A hat höchstens ein Funktionswort und verrät die Wortzahl nicht).
  if (!legacy) for (const k of item.keys) for (const a of k.a) if (kwtWords(a).length > 3) out.push(`Teil A „${a}“ ist länger als 3 Wörter`);
  if (!legacy && new RegExp(`\\b${key}\\b`, 'i').test(item.lead)) out.push('Schlüsselwort steht schon in Satz A (lead)');
  // Bausteine ∪ Schlüsselwort = die Wörter der ersten Lösung (als Mehrfachmenge), Ablenker (extra) kommen in der Lösung nicht vor.
  const need = [...sol];
  const ki = need.indexOf(key);
  if (ki >= 0) need.splice(ki, 1);
  const have = item.tiles.flatMap((t) => kwtWords(t));
  if (!legacy && [...need].sort().join('|') !== [...have].sort().join('|')) out.push(`tiles (${have.join(' ')}) ergeben mit dem Schlüsselwort nicht genau die erste Lösung (${sol.join(' ')})`);
  const solSet = new Set(sol);
  if (!legacy && (item.extra.length < 2 || item.extra.length > 4)) out.push('extra braucht 2–4 Ablenker');
  if (!legacy && item.words) out.push('words nur bei Aufgaben aus dem LP2-Adapter (kwt-v2-<n>)');
  for (const e of item.extra) for (const w of kwtWords(e)) if (solSet.has(w)) out.push(`extra „${e}“ enthält das Lösungswort „${w}“`);
  const lead = wordCount(item.lead);
  const frame = wordCount(`${item.before} ${item.after}`) + sol.length;
  if (!legacy && (lead < 6 || lead > 25)) out.push(`Satz A hat ${lead} Wörter (6–25)`);
  if (!legacy && (frame < 6 || frame > 25)) out.push(`Satz B hat ${frame} Wörter (6–25)`);
  if (BRITISH.test(item.lead) || BRITISH.test(`${item.before} ${item.after}`) || item.keys.some((k) => k.a.concat(k.b).some((p) => BRITISH.test(p)))) out.push('britische Schreibweise');
  // Jede Falle ergibt weniger als 2 Punkte und hat eine Begründung.
  for (const t of item.traps ?? []) {
    if (scoreKwt(item, { kind: 'kwt', text: t }).got >= 2) out.push(`Falle „${t}“ ergibt volle Punkte`);
    if (!item.why.wrong.some((r) => ruleMatches(r, { given: t }))) out.push(`Falle „${t}“ ohne Begründung (WhyRule mit if/not, die sie trifft)`);
  }
  return out;
}
