// Wörter zählen und Sätze trennen (Plan §2.2). Die Satzgrenzen folgen denselben Regeln wie die
// Stückelung der Sprachausgabe (speech.chunkText): getrennt wird nach `. ! ? ; :` nur, wo danach
// Leerraum folgt – „3.5", „U.S." und „1,000" bleiben ganz.

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const SENTENCE_RE = /[^\s].*?[.!?;:]+["'’”)\]]*(?=\s|$)|[^\s].*$/g;
const ABBREV_END = /(?:\b(?:[A-Z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|approx|No)\.)$/;

export function wordCount(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

export type SentenceSpan = { text: string; start: number; end: number; para: number };

/** Sätze mit Zeichen-Offsets im Originaltext; Absätze (Leerzeile) trennen immer. */
export function sentenceSplit(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const paraRe = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g;
  let para = 0;
  for (const pm of text.matchAll(paraRe)) {
    const pText = pm[0];
    const pStart = pm.index;
    if (!pText.trim()) continue;
    const flat = pText.replace(/\n/g, ' ');
    const parts: SentenceSpan[] = [];
    for (const m of flat.matchAll(SENTENCE_RE)) {
      const raw = m[0];
      const trimmed = raw.trimEnd();
      if (!trimmed.trim()) continue;
      const prev = parts[parts.length - 1];
      // Abkürzungen („U.S.", „Mr.", „e.g.") beenden keinen Satz: mit dem Folgenden verbinden.
      if (prev && ABBREV_END.test(prev.text)) {
        prev.end = pStart + m.index + trimmed.length;
        prev.text = text.slice(prev.start, prev.end).replace(/\n/g, ' ');
        continue;
      }
      parts.push({ text: trimmed, start: pStart + m.index, end: pStart + m.index + trimmed.length, para });
    }
    out.push(...parts);
    para++;
  }
  return out;
}

/** Absätze (Leerzeile als Trenner), getrimmt, ohne leere. */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/** Lesezeit in Minuten bei 150 Wörtern je Minute (Plan §4.1), mindestens 1. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 150));
}
