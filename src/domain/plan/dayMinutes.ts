// Tagesweg (UX-Neuanfang C, Emrahs Entscheidung 02.11.2026): genau EINE Quelle für die Minuten der drei Pflicht-Schritte.
// Wortlaut: „mindestens 10 Minuten und immer 40 % vom Tagesziel“ für die Wörter. Seit 08.11.2026 (Emrah, Wörter-Tempo „A: 10 pro Tag“, „Wörter
// brauchen dann etwa 15–20 Minuten statt 10“) 60 %. Seit 12.11.2026 (Emrah: „70 % Vokabel, 20 % Grammatik, 10 % Anwenden“) 70 %;
// der Rest teilt sich ⅔ Grammatik, ⅓ Anwenden (= 20 % und 10 % des Tagesziels).
// Rein. Heute, die Kopfzeile der Übung, der Start der Wörter-Runde und die Einstellungen lesen alle diese Funktion.

/** Untergrenze der Wörter-Minuten (Emrah: „mindestens 10 Minuten“). */
export const WORDS_MIN = 10;
/** Anteil der Wörter am Tagesziel (Emrah 02.11.: 40 %; 08.11.: 60 %; 12.11.2026: 70 %, bei 30 Minuten also 21). */
export const WORDS_SHARE = 0.7;
/** Anteil der Grammatik am Rest; Anwenden bekommt den Rest. */
export const GRAMMAR_SHARE = 2 / 3;
/** Untergrenzen, damit auch ein kleines Tagesziel drei echte Schritte hat (der Tag wird dann etwas länger als das Ziel). */
export const GRAMMAR_FLOOR = 3;
export const APPLY_FLOOR = 2;

export type DayMinutes = { words: number; grammar: number; apply: number; total: number };

/** Minuten der drei Schritte für ein Tagesziel in Minuten. */
export function dayMinutes(goalMin: number): DayMinutes {
  const goal = Number.isFinite(goalMin) && goalMin > 0 ? Math.round(goalMin) : 25;
  const words = Math.max(WORDS_MIN, Math.round(goal * WORDS_SHARE));
  const rest = Math.max(0, goal - words);
  const grammar = Math.max(GRAMMAR_FLOOR, Math.round(rest * GRAMMAR_SHARE));
  const apply = Math.max(APPLY_FLOOR, rest - grammar);
  return { words, grammar, apply, total: words + grammar + apply };
}

/** Grammatikaufgaben je Runde aus den Minuten (rund 0,8 Aufgaben je Minute, 3 bis 12). */
export const grammarTasksFor = (min: number): number => Math.min(12, Math.max(3, Math.round(min * 0.8)));

/** Fehlersätze, die in die Grammatikrunde eingemischt werden (höchstens 3; nichts fällig → keine). */
export const mixedErrorsFor = (fixDue: number | undefined): number => Math.min(3, Math.max(0, Math.floor(fixDue ?? 0)));
