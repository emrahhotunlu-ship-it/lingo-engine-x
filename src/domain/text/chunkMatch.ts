import { locate } from '../srs/context';
import { sentenceSplit } from './textStats';

// Wendungen im eigenen Text erkennen (Plan §4.3/§4.4): „Nützliche Wendungen" und Kernwendungen
// haken sich beim Tippen ab. Toleranz: Groß/klein, Grundform am Anfang und Ende jedes Teils
// (raise → raised, rate → rates), „to " am Anfang, Platzhalter „…"/„sb/sth" als Lücke.

const PLACEHOLDER = /\s*(?:…|\.\.\.|\b(?:sb|sth|someone|something|smb|smth)\b)\s*/i;

/** Teile einer Wendung, die der Reihe nach im Text vorkommen müssen. */
export function chunkParts(chunk: string): string[] {
  return chunk
    .replace(/[“”"]/g, '')
    .replace(/^\s*to\s+/i, '')
    .split(PLACEHOLDER)
    .map((p) => p.replace(/^[\s,;:.!?–-]+|[\s,;:.!?–-]+$/g, '').trim())
    .filter((p) => p.length > 1);
}

/** Kommt die Wendung im Text vor? */
export function usesChunk(text: string, chunk: string): boolean {
  const parts = chunkParts(chunk);
  if (!parts.length) return false;
  let rest = text;
  for (const p of parts) {
    const hit = locate(rest, p);
    if (!hit) return false;
    rest = rest.slice(hit.end);
  }
  return true;
}

export function usedChunks(text: string, chunks: readonly string[]): boolean[] {
  return chunks.map((c) => usesChunk(text, c));
}

/** Der Satz im Text, der die Wendung enthält (Ursprungssatz für „Als Karte speichern"), sonst `null`. */
export function sentenceWith(text: string, phrase: string): string | null {
  for (const s of sentenceSplit(text)) if (usesChunk(s.text, phrase)) return s.text;
  return null;
}
