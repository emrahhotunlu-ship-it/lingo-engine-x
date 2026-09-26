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
  | { name: 'drill'; kind: 'dictate' | 'cloze' | 'order' | 'sprint'; ctx: 'duty' | 'xtra' };

type NavState = { route: Route; go: (route: Route) => void };

export const useNav = create<NavState>((set) => ({
  route: { name: 'today' },
  go(route) {
    set({ route });
  },
}));
