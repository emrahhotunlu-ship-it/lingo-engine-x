import { State, type Card } from 'ts-fsrs';
import type { FsrsStored } from '../../data/schemas';

// Umrechnung der alten Lernstände in FSRS-Startwerte (Kap. 9, Regel 5).
// Herleitung und Begründung: docs/fsrs-umrechnung.md.
//
// Die alte App nutzt die FSRS-v4-Vergessenskurve R = (1 + t/(9·S))^-1 mit S in Tagen.
// Bei t = S ist R = 0,9 – das ist genau die Definition der Stabilität in FSRS
// (Tage bis zur Abrufwahrscheinlichkeit 90 %). Deshalb wird S unverändert übernommen.
// D liegt in beiden Modellen auf 1–10. Die alten Felder bleiben unverändert stehen;
// FSRS-Werte kommen zusätzlich in das neue Feld `fsrs`.

const DAY = 86_400_000;

export type LegacySchedule = {
  S?: number | null;
  D?: number | null;
  due?: number | null;
  last?: number | null;
  state?: string | null;
  reps?: number | null;
  lapses?: number | null;
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const count = (v: unknown) => (finite(v) && v > 0 ? Math.round(v) : 0);

export function legacyToFsrs(card: LegacySchedule, nowMs: number): FsrsStored {
  const reps = count(card.reps);
  const lapses = count(card.lapses);
  const S = finite(card.S) ? card.S : 0;
  const last = finite(card.last) && card.last > 0 ? card.last : null;
  const isNew = card.state === 'new' || !card.state || S <= 0 || (reps === 0 && last === null);

  if (isNew) {
    return {
      v: 1,
      due: finite(card.due) && card.due > 0 ? card.due : nowMs,
      stability: 0,
      difficulty: 0,
      state: State.New,
      reps: 0,
      lapses,
      last: null,
      scheduledDays: 0,
      learningSteps: 0,
      src: 'legacy',
    };
  }

  const stability = clamp(S, 0.1, 36_500);
  const difficulty = clamp(finite(card.D) ? card.D : 5, 1, 10);
  const state = card.state === 'review' ? State.Review : lapses > 0 ? State.Relearning : State.Learning;
  const due = finite(card.due) && card.due > 0 ? card.due : (last ?? nowMs) + Math.round(stability * DAY);
  const scheduledDays = last !== null ? Math.max(0, Math.round((due - last) / DAY)) : Math.round(stability);

  return {
    v: 1,
    due,
    stability,
    difficulty,
    state,
    reps: Math.max(reps, 1),
    lapses,
    last,
    scheduledDays,
    learningSteps: 0,
    src: 'legacy',
  };
}

/** Gespeicherte FSRS-Werte → ts-fsrs-Karte (für die Wiederholungsplanung ab Phase 1). */
export function toTsFsrsCard(f: FsrsStored, nowMs: number): Card {
  const card: Card = {
    due: new Date(f.due),
    stability: f.stability,
    difficulty: f.difficulty,
    elapsed_days: f.last !== null ? Math.max(0, Math.floor((nowMs - f.last) / DAY)) : 0,
    scheduled_days: f.scheduledDays,
    learning_steps: f.learningSteps,
    reps: f.reps,
    lapses: f.lapses,
    state: f.state,
  };
  if (f.last !== null) card.last_review = new Date(f.last);
  return card;
}
