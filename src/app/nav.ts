import { create } from 'zustand';
import { keepsScroll, kindOf } from './registry';
import type { Route, RouteName, UnitCtx } from './router/types';
import { START_TAB, TABS, tabOfRoot, type TabId } from './shell/tabs';

// Navigation ohne Router und ohne History-API (im iframe teilt sich der Verlauf mit claude.ai).
// Router-Store des neuen Rahmens (docs/neubau/architektur.md §2.3): je Reiter ein Stapel
// [Wurzel, Seite, Seite …] und darüber eine Übungsebene. Die API bleibt wie bisher:
// `useNav`, `go`, `back`, `leaveBack`, `Route`, `isExercise`, `tabOf`, `savedScroll`.
//
// - `go(Reiter-Wurzel)`: wechselt den Reiter und setzt ihn auf die Wurzel (neue Wurzelparameter).
// - `go(Seite)`: legt die Seite auf den Stapel des aktiven Reiters. Die Herkunft bleibt so immer
//   der Ort, von dem man kam. Ist sie gleich dem Eintrag darunter, wirkt es wie `back()`.
// - `go(Übung)`: öffnet die Übungsebene über der Herkunft. Übung → Übung ersetzt den Eintrag –
//   eine beendete Übung ist nie ein Rückweg.
// - `back()`: schließt die Übungsebene, sonst eine Seite zurück; auf der Wurzel passiert nichts.
//
// Die Bildschirm-Ebene (`tab`/`page`/`exercise`) meldet jeder Bereich in `src/areas/*.tsx` an.

export type { Route, RouteName, UnitCtx };


/** Reiter der Navigation (Daten in `shell/tabs.ts`). */
export type TabName = TabId;

export const TAB_ROOTS: readonly RouteName[] = TABS.map((t) => t.root.name);

/** Startseite eines Reiters (nie ein Zurück-Pfeil). */
export const isTabRoot = (name: RouteName): boolean => kindOf(name) === 'tab';

/** Vollbild-Übungen: ohne Reiterleiste, mit der gemeinsamen Übungsleiste. */
export const isExercise = (name: RouteName): boolean => kindOf(name) === 'exercise';

/**
 * Zu welchem Reiter gehört ein Bildschirm? Reiter-Wurzeln zu ihrem Reiter, Seiten zum aktiven
 * Reiter (sie liegen auf dessen Stapel), Übungen zu keinem (Vollbild, Übungsleiste).
 */
export function tabOf(name: RouteName): TabName | null {
  const kind = kindOf(name);
  if (kind === 'exercise') return null;
  if (kind === 'tab') return tabOfRoot(name);
  return useNav.getState().tab;
}

const STACK_MAX = 20;

const same = (a: Route | undefined, b: Route): boolean => !!a && JSON.stringify(a) === JSON.stringify(b);

type Overlay = { route: Route; origin: TabName };

type Core = {
  /** Aktiver Reiter. */
  tab: TabName;
  /** Je Reiter: [Wurzel, Seite, Seite …] (nur im Speicher). */
  stacks: Readonly<Record<TabName, readonly Route[]>>;
  /** Übungsebene (Player) über der Herkunft. */
  overlay: Overlay | null;
};

type NavState = Core & {
  /** Abgeleitet: sichtbarer Bildschirm (`overlay?.route ?? oben auf dem Stapel`). */
  route: Route;
  /** Abgeleitet: Herkunftskette (oben = direkte Herkunft), wie bisher. */
  stack: readonly Route[];
  /** Bildlaufposition je Liste (nur im Speicher, Bequemlichkeit). */
  scroll: Partial<Record<RouteName, number>>;
  go: (route: Route) => void;
  /** Zurück dorthin, woher man kam; auf einer Reiter-Wurzel passiert nichts. */
  back: () => void;
  /** Ersetzt den sichtbaren Eintrag (gleiche Ebene), ohne die Herkunft zu ändern. */
  replace: (route: Route) => void;
  /** Tipp auf einen Reiter: fremder Reiter → dessen Stapel; aktiver Reiter → zurück zur Wurzel. */
  switchTab: (tab: TabName) => void;
};

const top = (s: readonly Route[]): Route | undefined => s[s.length - 1];

function rootOf(tab: TabName): Route {
  return TABS.find((t) => t.id === tab)?.root ?? TABS[0].root;
}

function initialStacks(): Record<TabName, readonly Route[]> {
  const out = {} as Record<TabName, readonly Route[]>;
  for (const t of TABS) out[t.id] = [t.root];
  return out;
}

