import { fsrs, generatorParameters, type Card } from 'ts-fsrs';
import type { FsrsStored } from '../../data/schemas';
import { legacyToFsrs, toTsFsrsCard } from './legacyFsrs';
import type { Grade } from './types';

// FSRS-Planung (Lern-Entwurf §2.1, Daten-Entwurf §1.3/1.4). FSRS ist maßgeblich; die alten
// Felder werden bei jeder Antwort gespiegelt (applyReview.ts).

export const FSRS_PARAMS = generatorParameters({
  request_retention: 0.9, // wie die alte App: S behält dieselbe Bedeutung (R = 0,9 bei t = S)
  maximum_interval: 365, // alte Obergrenze S ≤ 365
  enable_fuzz: true, // deterministisch je Eingabe
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
});

const scheduler = fsrs(FSRS_PARAMS);

export const FSRS_VERSION = 1;
/** Zustände wie in ts-fsrs (`State`): 0 New, 1 Learning, 2 Review, 3 Relearning. */
const NEW = 0;
const LEARNING = 1;
const RELEARNING = 3;
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;
const normLast = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

function isStored(v: unknown): v is FsrsStored {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return ['v', 'due', 'stability', 'difficulty', 'state', 'reps', 'lapses', 'scheduledDays', 'learningSteps'].every(
    (k) => typeof f[k] === 'number' && Number.isFinite(f[k]),
  );
}

/** Liegt eine neuere FSRS-Version vor, als diese App kennt? Dann nie zurückschreiben. */
export function isFutureFsrs(doc: Readonly<Record<string, unknown>>): boolean {
  const f = doc.fsrs as { v?: unknown } | null | undefined;
  return !!f && typeof f.v === 'number' && f.v > FSRS_VERSION;
}

/**
 * Gültiger FSRS-Stand der Karte. Nachgezogen aus den alten Feldern, wenn `fsrs` fehlt oder
 * nicht zu `last` passt – dann hat die alte App die Karte seitdem bewertet oder zurückgesetzt.
 */
export function readFsrs(doc: Readonly<Record<string, unknown>>, nowMs: number): FsrsStored {
  const f = doc.fsrs;
  if (isStored(f) && f.v === FSRS_VERSION && normLast(f.last) === normLast(doc.last)) return f;
  return legacyToFsrs(doc, nowMs);
}

function toStored(card: Card, nowMs: number): FsrsStored {
  return {
    v: FSRS_VERSION,
    due: Math.round(card.due.getTime()),
    stability: round4(card.stability),
    difficulty: round4(card.difficulty),
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    last: nowMs,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    src: 'lx',
  };
}

export function reviewFsrs(f: FsrsStored, grade: Grade, nowMs: number): FsrsStored {
  const next = scheduler.next(toTsFsrsCard(f, nowMs), new Date(nowMs), grade);
  return toStored(next.card, nowMs);
}

/** Abstand bis zur nächsten Fälligkeit je Note (ms) – Beschriftung der Bewertungsknöpfe. */
export function previewIntervals(f: FsrsStored, nowMs: number): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  for (const g of [1, 2, 3, 4] as const) out[g] = Math.max(0, reviewFsrs(f, g, nowMs).due - nowMs);
  return out;
}

/** Abrufwahrscheinlichkeit jetzt; neue Karten zählen als 0. */
export function retrievability(f: FsrsStored, nowMs: number): number {
  if (f.state === NEW) return 0;
  const r = scheduler.get_retrievability(toTsFsrsCard(f, nowMs), new Date(nowMs), false);
  return Number.isFinite(r) ? r : 0;
}

export const isNewState = (f: FsrsStored): boolean => f.state === NEW;
export const isLearningState = (f: FsrsStored): boolean => f.state === LEARNING || f.state === RELEARNING;
