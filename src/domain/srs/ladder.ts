import type { Grade, Stage } from './types';

// Fünfstufige Leiter mit den Formeln der alten App (Daten-Entwurf §1.4), damit `stage`
// für beide Apps dieselbe Bedeutung behält: 0 Neu · 1 Erkennen · 2 Zuordnen ·
// 3 Mit Stütze abrufen · 4 Frei abrufen · 5 Sicher anwenden.

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const clampStage = (v: number): Stage => Math.min(5, Math.max(0, Math.round(v))) as Stage;

/** Stufe einer Karte; fehlt `stage` (41 echte Karten), gilt die Ersatzregel der alten App. */
export function stageOf(doc: Doc): Stage {
  if (doc.state === 'new' && !num(doc.reps)) return 0;
  if (typeof doc.stage === 'number' && Number.isFinite(doc.stage)) return clampStage(doc.stage);
  const ac = num(doc.ac);
  const pa = num(doc.pa);
  const S = num(doc.S);
  if (ac >= 0.7 && S >= 7) return 5;
  if (ac >= 0.6) return 4;
  if (ac >= 0.3) return 3;
  if (pa >= 0.6) return 2;
  return 1;
}

/**
 * Neue Stufe nach einer Antwort: Aufstieg nur mit einer Übung mindestens der eigenen Stufe,
 * „Leicht" eine Stufe mehr, „Nochmal" höchstens auf die Stufe unter der Übung. Nie unter 1.
 */
/** Ab dieser Übungsstufe ist die Eingabe frei (Tippen ohne Stütze); nur dort springt „Leicht“ eine Stufe weiter. */
export const FREE_LEVEL = 4;

export function nextStage(stage: number, level: number, grade: Grade): Stage {
  const s = Math.max(1, stage);
  if (grade >= 3) {
    if (level < s) return clampStage(s);
    // „Leicht“ springt nie über eine Stufe hinaus (Prüfung Lernwissenschaft 02.10.2026): Auswahl, Stütze und eine einzelne freie Antwort
    // beweisen keinen Sprung um zwei Stufen. Gut und Leicht heben gleich.
    return clampStage(Math.min(5, Math.max(s + 1, Math.min(level, s + 1))));
  }
  // Nochmal: höchstens auf die Stufe unter der Übung, ab Stufe 4 aber nie mehr als eine Stufe tiefer.
  if (grade === 1) return clampStage(Math.max(1, s >= FREE_LEVEL ? Math.max(s - 1, Math.min(s, level - 1)) : Math.min(s, level - 1)));
  return clampStage(s);
}
