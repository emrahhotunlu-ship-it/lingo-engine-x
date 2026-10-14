import type { TrainCard } from './types';

// Kernwörter (Wörter aktivieren, Stufe 2): Wörter aus Lektionen, Startwortschatz und den C1-Paketen – Berufswortschatz. Eine Quelle für Fahrplan (A5) und
// Aufgabenbau (Lagen aus dem Beruf).

/** Quellen der Kernwörter; auch Wendungen aus Kurslektionen (`lesson`, Lernwissenschaft N4). */
export const CORE_SRC: ReadonlySet<string> = new Set(['lesson', 'seed', 'pack']);
export const isCoreWord = (card: Pick<TrainCard, 'src' | 'doc'>): boolean => card.doc.core === true || (card.src !== null && CORE_SRC.has(card.src));
