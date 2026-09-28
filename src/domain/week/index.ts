// Öffentliche Schnittstelle von `domain/week` (API-stabil ab der Übergabe an P1, Plan §4.9).

export type * from './types';
export { isoWeek, readWeekDoc, storedTheme, suggestTheme, themeFor, needsThemeConfirm, withTheme, HIST_MAX, type ThemePick } from './theme';
export {
  unitPlanFor,
  resolveBlock,
  dowOf,
  SHORT_GOAL_MAX,
  REVIEW_SEC,
  FULL_MIN,
  SHORT_MIN,
  SUNDAY_MIN,
  LISTEN_WORDS,
  type ResolvedBlock,
} from './plan';
export { block1Order, REPAIR_MAX, REPAIR_SEC_MAX, NEW_SHARE, NEW_MIN, type ReviewCandidate, type ReviewEntry, type ReviewOrder, type ReviewReason } from './review';
export { isThemeCard, themeRef, type ThemeCardLike } from './cards';
export { weekTargets, detectTargets, EMPTY_TARGETS, HEDGES, TRANSITIONS, TRAPS_MAX, allThemes, type TargetHit, type TargetCount, type TargetScan } from './targets';
export { matchTrap, matchTraps, type TrapHit } from './traps';
export { normText, phraseCore } from './text';
export { themeFromText, hintFor, hintOf, readHint, weekHintOp } from './hint';
