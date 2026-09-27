import type { Grade } from '../srs/types';
import type { GrammarTaskType, Help, Timing, Verdict } from './types';

// Note für Grammatik und Übungen (phase2-plan §5.0, CLAUDE.md A7 „keine Selbstbewertung"):
// allein aus Richtigkeit, Zeit und genutzter Hilfe. Gleiches Muster wie `autoGrade` des
// Vokabeltrainers (srs/grade.ts): falsch → 1, fast richtig → 2, richtig → nach Zeit 2/3/4,
// gedeckelt durch Hilfe (Hilfe 1 → höchstens 3, Hilfe 2 → höchstens 2).

export type LearnKind = GrammarTaskType | 'dictate' | 'cloze' | 'order';

type Limits = {
  /** Bis hierhin „Gut", darüber „Schwer". */
  good: number;
  /** Bis hierhin „Leicht"; `null` = nie „Leicht" (Auswahl ist ratbar). */
  easy: number | null;
  /** Welche Zeit zählt: bis zum ersten Zeichen oder bis zum Abschicken. */
  measure: 'firstKey' | 'submit';
};

const LIMITS: Record<Exclude<LearnKind, 'order'>, Limits> = {
  mc: { good: 8000, easy: null, measure: 'submit' },
  gap: { good: 8000, easy: 3000, measure: 'firstKey' },
  transform: { good: 20000, easy: 8000, measure: 'submit' },
  correct: { good: 20000, easy: 8000, measure: 'submit' },
  // Diktat: Zeit ab Tonende (misst der Aufrufer) bis zum ersten Zeichen.
  dictate: { good: 6000, easy: 2500, measure: 'firstKey' },
  cloze: { good: 8000, easy: 3000, measure: 'firstKey' },
};

/** Satzbau: 9 s + 0,6 s je Baustein, nie „Leicht". */
const orderLimits = (units: number | undefined): Limits => ({ good: 9000 + 600 * Math.max(0, units ?? 0), easy: null, measure: 'submit' });

/** Mehr als zweimal nochmal hören zählt als Hilfe 1 (Diktat, §5.4). */
export const FREE_REPLAYS = 2;

export function learnGrade(kind: LearnKind, verdict: Verdict, timing: Timing, help: Help): Grade {
  if (verdict === 'wrong') return 1;
  if (verdict === 'near') return 2;
  const lim = kind === 'order' ? orderLimits(timing.units) : LIMITS[kind];
  const t = lim.measure === 'firstKey' ? (timing.firstKeyMs ?? timing.submitMs) : timing.submitMs;
  let g: Grade = lim.easy !== null && t <= lim.easy ? 4 : t <= lim.good ? 3 : 2;
  const replays = Math.max(help.replays ?? 0, timing.replays ?? 0);
  const level = Math.max(help.level, replays > FREE_REPLAYS ? 1 : 0);
  if (level >= 2) g = Math.min(g, 2) as Grade;
  else if (level === 1) g = Math.min(g, 3) as Grade;
  return g;
}
