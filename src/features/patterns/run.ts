import { create } from 'zustand';
import { useClock } from '../../app/clock';
import type { Resumable } from '../../app/resume';
import { freshSnapshot } from '../grammar/resumeKit';

// Fortsetzen des Fallen-Drills (plan.md §4.3 Muss 2, M4 „+R“): Position und Treffer des laufenden
// Drills. Die Aufgaben baut der Drill aus den Daten neu (fest je Tag); beantwortete Sätze liegen
// schon in `app/repair`. Reine Bequemlichkeit, schreibt nie in die db.

export type PatternRunSnap = { id: string; pos: number; ok: number; total: number; day: string };

type State = {
  cur: PatternRunSnap | null;
  /** Hergestellter Stand für genau diesen Drill (einmal gelesen). */
  restored: PatternRunSnap | null;
  set: (s: PatternRunSnap | null) => void;
  resumeFor: (id: string, total: number) => PatternRunSnap | null;
};

export const usePatternRun = create<State>((set, get) => ({
  cur: null,
  restored: null,
  set: (cur) => {
    const prev = get().cur;
    if (prev && cur && prev.id === cur.id && prev.pos === cur.pos && prev.ok === cur.ok) return;
    set({ cur });
  },
  resumeFor: (id, total) => {
    const r = get().restored ?? freshSnapshot<PatternRunSnap>(patternResume);
    if (!r || r.id !== id || r.total !== total || r.day !== useClock.getState().today || r.pos >= total) return null;
    set({ restored: null });
    return r;
  },
}));

export const patternResume: Resumable<PatternRunSnap> = {
  id: 'patternDrill',
  version: 1,
  origin: 'learn',
  snapshot: () => usePatternRun.getState().cur,
  subscribe: (cb) => usePatternRun.subscribe(cb),
  restore: (s) => {
    if (!s || typeof s.id !== 'string' || typeof s.pos !== 'number') return false;
    usePatternRun.setState({ restored: s });
    return true;
  },
  route: (s) => ({ name: 'patterns', id: s.id.startsWith('start:') ? s.id.slice(6) : s.id }),
  label: (s, t) => t('nbLernenResumePattern', { n: s.pos + 1, total: s.total }),
};
