// Lesen-Modul (docs/umbau/lesen-plan.md §5): EINZIGE Datei mit Importen aus dem Rest der App.
// Alles andere im Modul importiert nur hieraus oder aus dem Modul selbst; ESLint und
// tests/unit/read/isolation.test.ts halten das fest. Die Erlaubnisliste (§5.2) steht im Test.
// Nur Durchreichen, keine Logik. Typen von `data/writer` sind reine Typ-Importe (kein Laufzeit-Kreis über data/paths).

// KI-Tor (Kap. 10): ein Aufruf nur auf Handlung, ein Neuversuch nur bei Schemafehler (A6 Nr. 3).
export { askJson } from '../../ai/gate';
export { AiFailure, isAiFailure } from '../../ai/types';
export type { AiMessageKey, AiPhase, AiResult } from '../../ai/types';

// Vorlagen-Bausteine
export { block, clip, header } from '../../prompts/common';
export type { PromptTemplate } from '../../prompts/types';

// Sprachtreue, Datum, Kapazität
export { detectLang, isWrongLang, wordCount } from '../../domain/lang/detect';
export { addDays, dayKey, isDayKey, isoWeek } from '../../domain/date';
export { DOC_BLOCK_TOTAL, DOC_WARN_TOTAL, docGateOf } from '../../domain/capacity/docGuard';
export type { DocGate } from '../../domain/capacity/docGuard';

// Diagnose-Protokoll
export { logError, logWarn } from '../../platform/diagnostics';

// Der eine Schreibpfad (nur Typen: das Modul bekommt den Schreiber von außen gereicht)
export type { AcquireOutcome, TransformOp, Writer } from '../../data/writer';
