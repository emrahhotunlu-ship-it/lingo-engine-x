// Gemeinsame Typen für Text, Wörterbuch und Aussprache (Architektur-Entwurf §5.0, §8).
// Reine Typen, keine Laufzeit-Abhängigkeiten.

/** word: Wort (auch don't, company's, e-invoicing) · num: Zahl oder Zeichenfolge mit Ziffern (2026, B2) · space: Leerraum · punct: Satzzeichen */
export type TokenKind = 'word' | 'num' | 'space' | 'punct';

/** Ein Stück Text. `text === quelle.slice(start, end)` (Offsets in UTF-16-Einheiten wie bei `String.prototype.slice`). */
export type Token = { kind: TokenKind; text: string; start: number; end: number };

/** Eine Lücke aus eckigen Klammern im Beispielsatz, bezogen auf den Text ohne Klammern. */
export type GapSpan = { start: number; end: number; text: string };

/**
 * Gefundene Wendung um ein angetipptes Wort.
 * - `phrase`: der Schlüssel, den `isPhrase` bestätigt hat (z. B. „carry out")
 * - `surface`: der Text im Satz (z. B. „carried out")
 * - `first`/`last`: Token-Indizes des ersten und letzten Worts (einschließlich)
 * - `start`/`end`: Zeichen-Offsets im Text
 */
export type PhraseMatch = { phrase: string; surface: string; first: number; last: number; start: number; end: number };

/** Wörterbuch-Zugriff für die Lern-Domäne (Ablenker, Antwortprüfung, Begründung); Entwurf §5.0. */
export type LexDeps = {
  isKnownWord(w: string): boolean;
  dictMeaning(w: string): { pos: string; de: string; def: string } | null;
  wordsByPos(pos: string): readonly string[];
};
