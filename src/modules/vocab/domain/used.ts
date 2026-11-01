import { toUSText } from '../shared';
import { headWords, matchesWord } from './card';
import { damerau } from './check';
import type { LexKind } from './types';

// Großpaket A Schritt 5 (english-teacher Befund 2, learning-scientist Befund 1): Steht das Zielwort in einem frei geschriebenen Text?
// Eigene Suche nur für die Verwendungsprüfung von Anwenden und eigenem Satz; die Lücken-Logik (`locateGap`) bleibt unverändert.
//  - britische Schreibung im Lernertext zählt (vorher `toUSText`),
//  - Beugung je Wort (`matchesWord`), Begleiter (a/an/the) im Stichwort sind frei,
//  - Platzhalter (*sb*, *sth*, *one's*) lassen 1–3 Wörter Platz (*remind him of*, *make up my mind*),
//  - Kollokation, Wendung, Phrasal Verb: bis zu 2 Einschübe zwischen den Wörtern (*made a quick decision*, *sign it off*),
//  - Kollokation zusätzlich in beliebiger Reihenfolge innerhalb von 6 Wörtern (Passiv: *the decision was made*).

const DET = new Set(['a', 'an', 'the']);
const PLACEHOLDER = new Set(['sth', 'sb', 'smth', 'sth.', 'sb.', 'someone', 'something', 'somebody', "one's", "someone's", 'oneself', "sb's"]);
const INSERT_MAX = 2;
const GAP_MAX = 3;
const WINDOW = 6;

const tokens = (s: string): string[] => [...toUSText(s).toLowerCase().replace(/’/g, "'").matchAll(/[a-z0-9][a-z0-9'-]*/g)].map((m) => m[0]);

/** Wörter des Stichworts mit erlaubtem Abstand davor: Platzhalter vergrößern den Abstand zum nächsten Wort, Begleiter fallen weg. */
function slots(head: string): { h: string; gap: number }[] {
  const raw = head.toLowerCase().replace(/’/g, "'").replace(/^to\s+/, '').split(/\s+/).filter(Boolean);
  const out: { h: string; gap: number }[] = [];
  let extra = 0;
  for (const w of raw) {
    if (PLACEHOLDER.has(w)) extra = GAP_MAX;
    else if (DET.has(w)) continue;
    else {
      out.push({ h: w, gap: extra });
      extra = 0;
    }
  }
  return out;
}

/** Kommt das Zielwort (gebeugt, mit Einschüben je nach Art) im Text vor? */
export function usedIn(text: string, head: string, kind: LexKind): boolean {
  const toks = tokens(text);
  const sl = slots(head);
  if (!sl.length || !toks.length) return false;
  const ins = kind === 'w' ? 0 : INSERT_MAX;
  const match = (si: number, ti: number): boolean => {
    if (si === sl.length) return true;
    const s = sl[si]!;
    const max = si === 0 ? 0 : Math.max(ins, s.gap);
    for (let skip = 0; skip <= max; skip++) {
      const t = ti + skip;
      if (t >= toks.length) return false;
      if (matchesWord(toks[t]!, s.h) && match(si + 1, t + 1)) return true;
    }
    return false;
  };
  for (let i = 0; i < toks.length; i++) if (match(0, i)) return true;
  // Kollokation im Passiv oder umgestellt: alle Inhaltswörter innerhalb von 6 Wörtern.
  if (kind === 'col' && sl.length >= 2) {
    for (let i = 0; i < toks.length; i++) {
      const win = toks.slice(i, i + WINDOW);
      if (sl.every((s) => win.some((w) => matchesWord(w, s.h)))) return true;
    }
  }
  return false;
}

/** Inhaltswörter des Stichworts (ohne Platzhalter, Begleiter und Funktionswörter bis 2 Buchstaben). */
const contentWords = (head: string): string[] => headWords(head).filter((w) => w.length > 2 && !DET.has(w));

/**
 * Ist die Fundstelle ein Versuch AM Zielwort (nicht ein Ausweichwort)? Ein Inhaltswort des Stichworts steht darin, gebeugt oder mit
 * höchstens 2 Tippfehlern (*effect* für *affect*, *do a decision* für *make a decision*). *delay* für *postpone* ist kein Versuch.
 */
export function attempted(at: string, head: string): boolean {
  const toks = tokens(at);
  const cw = contentWords(head);
  return cw.some((h) => toks.some((w) => matchesWord(w, h) || (h.length >= 4 && w.length >= 4 && damerau(w, h) <= 2)));
}

/**
 * Fast abgeschrieben (english-teacher Befund 5): die Wörter des Beispielsatzes stehen in derselben Reihenfolge im Text, bis auf höchstens 20 %
 * oder (ab 6 Wörtern) höchstens 2 Wörter (gemeinsame Teilfolge; Namen, Zahlen, ein, zwei Wörter getauscht).
 */
export function nearCopy(text: string, example: string): boolean {
  const a = tokens(example);
  if (a.length < 4) return false;
  const all = tokens(text);
  // Nur zusammenhängende Ausschnitte (Länge des Beispiels + 1): verstreute Allerweltswörter in einem langen Text sind keine Abschrift.
  for (let i = 0; i < Math.max(1, all.length - a.length + 1); i++) {
    const b = all.slice(i, i + a.length + 1);
    const prev = new Array<number>(b.length + 1).fill(0);
    for (const x of a) {
      let diag = 0;
      for (let j = 1; j <= b.length; j++) {
        const up = prev[j]!;
        prev[j] = x === b[j - 1] ? diag + 1 : Math.max(prev[j]!, prev[j - 1]!);
        diag = up;
      }
    }
    const lcs = prev[b.length]!;
    if (lcs / a.length >= 0.8 || (a.length >= 6 && lcs >= a.length - 2)) return true;
  }
  return false;
}
