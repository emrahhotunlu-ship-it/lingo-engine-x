import type { Resumable } from '../../../app/resume';
import { ensureWith } from '../../grammar/resumeKit';
import { againSnapshot, restoreAgain, startAgain, useAgain, type AgainSnap } from './session';

// Fortsetzen von Block 5 (G3): Schritt und Entwurf der Neufassung bleiben nach dem Neuladen.

export const againResume: Resumable<AgainSnap> = {
  id: 'unitAgain',
  version: 1,
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
