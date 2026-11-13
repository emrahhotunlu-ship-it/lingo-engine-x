// Modul Anwenden (F3): zweite Tür nach außen, nur für die Oberfläche und ihre Schreibwege. Nie von registry.ts erreichbar (die Texte und Heute laden registry.ts
// früh; sonst entstünden Import-Schleifen i18n → registry → Oberfläche → i18n). Nur Durchreichen, keine Logik; die Erlaubnisliste prüft
// tests/unit/apply/isolation.test.ts.

// Rahmen, Navigation, Uhr, Tagesweg
export { defineArea } from '../../app/registry';
export type { ScreenProps } from '../../app/registry';
export { useNav } from '../../app/nav';
export { useClock } from '../../app/clock';
export { unitDone } from '../../app/unit/done';

// Texte
export { useT } from '../../i18n';
export type { MessageKey } from '../../i18n';

// Bausteine
export { Button } from '../../ui/Button';
export { Icon } from '../../ui/Icon';
export type { IconName } from '../../ui/Icon';
export { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
export { AiMark } from '../../ui/AiMark';
export { Skeleton } from '../../ui/Skeleton';
export { Row, RowList } from '../../ui/RowList';
export { TabTitle } from '../../features/system/Chrome';
export { ExerciseTop } from '../../features/learn/ui';
// Bildschirmtastatur: Feld und Prüfen-Knopf über der Tastatur halten (dieselbe Rechnung wie die Lücke, Kap. 4.1)
export { keepVisibleDelta, keyboardCovers } from '../../ui/chat/keyboard';

// KI: Anfrage, Verfügbarkeit, Tagesbremse
export { useAsk } from '../../ai/useAsk';
export { useAiAvailable } from '../../ai/scope';
export { takeTutorCall } from '../../ai/tutorBudget';
export { getDb } from '../../platform/capabilities';

// Daten: Live-Stand, träges Lesen, der eine Schreibpfad und die vorhandenen Schreiber
export { useLive } from '../../data/live';
export { getWriter } from '../../data';
export { readDoc } from '../../data/reads';
export { outPath, upsertOut } from '../../domain/nbdrill/outDoc';
export { saveOutItem } from '../../features/tutor/clinicSave';
export { retireRepairs, saveRepairs } from '../../features/repair/store';
export { addProd } from '../../domain/c1/prod';

// Browser-Speicher (nur Entwurf) und Eingabeprofil
export { local, KEY_PREFIX, removeOlderDayKeys } from '../../platform/storage';
export { logWarn } from '../../platform/diagnostics';
export { useInputProfile } from '../../platform/input';

// Tagesweg: heutiger Plan, Pflichtstand, Fehlersätze, eigener Satz, Satzbau (ohne Claude)
export { useTodayPlan } from '../../features/today/store';
export { useToday } from '../../features/today/state';
export { fehlersaetzeDue, fixToday } from '../../domain/metrics';
export { useComboPairs } from '../../features/apply/ComboSentence';
export { topicById } from '../../domain/content';
export { startDrill, useDrill } from '../../features/drills/session';

// Lesen-Modul: der neueste Artikel (nur lesen) als Material für „Artikel zusammenfassen“
export { loadRecentArticle } from '../read/registry';
export type { RecentArticle } from '../read/registry';

// Wörter-App: Wort-Belege `used` aus Anwenden (F2, eine Tür `reportEvidence`, Umgebung holt die Wörter-App selbst)
export { reportEvidence } from '../vocab/api';

// P4 „Anwenden als Brücke“ (13.11.2026): Übungsgerüst, Rundenende, Muster des heutigen Grammatik-Schritts (Adapter), Rückfluss
export { ExerciseShell, SentenceInput } from '../../ui/exercise';
export { stepNextLabel } from '../../ui/exercise/runCtx';
export type { ShellFeedback } from '../../ui/exercise';
export { SessionEnd } from '../../ui/SessionEnd';
export { useTodayPattern } from '../../features/apply/todayPattern';
export { saveBridgeStat, saveFreeUse } from '../../features/apply/bridgeStore';
export { loadBridgeWords, reportBridgeUse } from '../vocab/api';
export type { BridgeLex, BridgeUseResult } from '../vocab/api';
