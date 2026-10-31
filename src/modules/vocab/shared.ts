// Wörter-Modul, Tür nach innen (docs/umbau/vokabeln/plan.md §2.1): die EINZIGE Datei im Modul, die aus dem Rest der App importiert.
// Erlaubnisliste in tests/unit/vocab/isolation.test.ts. Kein Import aus src/domain/srs: das Modul ist neu, keine Reparatur am Alten.

export { addDays, dayKey, dayStartOf, daysBetween, isDayKey, learningDayEnd, learningDayStart, DAY_START_HOUR } from '../../domain/date';
export type { Writer, TransformOp } from '../../data/writer';
export { logError, logWarn } from '../../platform/diagnostics';
