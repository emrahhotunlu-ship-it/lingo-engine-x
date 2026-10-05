// Metrik-Schicht (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 6): die EINZIGE Stelle, an der „fällig / überfällig / Fest /
// Zustand / Serie“ berechnet werden (`definitions.ts`, `streak.ts`). Außerhalb dieses Ordners rechnet das niemand mehr; die Karten kommen
// über `buildTrainCards` von hier. ESLint (`no-restricted-imports`) und `tests/unit/archGuards.test.ts` sichern das ab.
export { buildTrainCards } from '../srs/cards';
export { computeStreak } from '../streak';
export { FEST_DAYS, FEST_STAGE, SAFE_STAGE, UNIT_STATES, counts, dueCount, isDue, isOverdue, overdueCount, unitState, type CardCounts, type UnitState } from './definitions';
export { streak, streakInputOf, streakWeek, type StreakDocs } from './streak';
// Fortschritt (Gesamtkonzept 3.5): reine Zahlen für die Seite „Fortschritt“.
export { FEST_GOAL, expectedKnown, festCount, festForecast, festGrowth28, isFest, retention28, type FestForecast, type FestGrowth, type Retention28 } from './vocab';
export { errorSentenceStats, grammarDistribution, topicStage, type ErrorSentenceStats, type GrammarDistribution, type TopicStage } from './grammar';
export { checkMean, vtestView, type CheckMean, type VtestView } from './tests';
