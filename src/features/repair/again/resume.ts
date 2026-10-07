import type { Resumable } from '../../../app/resume';
import { ensureWith } from '../../grammar/resumeKit';
import { againSnapshot, restoreAgain, startAgain, useAgain, type AgainSnap } from './session';

// Fortsetzen von Schritt 4 (G3): Karten, Stelle in der Schlange und bisherige Antworten bleiben nach dem Neuladen (Version 2: Satz für Satz).

export const againResume: Resumable<AgainSnap> = {
  id: 'unitAgain',
  version: 2,
  origin: 'today',
  snapshot: againSnapshot,
  subscribe: (cb) => useAgain.subscribe(cb),
  restore: restoreAgain,
  route: () => ({ name: 'unitAgain' }),
  label: (_s, t) => t('nbLernenAgainTitle'),
};

export function ensureAgain(): boolean {
  return ensureWith(
    againResume,
    () => useAgain.getState().active,
    () => {
      startAgain(null);
      return true;
    },
  );
}
