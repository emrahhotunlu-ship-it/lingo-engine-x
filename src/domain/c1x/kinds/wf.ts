import { editDistance } from '../../answer/diff';
import { maskOf, type MaskCell } from '../../answer/mask';
import { typoBudget } from '../../answer/check';
import type { C1Response, C1Score, Wf } from '../types';
import { BRITISH, cmp, usHint, wordCount, type Problems } from './common';

/**
 * `wf`: Wortbildung, ein Wort tippen. Steht die Antwort in der Wortfamilie, ist aber nicht gesucht: falsch mit Grund `family`
 * („richtige Familie, falsche Wortart“). Tippfehler nur ohne verändertes Affix (gleicher Wortanfang und gleiches Wortende) → „Fast“;
 * ein falsches Affix (inprecedented) ist immer falsch.
 */
export function scoreWf(item: Wf, r: Extract<C1Response, { kind: 'wf' }>): C1Score {
  const g = cmp(r.text);
  const targets = item.accept.map(cmp);
  if (g && targets.includes(g)) {
    const us = usHint(r.text, item.accept);
    return {
      got: 1,
      max: 1,
      parts: [{ id: 'form', ok: true }],
      verdict: 'correct',
      free: true,
      ...(us ? { us } : {}),
    };
  }
  const wrong = {
    got: 0,
    max: 1,
    parts: [{ id: 'form' as const, ok: false }],
    free: true,
  };
  if (g && item.family.map(cmp).includes(g)) return { ...wrong, verdict: 'wrong', reason: 'family' };
  const typo =
    g.length > 0 &&
    targets.some((t) => {
      if (t.length < 5 || editDistance(g, t) > typoBudget(t.length)) return false;
      const head = Math.max(2, Math.min(3, Math.floor(t.length / 3)));
      return g.slice(0, head) === t.slice(0, head) && g.slice(-3) === t.slice(-3);
    });
  return {
    ...wrong,
    verdict: typo ? 'near' : 'wrong',
    ...(typo ? { reason: 'typo' as const } : {}),
  };
}

export function checkWf(item: Wf): Problems {
  const out: Problems = [];
  const n = wordCount(item.text);
  if (n < 6 || n > 30) out.push(`Satz hat ${n} Wörter (6–30)`);
  const stem = item.stem.toLowerCase();
  for (const a of item.accept) {
    const w = a.toLowerCase();
    if (w === stem) out.push(`Lösung „${a}“ ist der Stamm`);
    if (!item.family.map((f) => f.toLowerCase()).includes(w)) out.push(`Lösung „${a}“ steht nicht in family`);
    const prefix = Math.ceil(stem.length * 0.6);
    if (!w.includes(stem.slice(0, prefix)) && !item.parts.change) out.push(`Lösung „${a}“ enthält den Stamm nicht (Wurzel ≥ 60 %), dann braucht parts.change eine Angabe`);
  }
  if (
    morphPieces(item)
      .map((p) => p.text)
      .join('') !== (item.accept[0] ?? '')
  )
    out.push('Zerlegung ergibt nicht das Wort');
  if (new Set(item.family.map((f) => f.toLowerCase())).size !== item.family.length) out.push('family enthält Doppelte');
  for (const f of item.family) if (/\s/.test(f)) out.push(`family-Eintrag „${f}“ ist kein einzelnes Wort`);
  if (BRITISH.test(item.text) || item.accept.some((a) => BRITISH.test(a))) out.push('britische Schreibweise');
  return out;
}

/** Stütze nach Hinweis 2: Platzhalter je Buchstabe der ersten Lösung, der erste Buchstabe sichtbar. */
export const wfMask = (item: Wf): MaskCell[] => maskOf(item.accept[0] ?? '', { firstLetter: true });

export type MorphPiece = { text: string; role: 'pre' | 'core' | 'suf' };

/**
 * Zerlegung des gesuchten Worts für die Rückmeldung (*un · precedent · ed*). Rein: Vorsilbe (wenn das Wort so beginnt), gemeinsamer Anfang
 * mit dem Grundwort als Kern, der Rest als Nachsilbe (an den Nachsilben der Aufgabe geteilt, wenn sie genau passen). Die Teile ergeben immer
 * wieder das Wort (Buchstabe für Buchstabe), auch bei Änderungen im Stamm (feasib · ility).
 */
export function morphPieces(item: Wf): MorphPiece[] {
  const word = item.accept[0] ?? '';
  const lower = word.toLowerCase();
  const out: MorphPiece[] = [];
  let rest = word;
  const pre = item.parts.pre ?? '';
  if (pre && lower.startsWith(pre.toLowerCase())) {
    out.push({ text: word.slice(0, pre.length), role: 'pre' });
    rest = word.slice(pre.length);
  }
  const base = item.parts.base.toLowerCase();
  let n = 0;
  while (n < base.length && n < rest.length && rest[n]?.toLowerCase() === base[n]) n++;
  if (n === 0) return [{ text: word, role: 'core' }];
  const suf = item.parts.suf ?? [];
  const joined = suf.join('');
  // Sind die Nachsilben der Aufgabe das Ende des Worts (und bleibt der gemeinsame Anfang im Kern), gilt die sprachliche Teilung: suppose · d · ly.
  const bySuffix = joined !== '' && rest.length - joined.length >= n && rest.toLowerCase().endsWith(joined.toLowerCase());
  const coreLen = bySuffix ? rest.length - joined.length : n;
  out.push({ text: rest.slice(0, coreLen), role: 'core' });
  const tail = rest.slice(coreLen);
  if (tail) {
    if (bySuffix) {
      let at = 0;
      for (const sx of suf) {
        out.push({ text: tail.slice(at, at + sx.length), role: 'suf' });
        at += sx.length;
      }
    } else out.push({ text: tail, role: 'suf' });
  }
  return out;
}
