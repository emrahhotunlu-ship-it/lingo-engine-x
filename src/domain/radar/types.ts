// Fehlerkategorien und Fehlerstellen eines Textes (Fehler-Radar, Reparatur-Sätze).

export type ErrorCat = 'grammar' | 'vocabulary' | 'collocation' | 'spelling' | 'punctuation' | 'register' | 'coherence' | 'word-order' | 'other';

export const ERROR_CATS: readonly ErrorCat[] = ['grammar', 'vocabulary', 'collocation', 'spelling', 'punctuation', 'register', 'coherence', 'word-order', 'other'];

export type TextError = {
  orig: string;
  fix: string;
  cat: ErrorCat;
  topic: string | null;
  sev: 'minor' | 'major';
  why: string;
  span: [number, number] | null;
};
