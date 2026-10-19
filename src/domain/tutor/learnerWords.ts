import { cardEvidence, cardStatusFrom, isFestFrom, type CardEvidence, type CardStatus, type StatusCard, type UnitState } from '../metrics/cardStatus';

// Wort-Teil des Lernermodells (Tutor-Engine v3 §3.1 „Eine Wahrheit“, Scheibe S2): die EINE Stelle, an der Liste, Wortblatt, Übung, Hub,
// Fortschritt, Atlas, Tagesplan-Zahlen und der Schreibweg (`ff`) den Status einer Karte erfahren. Die Regeln selbst stehen in
// `metrics/cardStatus.ts` (Paket ST); aufgerufen werden sie nur von hier und von `learner.ts` (Testregel `tests/tutor/oneTruth.test.ts`).
//
// Leistung: Der Beleg-Teil (Verlauf, ohne Uhrzeit) wird je Dokument-Objekt zwischengespeichert. Unveränderte Dokumente kommen als dasselbe
// Objekt (contract/db.d.ts), also rechnet eine Liste mit 5.000 Karten den Verlauf nur einmal; Abrufwahrscheinlichkeit und Zustand jedes Mal neu.

type Ev = { ctx: string | null; stage: number; e: CardEvidence };
const EV_BY_DOC = new WeakMap<object, Ev>();

/** Beleg-Teil einer Karte (zwischengespeichert je Dokument-Objekt, Ursprungssatz und Stufe). */
export function wordEvidence(c: StatusCard): CardEvidence {
  const ctx = c.context?.sentence ?? null;
  const doc = c.doc as object;
  const hit = EV_BY_DOC.get(doc);
  // Die Stufe zählt im Beleg nur bei alten Karten ohne Verlauf mit, gehört aber sicherheitshalber zum Schlüssel.
  if (hit && hit.ctx === ctx && hit.stage === c.stage) return hit.e;
  const e = cardEvidence(c);
  EV_BY_DOC.set(doc, { ctx, stage: c.stage, e });
  return e;
}

/** Status einer Karte zum Zeitpunkt `nowMs` (dieselbe Rechnung wie `buildLearnerModel().words`). */
export const wordStatus = (c: StatusCard, nowMs: number): CardStatus => cardStatusFrom(c, wordEvidence(c), nowMs);

/** Zustand einer Karte (Neu, Lernt, Wackelt, Sicher, Fest). */
export const wordTier = (c: StatusCard, nowMs: number): UnitState => wordStatus(c, nowMs).tier;

/**
 * Sitzt die Karte fest? Ausgeblendete Karten nie. Mit `nowMs` gilt zusätzlich die Abrufwahrscheinlichkeit (sehr lange Pause → wackelt);
 * ohne `nowMs` nur der Beleg (Schreibweg `ff` mit dem Stand nach der Antwort).
 */
export const wordFest = (c: StatusCard & { hidden?: boolean }, nowMs?: number): boolean => !c.hidden && isFestFrom(c, wordEvidence(c), nowMs);
