import type { Resumable } from '../../../app/resume';
import { ensureWith } from '../resumeKit';
import { focusSnapshot, restoreFocus, startFocus, useFocus, type FocusSnap } from './session';

// Fortsetzen von Block 4 (G3): gleiche Aufgabe nach dem Neuladen; Beantwortetes wird übersprungen.

export const focusResume: Resumable<FocusSnap> = {
  id: 'unitFocus',
  version: 1,
  origin: 'today',
  snapshot: focusSnapshot,
  subscribe: (cb) => useFocus.subscribe(cb),
  restore: restoreFocus,
  route: () => ({ name: 'unitFocus' }),
  label: (s, t) => t('nbLernenResumeFocus', { n: Math.min(s.pos + 1, s.tasks.length), total: s.tasks.length }),
};

/** `ensure` der Route: aktiv, sonst hergestellt, sonst aus den Daten von heute neu gebaut. */
export function ensureFocus(): boolean {
  return ensureWith(
    focusResume,
    () => useFocus.getState().active,
    () => {
      startFocus(null);
      return true;
    },
  );
}
