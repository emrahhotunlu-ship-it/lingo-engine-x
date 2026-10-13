// Kleine Textbausteine des Lesen-Moduls (rein).

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Wörter eines Satzes (Zahlen zählen mit; Anführungszeichen werden NICHT entfernt, anders als detect.wordCount). */
export function countWords(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

/** Normalisierte Form für Vergleiche (Titel, Schlüsselwörter): klein, ohne Zeichen außer Buchstaben/Ziffern, ein Leerzeichen. */
export function normKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Typografische Striche: ` - ` wird ` – ` (wie fixDashes der Vokabel-Texte, hier eigene Fassung). */
export function normalizeDashes(text: string): string {
  return text.replace(/ - /g, ' – ');
}

/** Lesezeit in Minuten (130 Wörter je Minute, mindestens 1). */
export function minutesFor(words: number): number {
  return Math.max(1, Math.round(words / 130));
}
