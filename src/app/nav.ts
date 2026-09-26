import { create } from 'zustand';

// Navigation ohne Router und ohne History-API (im iframe teilt sich der Verlauf mit claude.ai).
// Start ist immer „Heute" (Kap. 2.1).

export type Route =
  | { name: 'today' }
  | { name: 'overview' }
  | { name: 'trainer'; round: 'pflicht' | 'extra' }
  // Phase 2 (docs/phase2-plan.md §3): Reiter „Lernen" mit Kurs, Grammatik und Übungen.
  | { name: 'learn' }
  | { name: 'course' }
  | { name: 'lesson'; id: string }
  | { name: 'grammar' }
  | { name: 'grammarSession'; mode: 'duty' | 'xtra' | 'errors' | 'topic'; topic?: string }
  | { name: 'drill'; kind: 'dictate' | 'cloze' | 'order' | 'sprint'; ctx: 'duty' | 'xtra' }
  // Funktionsabgleich M1 (Wortschatz) und M8 (Nachschlagewerk „Wissen").
  | { name: 'vocab' }
  | { name: 'wissen' };

export type RouteName = Route['name'];

/** Reiter der Navigation (M13). Sprechen und Entdecken kommen erst mit ihren Bildschirmen dazu. */
export type TabName = 'today' | 'learn' | 'overview';

/** Zu welchem Reiter gehört ein Bildschirm? Übungen und Trainer zählen zu keinem Reiter (Vollbild). */
export function tabOf(name: RouteName): TabName | null {
  switch (name) {
    case 'today':
      return 'today';
    case 'overview':
      return 'overview';
    case 'learn':
    case 'course':
    case 'grammar':
    case 'vocab':
    case 'wissen':
      return 'learn';
    default:
      return null;
  }
}

/** Listen, deren Bildlaufposition gemerkt wird (M13). */
const SCROLL_KEEP: ReadonlySet<RouteName> = new Set(['learn', 'course', 'grammar', 'vocab', 'wissen', 'overview']);

type NavState = {
  route: Route;
  /** Bildlaufposition je Liste (nur im Speicher, Bequemlichkeit). */
  scroll: Partial<Record<RouteName, number>>;
  go: (route: Route) => void;
};

export const useNav = create<NavState>((set, get) => ({
  route: { name: 'today' },
  scroll: {},
  go(route) {
    const cur = get().route;
    const scroll = { ...get().scroll };
    if (SCROLL_KEEP.has(cur.name) && typeof window !== 'undefined') scroll[cur.name] = window.scrollY;
    set({ route, scroll });
  },
}));

/** Gemerkte Position eines Bildschirms (0, wenn keine Liste oder noch nie besucht). */
export function savedScroll(name: RouteName): number {
  return SCROLL_KEEP.has(name) ? (useNav.getState().scroll[name] ?? 0) : 0;
}
