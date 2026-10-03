import { z } from 'zod';
import { useClock } from '../app/clock';
import { defineArea } from '../app/registry';
import { loadResume, setResumeRowHidden, type Resumable } from '../app/resume';
import type { Route } from '../app/router/types';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { setUnitDoneHandler } from '../app/unit/done';
import { CheckScreen } from '../features/check/CheckScreen';
import { checkResumable, ensureCheck } from '../features/check/resume';
import { PhoneModeSection } from '../features/settings/PhoneModeSection';
import { TodayScreen } from '../features/today/TodayScreen';
import { todayNow, useToday } from '../features/today/state';
import { UnitCardScreen } from '../features/unit/UnitCard';
import { UnitStepScreen } from '../features/unit/UnitStep';
import { handleUnitDone, installUnitWatch } from '../features/unit/run';
import { EMPTY_RUN, useUnitRun, type UnitRun } from '../features/unit/runStore';
import { WeekPage } from '../features/week/WeekPage';
import { startWeekWatch } from '../features/week/store';
import { useCapabilities } from '../platform/capabilities';
import { useT } from '../i18n';

// Bereich „Heute“ – Besitz: Paket P1 (plan.md §4.2): Heute-Wurzel mit der Tageskarte, die
// Tageseinheit als Kette im Player (Zwischen-/Bestätigungskarte, Ersatzschritte), Wochen-Check und
// die Seite „Deine Woche“ (Einstieg auf Üben › Dein Weg).

declare module '../app/router/types' {
  interface RouteParams {
    today: NoParams;
    check: NoParams;
    week: NoParams;
    unitCard: { step: 'confirm' | 'next' };
    unitStep: { step: 'input' | 'again' | 'check'; block: number };
  }
}

/** Reiter-Wurzel: Tageskarte, darunter die Abschnitte des Platzes `today`. */
function TodayRoot() {
  return (
    <>
      <TodayScreen />
      <HubSections places={placesOf('today')} />
    </>
  );
}

/** Zahl offener Blöcke am Reiter „Heute“ – dieselbe Ableitung wie Ring und Blockliste (Kap. 2.2). */
function useOpenDuties(): number {
  return useToday((st) => (st.ready && st.dayLoaded && st.status === 'open' ? st.duties.total - st.duties.done : 0));
}

/**
 * Zeile unter dem Balken: „Tageseinheit · Block 2 von 5“, solange eine Übung ein Block der Einheit ist.
 * Nicht auf der Zwischen-/Bestätigungskarte: Die nennt den Stand selbst (Kap. 2.2, eine Zahl).
 */
function useUnitNote(route: Route): string | null {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const runDay = useUnitRun((s) => s.day);
  const runRoute = useUnitRun((s) => s.routeName);
  const duty = useUnitRun((s) => s.duty);
  const duties = useToday((s) => s.plan?.duty);
  if (route.name === 'unitCard' || runDay !== today || !duty || !duties || (runRoute !== route.name && route.name !== 'unitStep')) return null;
  const n = duties.indexOf(duty as (typeof duties)[number]) + 1;
  return n > 0 ? t('nbHeuteNote', { n, total: duties.length }) : null;
}

type UnitSnap = Pick<UnitRun, 'day' | 'block' | 'duty' | 'kind' | 'via' | 'watch' | 'routeName' | 'route' | 'sentences' | 'phrases' | 'task' | 'confirmed' | 'offline' | 'at' | 'draft'>;

/** Fortsetzen der Einheit (G3): Block, Ersatzweg, Ergebnisse für Block 4/5, Entwurf. */
export const unitResumable: Resumable<UnitSnap> = {
  id: 'unit',
  version: 1,
  origin: 'today',
  snapshot() {
    const s = useUnitRun.getState();
    if (!s.day || !s.block || !s.route) return null;
    // Einheit fertig: nichts mehr fortzusetzen (erledigt ist Zustand).
    const st = todayNow();
    if (st.day === s.day && st.status === 'allDone') return null;
    const { day, block, duty, kind, via, watch, routeName, route, sentences, phrases, task, confirmed, offline, at, draft } = s;
    return { day, block, duty, kind, via, watch, routeName, route, sentences, phrases, task, confirmed, offline, at, draft };
  },
  subscribe: (cb) => useUnitRun.subscribe(cb),
  restore(s) {
    if (!s || s.day !== useClock.getState().today || !s.route) return false;
    useUnitRun.setState({ ...EMPTY_RUN, ...s }, true);
    return true;
  },
  route: (s) => s.route ?? { name: 'today' },
  label: (s, t) => {
    const duties = todayNow().plan?.duty ?? [];
    const n = duties.indexOf((s.duty ?? '') as (typeof duties)[number]) + 1;
    return t('nbHeuteResumeUnit', { n: n || (s.block ?? 1), total: duties.length || 5 });
  },
};

let booted = false;

export const heute = defineArea({
  id: 'heute',
  screens: {
    today: { kind: 'tab', component: TodayRoot, title: 'navToday' },
    check: { kind: 'exercise', component: CheckScreen, title: 'ckTitle', ensure: ensureCheck },
    week: { kind: 'page', component: WeekPage, title: 'nbHeuteWeekTitle', keepScroll: true },
    unitCard: { kind: 'exercise', component: UnitCardScreen, title: 'nbHeuteUnit', params: z.object({ step: z.enum(['confirm', 'next']) }) },
    unitStep: { kind: 'exercise', component: UnitStepScreen, title: 'nbHeuteUnit', params: z.object({ step: z.enum(['input', 'again', 'check']), block: z.coerce.number().int().min(1).max(5) }) },
  },
  entries: [{ id: 'hub-week', place: 'learn', group: 'path', order: 5, label: 'nbHeuteWeekEntry', sub: 'nbHeuteWeekEntrySub', icon: 'target', route: { name: 'week' } }],
  settings: [{ id: 'phone-mode', group: 'learn', order: 20, component: PhoneModeSection }],
  badge: { id: 'openDuties', use: useOpenDuties },
  playerNote: { use: useUnitNote },
  resumables: [unitResumable, checkResumable],
  boot: () => {
    if (booted) return;
    booted = true;
    setUnitDoneHandler(handleUnitDone);
    // Keine zusätzliche „Weitermachen“-Zeile für Blöcke der Einheit: Die Tageskarte führt weiter.
    setResumeRowHidden((p) => {
      if (p.env.id === 'unit') return true;
      const u = loadResume('unit');
      const r = (u?.data as { route?: unknown } | undefined)?.route;
      return !!u && u.day === p.env.day && JSON.stringify(r) === JSON.stringify(p.env.route);
    });
    installUnitWatch();
    // Ein Abo auf `app/week`, sobald die Datenbank bereit ist (parallel zu den Live-Abos, N14).
    if (useCapabilities.getState().db === 'ready') startWeekWatch();
    else {
      const unsub = useCapabilities.subscribe((s) => {
        if (s.db !== 'ready') return;
        unsub();
        startWeekWatch();
      });
    }
  },
});
