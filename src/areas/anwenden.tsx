import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { ApplyHub } from '../features/apply/ApplyHub';
import { ComboSentenceScreen } from '../features/apply/ComboSentence';
import { ListenQuestionScreen } from '../features/apply/ListenQuestion';
import { RepairRoundScreen } from '../features/apply/RepairRound';
import { TempoRoundScreen } from '../features/c1x/TempoRound';

// Bereich „Anwenden“ (Emrahs Wunsch 04.10.2026, „Go Anwenden“): vierter Lernreiter neben Wortschatz und Grammatik.
// Hier wird das Gelernte kombiniert benutzt – Diktat, Hörschleife, Lücke, Satzbau, Rollenspiel. Freiwillig, nie Pflicht.

declare module '../app/router/types' {
  interface RouteParams {
    apply: NoParams;
    /** „Fehler korrigieren“: freiwillige Runde mit fälligen Reparatur-Sätzen. */
    repairRound: NoParams;
    /** Tempo-Runde (Lernplattform 3.0 P24): zwölf kurze Aufgaben zu sicheren Mustern, mit Zielzeit. */
    tempoRound: NoParams;
    /** Hörübung mit Frage zu eigenen Wörtern (Sprachausgabe, Claude schreibt die Texte). */
    listenQ: NoParams;
    /** „Eigener Satz“: Wort + Grammatikregel im selben Satz, Claude prüft. */
    comboSentence: NoParams;
  }
}

/** Reiter-Wurzel: der Hub, darunter die Abschnitte des Platzes `apply`. */
function ApplyRoot() {
  return (
    <>
      <ApplyHub />
      <HubSections places={placesOf('apply')} />
    </>
  );
}

export const anwenden = defineArea({
  id: 'anwenden',
  screens: {
    apply: { kind: 'tab', component: ApplyRoot, title: 'apTitle', keepScroll: true },
    repairRound: { kind: 'exercise', component: RepairRoundScreen, title: 'apRepair' },
    tempoRound: { kind: 'exercise', component: TempoRoundScreen, title: 'cxTempoTitle' },
    listenQ: { kind: 'exercise', component: ListenQuestionScreen, title: 'apListenQ' },
    comboSentence: { kind: 'exercise', component: ComboSentenceScreen, title: 'apComboOwn' },
  },
});
