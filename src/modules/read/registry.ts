import type { PromptTemplate } from './shared';
import { readArticle, readTopics } from './prompt';
import { rdDe } from './i18n/rd.de';
import { rdEn } from './i18n/rd.en';

// Lesen-Modul, Tür 2 (docs/umbau/lesen-plan.md §5.1): was der Rest der App für die Registrierung braucht.
// - `readSchema`: das eine Schema der Sammlung `read` für COLLECTIONS (src/data/paths.ts)
// - `READ_TEMPLATES`: die Prompt-Vorlagen für src/prompts/registry.ts
// - `readMessages {de,en}`: die Oberflächentexte (Präfix `rd`) für src/i18n/de.ts und en.ts
// - `readDocCountOf`: Dokumentzahl der Sammlung `read` aus `read/p`, ohne die Artikeltexte zu laden (Wächter, Diagnose)

export { readSchema } from './schemas';

export const READ_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [readArticle, readTopics];

export const readMessages = { de: rdDe, en: rdEn } as const;
export { readDocCountOf, READ_LAZY_COLLECTION } from './domain/count';
export { daysFromMonthDocs, docBytes, fitTextBudget, READ_BACKUP_TEXT_BUDGET_BYTES, readBackupPlan, recentMonths, routineBackupPaths } from './domain/backup';
