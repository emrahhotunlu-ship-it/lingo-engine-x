import type { GapSpan, Token } from './types';

// Zerlegen englischer Texte für Wort-Antippen (Entwurf §8).
// Ein Wort sind Buchstaben mit Apostroph- oder Bindestrich-Teilen: don't, company's, e-invoicing.
// Folgen mit Ziffern (2026, B2, COVID-19) sind keine antippbaren Wörter (`num`).
// Leerraum und Satzzeichen werden eigene Tokens, der Text bleibt lückenlos: tokens.map(t => t.text).join('') === text.

const TOKEN_RE = /([\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*)|(\s+)|([^\s\p{L}\p{M}\p{N}]+)/gu;
const HAS_DIGIT = /\p{N}/u;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index;
    const t = m[0];
    const kind = m[1] !== undefined ? (HAS_DIGIT.test(t) ? 'num' : 'word') : m[2] !== undefined ? 'space' : 'punct';
    out.push({ kind, text: t, start, end: start + t.length });
  }
  return out;
}

/**
 * Einheitliche Schreibweise für Vergleiche und Nachschlagen: Unicode-NFKC, Kleinschreibung,
 * gerade Apostrophe, einfache Bindestriche, zusammengefasster Leerraum.
 */
export function normalizeWord(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Entfernt Lücken-Klammern: „Our old car is still very [reliable]." → Text ohne Klammern und die Spanne „reliable".
 * Nur zusammengehörige Paare ohne Verschachtelung zählen; leere Paare fallen ohne Spanne weg,
 * einzelne Klammern bleiben als Text stehen.
 */
export function stripGapMarks(ex: string): { text: string; spans: GapSpan[] } {
  const spans: GapSpan[] = [];
  let text = '';
  let from = 0;
  for (const m of ex.matchAll(/\[([^[\]]*)\]/g)) {
    text += ex.slice(from, m.index);
    const inner = m[1] ?? '';
    if (inner.length > 0) spans.push({ start: text.length, end: text.length + inner.length, text: inner });
    text += inner;
    from = m.index + m[0].length;
  }
  text += ex.slice(from);
  return { text, spans };
}
