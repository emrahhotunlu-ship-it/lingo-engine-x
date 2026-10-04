import type { Resumable } from '../../app/resume';
import type { RouteOf } from '../../app/router/types';
import { ensureWith } from '../grammar/resumeKit';
import { drillSnapshot, itemsOf, restoreDrill, startDrill, useDrill, type DrillSnap } from './session';

// Fortsetzen von Diktat, Lückenjagd und Satzbau (G3, G6). Sprint nicht (Wertung auf Zeit).

export const drillResume: Resumable<DrillSnap> = {
  id: 'drill',
  version: 1,
  origin: 'learn',
  snapshot: drillSnapshot,
  subscribe: (cb) => useDrill.subscribe(cb),
  restore: restoreDrill,
  route: (s) => ({ name: 'drill', kind: s.kind, ctx: s.ctx === 'duty' ? 'duty' : 'xtra' }),
  label: (s, t) => t('nbLernenResumeDrill', { n: Math.min(s.pos + 1, itemsOf({ ...s, sprint: [] }).length), total: itemsOf({ ...s, sprint: [] }).length }),
};

export function ensureDrill(route: RouteOf<'drill'>): boolean {
  return ensureWith(
    drillResume,
    () => useDrill.getState().active && useDrill.getState().kind === route.kind,
    () => {
      if (route.kind === 'sprint') return false;
      startDrill(route.kind);
      return itemsOf(useDrill.getState()).length > 0;
    },
  );
}
