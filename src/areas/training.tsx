import { z } from 'zod';
import type { FocusApi } from '../app/registry';
import { defineArea } from '../app/registry';
import { useNav } from '../app/nav';
import { useSettings } from '../app/settings';
import { EntryList } from '../app/shell/Hub';
import { InboxScreen } from '../features/inbox/InboxScreen';
import { inboxResume, startInbox } from '../features/inbox/session';
import { NbDrillScreen } from '../features/nbdrill/NbDrillScreen';
import { drillResume, startDrill, type DrillSet } from '../features/nbdrill/session';
import { installResumeSaver } from '../features/nbdrill/shared';
import { P7_UNIT_BLOCKS } from '../features/nbdrill/unitBlocks';
import { PressureScreen } from '../features/pressure/PressureScreen';
import { pressureResume, startPressure } from '../features/pressure/session';
import { PronScreen } from '../features/pron/PronScreen';
import { pronResume, startShadow } from '../features/pron/session';

// Bereich „Training“ (neue Übungen: Tipp-Drills, Druck-Serie, Posteingang, Nachsprechen) –
// Besitz: Paket P7 (docs/neubau/plan.md §4.8). Einstiege auf den Plätzen `learn` (Training),
// `speak` (Training, Aussprache) und `write` (Posteingang), je ≤ 2 Tipps ab dem Reiter; Routen
// `nbdrill`, `pressure`, `inbox`, `pron` (plan.md §1.6) per Deklarations-Zusammenführung.
// Eigene Einstiegs-Gruppen (`nb-*`), damit nichts doppelt mit P2/P5 erscheint.

declare module '../app/router/types' {
  interface RouteParams {
    nbdrill: { set: 'colloc' | 'transform'; n?: number };
    pressure: NoParams;
    inbox: { id?: string };
    pron: { kind: 'shadow' | 'stress' | 'numbers'; src?: string };
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

function LearnSection() {
  return <EntryList place="learn" group="nb-learn" title="nbTrainingSecLearn" />;
}
function SpeakSection() {
  return <EntryList place="speak" group="nb-speak" title="nbTrainingSecSpeak" />;
}
function PronSection() {
  return <EntryList place="speak" group="nb-pron" title="nbTrainingSecPron" />;
}
function WriteSection() {
  return <EntryList place="write" group="nb-write" title="nbTrainingSecWrite" />;
}

const RESUMABLES = [drillResume, pressureResume, inboxResume, pronResume] as const;

export const training = defineArea({
  id: 'training',
  screens: {
    nbdrill: {
      kind: 'exercise',
      component: NbDrillScreen,
      params: z.object({ set: z.enum(['colloc', 'transform']), n: z.number().int().min(1).max(10).optional() }),
    },
    pressure: { kind: 'exercise', component: PressureScreen },
    inbox: { kind: 'exercise', component: InboxScreen, params: z.object({ id: z.string().optional() }) },
    pron: { kind: 'exercise', component: PronScreen, params: z.object({ kind: z.enum(['shadow', 'stress', 'numbers']), src: z.string().optional() }) },
  },
  sections: [
    { id: 'nb-training-learn', place: 'learn', order: 60, component: LearnSection },
    { id: 'nb-training-speak', place: 'speak', order: 60, component: SpeakSection },
    { id: 'nb-training-pron', place: 'speak', order: 61, component: PronSection },
    { id: 'nb-training-write', place: 'write', order: 60, component: WriteSection },
  ],
  entries: [
    { id: 'training-colloc', place: 'learn', group: 'nb-learn', order: 50, label: 'nbTrainingColloc', sub: 'nbTrainingCollocSub', icon: 'grid', start: drillStart('colloc') },
    { id: 'training-transform', place: 'learn', group: 'nb-learn', order: 51, label: 'nbTrainingTransform', sub: 'nbTrainingTransformSub', icon: 'refresh', start: drillStart('transform') },
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
    {
      id: 'training-shadow',
      place: 'speak',
      group: 'nb-pron',
      order: 50,
      label: 'nbTrainingShadow',
      sub: 'nbTrainingShadowSub',
      icon: 'speaker',
      start: () => {
        if (startShadow({})) go({ name: 'pron', kind: 'shadow' });
      },
    },
    {
      id: 'training-inbox',
      place: 'write',
      group: 'nb-write',
      order: 50,
      label: 'nbTrainingInbox',
      sub: 'nbTrainingInboxSub',
      icon: 'send',
      start: () => {
        if (startInbox({ lang: lang() })) go({ name: 'inbox' });
      },
    },
  ],
  resumables: RESUMABLES,
  unitBlocks: P7_UNIT_BLOCKS,
  boot: () => {
    for (const r of RESUMABLES) installResumeSaver(r as never);
  },
});
