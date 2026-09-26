import { create } from 'zustand';

// Navigation ohne Router und ohne History-API (im iframe teilt sich der Verlauf mit claude.ai).
// Start ist immer „Heute" (Kap. 2.1).

export type Route =
  | { name: 'today' }
  | { name: 'overview' }
  | { name: 'trainer'; round: 'pflicht' | 'extra' }
  // Phase 3 – Sprechen und Business (Plan §2)
  | { name: 'speak' }
  | { name: 'roleplay'; sceneId: string; resume?: boolean; n?: number }
  | { name: 'business' }
  | { name: 'mail' }
  | { name: 'playbook'; id?: string }
  | { name: 'pitch' };

type NavState = { route: Route; go: (route: Route) => void };

export const useNav = create<NavState>((set) => ({
  route: { name: 'today' },
  go(route) {
    set({ route });
  },
}));
