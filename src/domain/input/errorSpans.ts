// Stellen einer KI-Korrektur im eigenen Text wiederfinden (Plan §5, R7): tolerant gegenüber
// typografischen Anführungszeichen, Apostrophen, Gedankenstrichen und Leerraum, zuerst mit,
// dann ohne Groß/klein. Ohne Treffer `null` – die Stelle steht dann nur in der Liste, wird
// aber nie falsch markiert.

const MAP: Readonly<Record<string, string>> = {
  '’': "'",
  '‘': "'",
  '`': "'",
  '´': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '«': '"',
  '»': '"',
  '–': '-',
  '—': '-',
  '‐': '-',
  '‑': '-',
  ' ': ' ',
};

/** Normalisierter Text und Rückabbildung: `idx[i]` = Position im Original. */
function normalize(text: string): { norm: string; idx: number[] } {
  let norm = '';
  const idx: number[] = [];
  let lastSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = MAP[text[i] ?? ''] ?? text[i] ?? '';
    const space = /\s/.test(ch);
    if (space) {
      if (lastSpace) continue;
      norm += ' ';
      idx.push(i);
      lastSpace = true;
      continue;
    }
    lastSpace = false;
    norm += ch;
    idx.push(i);
  }
  return { norm, idx };
}

export function locateError(orig: string, text: string, from = 0): [number, number] | null {
  const needle = normalize(orig.trim()).norm.trim();
  if (!needle) return null;
  const hay = normalize(text);
  const startNorm = hay.idx.findIndex((i) => i >= from);
  if (startNorm < 0) return null;
  let at = hay.norm.indexOf(needle, startNorm);
  if (at < 0) at = hay.norm.toLowerCase().indexOf(needle.toLowerCase(), startNorm);
  if (at < 0) return null;
  const start = hay.idx[at] ?? 0;
  const lastIdx = hay.idx[at + needle.length - 1] ?? start;
  return [start, lastIdx + 1];
}

/** Stellen für eine Liste von Fehlern: überlappende Treffer werden verworfen (nie doppelt markiert). */
export function locateAll(origs: readonly string[], text: string): Array<[number, number] | null> {
  const taken: Array<[number, number]> = [];
  return origs.map((o) => {
    let from = 0;
    for (let tries = 0; tries < 5; tries++) {
      const hit = locateError(o, text, from);
      if (!hit) return null;
      const clash = taken.some(([a, b]) => hit[0] < b && a < hit[1]);
      if (!clash) {
        taken.push(hit);
        return hit;
      }
      from = hit[1];
    }
    return null;
  });
}
