import { create } from 'zustand';
import type { Resumable } from '../../app/resume';
import { isVtestSnap, type VtestSnap } from './machine';

// Fortsetzen des Wortschatztests (plan.md §4.7 Muss 4, architektur.md §3.2): Der Bildschirm legt
// nach jedem Schritt die Momentaufnahme hier ab; der Rahmen (WP0b) speichert sie lokal
// (`lx:resume:vtest`) und stellt sie nach dem Neuladen SYNCHRON her (`restore` im Klick bzw. beim
// Start). `restore` schreibt nie in die db – gespeichert wird nur das Ergebnis am Ende, genau einmal.
// Ergebnis oder „Abbrechen“ löschen die Momentaufnahme; ✕ behält sie.

export const useVtestSession = create<{ snap: VtestSnap | null }>(() => ({ snap: null }));

let pending: VtestSnap | null = null;

/** Vom Bildschirm genau einmal beim Aufbau abgeholt: die herzustellende Momentaufnahme. */
export function takePendingVtest(): VtestSnap | null {
  const p = pending;
  pending = null;
  return p;
}

export function setVtestSnap(snap: VtestSnap | null): void {
  const cur = useVtestSession.getState().snap;
  if (cur === snap || (cur && snap && JSON.stringify(cur) === JSON.stringify(snap))) return;
  useVtestSession.setState({ snap });
}

const PART_KEY = { yesno: 'vtStepYesNo', meaning: 'vtStepMeaning', active: 'vtStepActive' } as const;

export const vtestResume: Resumable<VtestSnap> = {
  id: 'vtest',
  version: 1,
  origin: 'profile',
  snapshot: () => useVtestSession.getState().snap,
  subscribe: (cb) => useVtestSession.subscribe(cb),
  restore: (s) => {
    if (!isVtestSnap(s)) return false;
    pending = s;
    useVtestSession.setState({ snap: s });
    return true;
  },
  route: () => ({ name: 'vtest' }),
  label: (s, t) => `${t('vtestTitle')} · ${t(PART_KEY[s.state === 'asking' ? s.resumeTo : s.state])} · ${s.i + 1}`,
};
