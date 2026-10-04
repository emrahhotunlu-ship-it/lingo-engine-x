import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { ApplyHub } from '../features/apply/ApplyHub';

// Bereich „Anwenden“ (Emrahs Wunsch 04.10.2026, „Go Anwenden“): vierter Lernreiter neben Wortschatz und Grammatik.
// Hier wird das Gelernte kombiniert benutzt – Diktat, Hörschleife, Lücke, Satzbau, Rollenspiel. Freiwillig, nie Pflicht.

declare module '../app/router/types' {
  interface RouteParams {
    apply: NoParams;
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
  },
});
