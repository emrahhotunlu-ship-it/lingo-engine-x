import type { PromptTemplate } from './shared';
import { readArticle, readTopics } from './prompt';

// Lesen-Modul, Tür 2 (docs/umbau/lesen-plan.md §5.1): was der Rest der App für die Registrierung braucht.
// - `readSchema`: das eine Schema der Sammlung `read` für COLLECTIONS (src/data/paths.ts)
// - `READ_TEMPLATES`: die Prompt-Vorlagen für src/prompts/registry.ts
// `readMessages {de,en}` kommt mit L3 (Oberfläche).

export { readSchema } from './schemas';

export const READ_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [readArticle, readTopics];
