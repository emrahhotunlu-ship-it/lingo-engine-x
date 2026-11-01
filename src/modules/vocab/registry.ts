// Wörter-Modul, Tür 2 (wie modules/read/registry.ts): nur, was die Datenschicht zur Registrierung braucht. Leicht (nur zod-Schemas),
// damit die Einstiegsdatei keinen Planer-Code lädt (plan.md §2.1 Ladezeit).
//  - `vlogSchema`, `vmodSchema`: Schemas der Sammlungen `vlog` und `vmod` für COLLECTIONS (src/data/paths.ts) → Sicherung, Export, Zählung.
//  - `VMOD_DAY_PATH`: das eingefrorene Tagesdokument, das `transform` per `replace` ersetzen darf (src/data/writer.ts, REPLACEABLE).

export { vlogSchema, vmodSchema } from './data/schemas';
export const VMOD_DAY_PATH = 'vmod/day';
export const VOCAB_LOCK_PATH = 'vmod/lock';
/** Großpaket A S5c: Alltags-Lage und „Später prüfen lassen“ (`vmodUseWriteSchema`). */
export const VMOD_USE_PATH = 'vmod/use';
// V3 Schritt 1: `vlog` ist träge; Verzeichnis `vmod/ix`, Zählung und Suchliste für die Sicherung.
export { VLOG_INDEX_PATH, vlogIdsOf, vlogDocCountOf, vlogProbeIds, nextVlogPart, vlogPath, vlogIdOfPath } from './domain/vlogIndex';
