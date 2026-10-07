import { ExplainMine, type ExplainMineProps } from '../../features/tutor/ExplainMine';

// „Erklär mir meine Antwort“ (KI-Tutor): Einstieg der Übungen. Seit Lernplattform 3.0 P26 steckt der Ablauf in `features/tutor/ExplainMine`
// (Vermutung zuerst, `explain-answer@2`, Ergebnis in der Datenbank, Kennzeichnung und Melden). Die Übungen rufen weiter `<TutorButton … />`
// mit `taskKey` und `vars`; neu sind nur die optionalen Angaben (volles Muster, Speicherort, „Ich lag richtig“, „Einmal richtig schreiben“).
// Tagesbremse: höchstens 20 Aufrufe je Tag und Gerät (src/ai/tutorBudget.ts).

export type TutorButtonProps = ExplainMineProps;

export function TutorButton(props: TutorButtonProps) {
  return <ExplainMine {...props} />;
}
