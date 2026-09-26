import { create } from 'zustand';

// Navigation ohne Router und ohne History-API (im iframe teilt sich der Verlauf mit claude.ai).
// Start ist immer „Heute" (Kap. 2.1).

export type Route =
  | { name: 'today' }
  | { name: 'overview' }
  | { name: 'trainer'; round: 'pflicht' | 'extra' }
  // Phase 4 – Input und Output (Plan §2.3). `ctx` bestimmt nur `log.ctx`, nie die Zählung.
  | InputRoute;

export type UnitCtx = 'duty' | 'extra';
export type InputRoute =
  | { name: 'read'; ctx: UnitCtx }
  | { name: 'listen'; ctx: UnitCtx }
  | { name: 'write'; ctx: UnitCtx }
  | { name: 'discover' }
  | { name: 'discoverItem'; feedId: string; itemId: string; ctx: UnitCtx }
  | { name: 'history'; kind: 'read' | 'listen' | 'write' | 'discover' };

type NavState = { route: Route; go: (route: Route) => void };

export const useNav = create<NavState>((set) => ({
  route: { name: 'today' },
  go(route) {
    set({ route });
  },
}));
