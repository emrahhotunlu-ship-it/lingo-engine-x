import { z } from 'zod';
import type { FocusApi } from '../app/registry';
import { defineArea } from '../app/registry';
import { useNav } from '../app/nav';
import { useSettings } from '../app/settings';
import { InboxScreen } from '../features/inbox/InboxScreen';
import { ensureInbox, inboxResume, startInbox } from '../features/inbox/session';
import { NbDrillScreen } from '../features/nbdrill/NbDrillScreen';
import { drillResume, ensureDrill, startDrill, type DrillSet } from '../features/nbdrill/session';
import { P7_UNIT_BLOCKS } from '../features/nbdrill/unitBlocks';
import { PressureScreen } from '../features/pressure/PressureScreen';
import { ensurePressure, pressureResume, startPressure } from '../features/pressure/session';
import { PronScreen } from '../features/pron/PronScreen';
import { PronDrillScreen } from '../features/pron/PronDrillScreen';
import { ensurePronDrill, pronDrillResume, startPronDrill } from '../features/pron/drill';
import type { ScreenProps } from '../app/registry';
import { ensurePron, pronResume, startShadow } from '../features/pron/session';

// Bereich „Training“ (neue Übungen: Tipp-Drills, Druck-Serie, Posteingang, Nachsprechen) –
// Besitz: Paket P7 (docs/neubau/plan.md §4.8). Einstiege auf den Plätzen `learn` (Training),
// `speak` (Training, Aussprache) und `write` (Posteingang), je ≤ 2 Tipps ab dem Reiter; Routen
// `nbdrill`, `pressure`, `inbox`, `pron` (plan.md §1.6) per Deklarations-Zusammenführung.
// Eigene Einstiegs-Gruppen (`nb-*`), damit nichts doppelt mit P2/P5 erscheint.

declare module '../app/router/types' {
  interface RouteParams {
    nbdrill: { set: DrillSet; n?: number };
    pressure: { set?: 'objection' | 'hotseat' | 'buytime' };
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

/** Nachsprechen oder Aussprache-Minute (Betonung, Zahlen) – eine Route `pron`. */
function PronRoute(props: ScreenProps<'pron'>) {
  return props.route.kind === 'shadow' ? <PronScreen {...props} /> : <PronDrillScreen {...props} />;
}

const RESUMABLES = [drillResume, pressureResume, inboxResume, pronResume, pronDrillResume] as const;

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
    inbox: { kind: 'exercise', component: InboxScreen, ensure: (r) => ensureInbox(r, lang()), params: z.object({ id: z.string().optional() }) },
    pron: { kind: 'exercise', component: PronRoute, ensure: (r) => (r.kind === 'shadow' ? ensurePron(r) : ensurePronDrill(r, lang())), params: z.object({ kind: z.enum(['shadow', 'stress', 'numbers']), src: z.string().optional() }) },
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
    {
      id: 'training-hotseat',
      place: 'speak',
      group: 'nb-speak',
      order: 51,
      label: 'nbTrainingHotseat',
      sub: 'nbTrainingHotseatSub',
      icon: 'target',
      start: () => {
        if (startPressure({ lang: lang(), set: 'hotseat', n: 3 })) go({ name: 'pressure', set: 'hotseat' });
      },
    },
    {
      id: 'training-buytime',
      place: 'speak',
      group: 'nb-speak',
      order: 52,
      label: 'nbTrainingBuytime',
      sub: 'nbTrainingBuytimeSub',
      icon: 'history',
      start: () => {
        if (startPressure({ lang: lang(), set: 'buytime', n: 5 })) go({ name: 'pressure', set: 'buytime' });
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
      id: 'training-stress',
      place: 'speak',
      group: 'nb-pron',
      order: 51,
      label: 'nbTrainingStress',
      sub: 'nbTrainingStressSub',
      icon: 'target',
      start: () => {
        if (startPronDrill('stress', lang())) go({ name: 'pron', kind: 'stress' });
      },
    },
    {
      id: 'training-numbers',
      place: 'speak',
      group: 'nb-pron',
      order: 52,
      label: 'nbTrainingNumbers',
      sub: 'nbTrainingNumbersSub',
      icon: 'chart',
      start: () => {
        if (startPronDrill('numbers', lang())) go({ name: 'pron', kind: 'numbers' });
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
});
