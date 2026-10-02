import { exerciseDef } from './modes';
import type { ExerciseId } from './types';

// Gewicht einer richtigen Antwort für die Planung (Methodenplan Lernwissenschaft 02.10.2026, vgl. `modeBonus` der alten App):
// Wiedererkennen aus Auswahlmöglichkeiten beweist weniger als freies Abrufen. FSRS nimmt jede Note als gleich starken Beleg;
// deshalb wächst die Stabilität bei Auswahl und Stütze nur anteilig: S' = S + w · (S_fsrs − S).

export const NOTE_WEIGHT = { choice: 0.55, help: 0.8, free: 1, produce: 1.1 } as const;

/** Gewicht der Antwort je Übungsart; `hint` = genutzter Tipp (1 Platzhalter, 2 erster Buchstabe) macht aus freiem Tippen eine Stützung. */
export function noteWeight(ex: ExerciseId, hint: 0 | 1 | 2 = 0): number {
  if (ex === 'flip') return NOTE_WEIGHT.free;
  const input = exerciseDef(ex).input;
  if (input === 'choice' || input === 'spot') return NOTE_WEIGHT.choice;
  if (input === 'produce') return NOTE_WEIGHT.produce;
  if (input === 'tiles' || ex === 'cloze_hint') return NOTE_WEIGHT.help;
  return hint > 0 ? NOTE_WEIGHT.help : NOTE_WEIGHT.free;
}
