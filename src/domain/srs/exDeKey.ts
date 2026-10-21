import { hash32 } from '../random';

// Schlüssel für gespeicherte Übersetzungen von Beispielsätzen (`exDe`). Eigenes, schlankes Modul, damit auch Tests ohne die
// ganze Beispiel-Logik (und deren Inhalts-Importe) denselben Schlüssel bilden.

/** Normalisierter Satz: klein, typografische Apostrophe vereinheitlicht, nur Buchstaben, Ziffern, Apostroph und einfache Leerzeichen. */
export const exampleKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Schlüssel der Übersetzung eines Beispielsatzes: Hash des normalisierten englischen Satzes. */
export const exDeKey = (en: string): string => `s${hash32(exampleKey(en)).toString(36)}`;
