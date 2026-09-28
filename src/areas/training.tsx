import { z } from 'zod';
import { defineArea } from '../app/registry';
import { useSettings } from '../app/settings';
import { useNav } from '../app/nav';
import { drillResume, startDrill, type DrillSet } from '../features/nbdrill/session';
import { NbDrillScreen } from '../features/nbdrill/NbDrillScreen';
import { installResumeSaver } from '../features/nbdrill/shared';
import { EntryList } from '../app/shell/Hub';

/** Abschnitt „Tippen & Umformen“ auf „Üben“ (eigene Gruppe, keine Doppelung mit P2). */
function LearnSection() {
  return <EntryList place="learn" group="nbtraining" title="nbTrainingSecLearn" />;
}

// Bereich „Training“ (neue Übungen: Tipp-Drills, Druck-Serie, Posteingang, Nachsprechen) –
// Besitz: Paket P7 (docs/neubau/plan.md §4.8). Einstiege auf den Plätzen `learn` (Training),
// `speak` (Training, Aussprache) und `write` (Posteingang); Routen `nbdrill`, `pressure`, `inbox`,
// `pron` (plan.md §1.6) per Deklarations-Zusammenführung.

declare module '../app/router/types' {
  interface RouteParams {
    nbdrill: { set: 'colloc' | 'transform'; n?: number };
  }
}

/** Einstieg: Runde synchron im Klick bauen (iPhone-Tastatur), dann öffnen. */
const drillStart = (set: DrillSet) => (api: { focusNow(): void }) => {
  if (!startDrill(set, { lang: useSettings.getState().lang })) return;
  api.focusNow();
  useNav.getState().go({ name: 'nbdrill', set });
};

export const training = defineArea({
  id: 'training',
  screens: {
    nbdrill: {
      kind: 'exercise',
      component: NbDrillScreen,
      params: z.object({ set: z.enum(['colloc', 'transform']), n: z.number().int().min(1).max(10).optional() }),
    },
  },
  sections: [{ id: 'nb-training-learn', place: 'learn', order: 60, component: LearnSection }],
  entries: [
    { id: 'training-colloc', place: 'learn', group: 'nbtraining', order: 50, label: 'nbTrainingColloc', sub: 'nbTrainingCollocSub', icon: 'grid', start: drillStart('colloc') },
    { id: 'training-transform', place: 'learn', group: 'nbtraining', order: 51, label: 'nbTrainingTransform', sub: 'nbTrainingTransformSub', icon: 'refresh', start: drillStart('transform') },
  ],
  resumables: [drillResume],
  boot: () => {
    installResumeSaver(drillResume);
  },
});
