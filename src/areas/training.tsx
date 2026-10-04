import { z } from 'zod';
import type { FocusApi } from '../app/registry';
import { defineArea } from '../app/registry';
import { useNav } from '../app/nav';
import { useSettings } from '../app/settings';
import { NbDrillScreen } from '../features/nbdrill/NbDrillScreen';
import { drillResume, ensureDrill, startDrill, type DrillSet } from '../features/nbdrill/session';
import { PressureScreen } from '../features/pressure/PressureScreen';
import { ensurePressure, pressureResume, startPressure } from '../features/pressure/session';

// Bereich „Training“ (neue Übungen: Tipp-Drills, Druck-Serie, Posteingang, Nachsprechen) –
// Besitz: Paket P7 (docs/neubau/plan.md §4.8). Einstiege auf den Plätzen `learn` (Training),
// `speak` (Training, Aussprache) und `write` (Posteingang), je ≤ 2 Tipps ab dem Reiter; Routen
// `nbdrill`, `pressure`, `inbox`, `pron` (plan.md §1.6) per Deklarations-Zusammenführung.
// Eigene Einstiegs-Gruppen (`nb-*`), damit nichts doppelt mit P2/P5 erscheint.

declare module '../app/router/types' {
  interface RouteParams {
    nbdrill: { set: DrillSet; n?: number };
    pressure: { set?: 'objection' | 'hotseat' | 'buytime' };
  }
}

const lang = () => useSettings.getState().lang;
const go = (r: Parameters<ReturnType<typeof useNav.getState>['go']>[0]) => useNav.getState().go(r);

/** Einstiege bauen die Sitzung synchron im Klick (iPhone-Tastatur), dann öffnet sich die Übung. */
const drillStart = (set: DrillSet) => (api: FocusApi) => {
  if (!startDrill(set, { lang: lang() })) return;
  api.focusNow();
  go({ name: 'nbdrill', set });
};

const RESUMABLES = [drillResume, pressureResume] as const;

export const training = defineArea({
  id: 'training',
  screens: {
    nbdrill: {
      kind: 'exercise',
      component: NbDrillScreen,
      ensure: (r) => ensureDrill(r, lang()),
      params: z.object({ set: z.enum(['colloc', 'transform', 'wordform', 'register', 'phrasal', 'transition']), n: z.number().int().min(1).max(10).optional() }),
    },
    pressure: { kind: 'exercise', component: PressureScreen, ensure: (r) => ensurePressure(r, lang()), params: z.object({ set: z.enum(['objection', 'hotseat', 'buytime']).optional() }) },
  },
  // Keine eigenen Abschnitte: Die Reiter-Wurzeln (Üben, Sprechen/Schreiben) zeigen die Einstiege
  // aller Bereiche selbst – ein zusätzlicher Abschnitt hätte jeden Einstieg doppelt gezeigt (Kap. 15).
  entries: [
    { id: 'training-colloc', place: 'learn', group: 'nb-learn', order: 50, label: 'nbTrainingColloc', sub: 'nbTrainingCollocSub', icon: 'grid', start: drillStart('colloc') },
    { id: 'training-transform', place: 'learn', group: 'nb-learn', order: 51, label: 'nbTrainingTransform', sub: 'nbTrainingTransformSub', icon: 'refresh', start: drillStart('transform') },
    { id: 'training-wordform', place: 'learn', group: 'nb-learn', order: 52, label: 'nbTrainingWordform', sub: 'nbTrainingWordformSub', icon: 'layers', start: drillStart('wordform') },
    { id: 'training-register', place: 'learn', group: 'nb-learn', order: 53, label: 'nbTrainingRegister', sub: 'nbTrainingRegisterSub', icon: 'sliders', start: drillStart('register') },
    { id: 'training-phrasal', place: 'learn', group: 'nb-learn', order: 54, label: 'nbTrainingPhrasal', sub: 'nbTrainingPhrasalSub', icon: 'chat', start: drillStart('phrasal') },
    { id: 'training-transition', place: 'learn', group: 'nb-learn', order: 55, label: 'nbTrainingTransition', sub: 'nbTrainingTransitionSub', icon: 'link', start: drillStart('transition') },
    {
      id: 'training-objection',
      place: 'speak',
      group: 'nb-speak',
      order: 50,
      label: 'nbTrainingObjection',
      sub: 'nbTrainingObjectionSub',
      icon: 'bolt',
      start: () => {
        if (startPressure({ lang: lang() })) go({ name: 'pressure' });
      },
    },
  ],
  resumables: RESUMABLES,
});
