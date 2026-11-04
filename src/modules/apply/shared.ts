// Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md): Tür nach außen für Logik (ohne Oberfläche). Nur Durchreichen, keine eigene Logik.
// Die Erlaubnisliste prüft tests/unit/apply/isolation.test.ts. `registry.ts` importiert diese Datei NICHT (sie wird von Heute und den Texten früh geladen);
// so bleiben Vorlagen, Inhalte und Speicherformen aus der Einstiegsdatei.

// Zufall, Diagnose
export { hash32 } from '../../domain/random';
export { logError, logWarn } from '../../platform/diagnostics';

// Text
export { usesChunk } from '../../domain/text/chunkMatch';
export { repairNorm } from '../../domain/repair/norm';
export type { NewRepair } from '../../domain/repair/repair';
export { errorEdits, normWs, repairsFromEdits } from '../../domain/tutor/edits';
export type { Edit, EditKind, Used } from '../../domain/tutor/edits';

// Speicherformen
export { outId } from '../../domain/nbdrill/outDoc';
export type { OutItem, OutKind } from '../../domain/nbdrill/outDoc';
export type { ProdInput } from '../../domain/c1/prod';

// Inhalte: Posteingang (Antworten), Mail-Situationen (Schreiben), Berufsprofil
export { inboxMails } from '../../content/nb/load';
export type { InboxMail } from '../../content/nb/schemas';
export { mailVars, pickSituation } from '../../domain/tutor/mail';
export type { MailSituation } from '../../domain/tutor/mail';
export { tutorCtx } from '../../domain/tutor/ctx';
export { readCtx2 } from '../../domain/tutor/ctx2';
export { patListText } from '../../domain/tutor/patList';
export { patternById } from '../../domain/grammar/patterns';

// Vorlagen
export { clip } from '../../prompts/common';
export { applyReply, INCOMING_MAX, RULE_ID } from '../../prompts/applyReply';
export type { ApplyReply } from '../../prompts/applyReply';
export { applySummary } from '../../prompts/applySummary';
export type { ApplySummary } from '../../prompts/applySummary';
export { applyKeypoints } from '../../prompts/applyKeypoints';
export { c1Mail } from '../../prompts/c1Mail';
export type { C1Mail } from '../../prompts/c1Mail';
export type { Good, PointCheck } from '../../prompts/applyCommon';
