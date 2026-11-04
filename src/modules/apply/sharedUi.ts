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
export { Disclosure } from '../../ui/Disclosure';
export { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
export { AiMark } from '../../ui/AiMark';
export { Skeleton } from '../../ui/Skeleton';
export { Row, RowList } from '../../ui/RowList';
export { TabTitle } from '../../features/system/Chrome';
export { ExerciseTop } from '../../features/learn/ui';

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
export { local, KEY_PREFIX } from '../../platform/storage';
export { logWarn } from '../../platform/diagnostics';
export { useInputProfile } from '../../platform/input';

// Tagesweg: heutiger Plan, Pflichtstand, Fehlersätze, eigener Satz, Satzbau (ohne Claude)
export { useTodayPlan } from '../../features/today/store';
export { useToday } from '../../features/today/state';
export { fehlersaetzeDue, fixToday } from '../../domain/metrics';
export { useComboPairs } from '../../features/apply/ComboSentence';
export { topicById } from '../../domain/content';
export { startDrill } from '../../features/drills/session';

// Lesen-Modul: der neueste Artikel (nur lesen) als Material für „Artikel zusammenfassen“
export { loadRecentArticle } from '../read/registry';
export type { RecentArticle } from '../read/registry';
