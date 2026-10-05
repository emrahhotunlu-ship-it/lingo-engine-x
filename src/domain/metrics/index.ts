// Metrik-Schicht (Umbau „Fokus Wörter und Grammatik“, Gesamtkonzept Kap. 6): künftig die einzige Stelle,
// an der „fällig / überfällig / Fest / Serie“ berechnet werden. In W1 nur das Gerüst: die beiden
// bestehenden Ableitungen werden hier gebündelt wieder ausgeführt; W3 zieht alle Aufrufer hierher und
// sichert das mit einer ESLint-Regel und den Invarianten-Tests ab.
export { buildTrainCards } from '../srs/cards';
export { computeStreak } from '../streak';
// Fortschritt (Gesamtkonzept 3.5): reine Zahlen für die Seite „Fortschritt“.
export { FEST_GOAL, expectedKnown, festCount, festForecast, festGrowth28, isFest, retention28, type FestForecast, type FestGrowth, type Retention28 } from './vocab';
export { errorSentenceStats, grammarDistribution, topicStage, type ErrorSentenceStats, type GrammarDistribution, type TopicStage } from './grammar';
export { checkMean, vtestView, type CheckMean, type VtestView } from './tests';