/** Abgeleitete Felder – dieselben Route-Objekte, damit `leaveBack` Gleichheit prüfen kann. */
function derive(c: Core): { route: Route; stack: readonly Route[] } {
  const s = c.stacks[c.tab];
  if (c.overlay) return { route: c.overlay.route, stack: c.stacks[c.overlay.origin] };
  return { route: top(s) ?? rootOf(c.tab), stack: s.slice(0, -1) };
}

function keepScroll(cur: Route, scroll: Partial<Record<RouteName, number>>): Partial<Record<RouteName, number>> {
  if (!keepsScroll(cur.name) || typeof window === 'undefined') return scroll;
  return { ...scroll, [cur.name]: window.scrollY };
}

function withStack(c: Core, tab: TabName, stack: readonly Route[]): Record<TabName, readonly Route[]> {
  return { ...c.stacks, [tab]: stack };
}

/** Reiner Übergang (testbar ohne Store): Kern + Ziel → neuer Kern. */
export function navigate(c: Core, route: Route): Core {
  const kind = kindOf(route.name);
  if (kind === 'tab') {
    const tab = tabOfRoot(route.name) ?? c.tab;
    return { tab, stacks: withStack(c, tab, [route]), overlay: null };
  }
  if (kind === 'exercise') {
    if (c.overlay) return { ...c, overlay: { route, origin: c.overlay.origin } };
    return { ...c, overlay: { route, origin: c.tab } };
  }
  // Seite: auf den Stapel des aktiven Reiters (bzw. der Herkunft der Übung).
  const tab = c.overlay ? c.overlay.origin : c.tab;
  const s = c.stacks[tab];
  const cur = top(s);
  if (c.overlay && same(cur, route)) return { tab, stacks: c.stacks, overlay: null };
  if (s.length >= 2 && same(s[s.length - 2], route)) return { tab, stacks: withStack(c, tab, s.slice(0, -1)), overlay: null };
  if (cur && cur.name === route.name && s.length > 1) return { tab, stacks: withStack(c, tab, [...s.slice(0, -1), route]), overlay: null };
  return { tab, stacks: withStack(c, tab, [...s, route].slice(-STACK_MAX)), overlay: null };
}

/** Reiner Rückweg: Übungsebene schließen, sonst eine Seite zurück; auf der Wurzel nichts. */
export function goBack(c: Core): Core {
  if (c.overlay) return { tab: c.overlay.origin, stacks: c.stacks, overlay: null };
  const s = c.stacks[c.tab];
  if (s.length > 1) return { ...c, stacks: withStack(c, c.tab, s.slice(0, -1)) };
  return c;
}

const initialCore: Core = { tab: START_TAB, stacks: initialStacks(), overlay: null };

export const useNav = create<NavState>((set, get) => {
  const apply = (next: Core) => {
    const { route: cur, scroll } = get();
    const d = derive(next);
    if (d.route === cur && next.stacks === get().stacks && next.overlay === get().overlay && next.tab === get().tab) return;
    set({ ...next, ...d, scroll: keepScroll(cur, scroll) });
  };
  return {
    ...initialCore,
    ...derive(initialCore),
    scroll: {},
    go(route) {
      apply(navigate(get(), route));
    },
    back() {
      apply(goBack(get()));
    },
    replace(route) {
      const c = get();
      if (c.overlay) {
        apply({ ...c, overlay: { route, origin: c.overlay.origin } });
        return;
      }
      const s = c.stacks[c.tab];
      apply({ ...c, stacks: withStack(c, c.tab, [...s.slice(0, -1), route]) });
    },
    switchTab(tab) {
      const c = get();
      if (tab === c.tab && !c.overlay) {
        const root = c.stacks[tab][0] ?? rootOf(tab);
        apply({ ...c, stacks: withStack(c, tab, [root]) });
        return;
      }
      apply({ ...c, tab, overlay: null });
    },
  };
});

/** Gemerkte Position eines Bildschirms (0, wenn keine Liste oder noch nie besucht). */
export function savedScroll(name: RouteName): number {
  return keepsScroll(name) ? (useNav.getState().scroll[name] ?? 0) : 0;
}

/**
 * Zurück zur Herkunft, nachdem `leave` aufgeräumt hat. Hat `leave` selbst schon navigiert,
 * passiert nichts mehr – so führt kein Schließen-Knopf doppelt zurück.
 */
export function leaveBack(leave?: () => void): void {
  const before = useNav.getState().route;
  leave?.();
  if (useNav.getState().route === before) useNav.getState().back();
}
