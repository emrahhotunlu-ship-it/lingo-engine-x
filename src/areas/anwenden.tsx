import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { ApplyHub } from '../features/apply/ApplyHub';
import { ListenQuestionScreen } from '../features/apply/ListenQuestion';
import { RepairRoundScreen } from '../features/apply/RepairRound';

// Bereich „Anwenden“ (Emrahs Wunsch 04.10.2026, „Go Anwenden“): vierter Lernreiter neben Wortschatz und Grammatik.
// Hier wird das Gelernte kombiniert benutzt – Diktat, Hörschleife, Lücke, Satzbau, Rollenspiel. Freiwillig, nie Pflicht.

declare module '../app/router/types' {
  interface RouteParams {
    apply: NoParams;
    /** „Fehler korrigieren“: freiwillige Runde mit fälligen Reparatur-Sätzen. */
    repairRound: NoParams;
    /** Hörübung mit Frage zu eigenen Wörtern (Sprachausgabe, Claude schreibt die Texte). */
    listenQ: NoParams;
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
    listenQ: { kind: 'exercise', component: ListenQuestionScreen, title: 'apListenQ' },
  },
});
