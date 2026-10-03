// Wort-Markierung beim Vorlesen (Neubau N58, Markt 20 „Karaoke“): Die Sprachausgabe spricht den
// Absatz in Stücken (≤ 150 Zeichen) und meldet – nur wo der Browser das kann – Wortgrenzen als
// Zeichen-Index im Stück. Hier wird daraus die Stelle im angezeigten Absatz. Rein und getestet.

type Span = readonly [number, number];

/** Wie die Sprachausgabe den Text flach macht (Leerraum → ein Leerzeichen, getrimmt), mit Rückweg je Zeichen. */
export function flatten(text: string): { flat: string; map: number[] } {
  let flat = '';
  const map: number[] = [];
  let pendingSpace = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (/\s/.test(ch)) {
      if (flat && pendingSpace < 0) pendingSpace = i;
      continue;
    }
    if (pendingSpace >= 0) {
      flat += ' ';
      map.push(pendingSpace);
      pendingSpace = -1;
    }
    flat += ch;
    map.push(i);
  }
  return { flat, map };
}

/** Anfang jedes Stücks im flachen Text (−1, wenn ein Stück dort nicht wörtlich vorkommt). */
export function chunkOffsets(flat: string, chunks: readonly string[]): number[] {
  const out: number[] = [];
  let pos = 0;
  for (const c of chunks) {
    const at = flat.indexOf(c, pos);
    out.push(at);
    if (at >= 0) pos = at + c.length;
  }
  return out;
}

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/**
 * Stelle des Worts im ORIGINALTEXT zu einer Wortgrenze: Stück `chunk`, Zeichen `at` im Stück,
 * Länge `len` (falls gemeldet, sonst bis zum nächsten Leerraum). Satzzeichen am Rand fallen weg.
 */
export function boundarySpan(text: string, chunks: readonly string[], chunk: number, at: number, len: number | null): Span | null {
  const { flat, map } = flatten(text);
  const base = chunkOffsets(flat, chunks)[chunk];
  if (base === undefined || base < 0) return null;
  let s = base + at;
  if (s < 0 || s >= flat.length) return null;
  let e = len ? Math.min(flat.length, s + len) : s;
  if (!len) while (e < flat.length && !/\s/.test(flat[e] ?? '')) e++;
  while (s < e && !WORD_CHAR.test(flat[s] ?? '')) s++;
  while (e > s && !WORD_CHAR.test(flat[e - 1] ?? '')) e--;
  if (e <= s) return null;
  const from = map[s];
  const to = map[e - 1];
  return from === undefined || to === undefined ? null : [from, to + 1];
}
