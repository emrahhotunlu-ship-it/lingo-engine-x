// Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md): Tür nach außen für Logik (ohne Oberfläche). Nur Durchreichen, keine eigene Logik.
// Die Erlaubnisliste prüft tests/unit/apply/isolation.test.ts. `registry.ts` importiert diese Datei NICHT (sie wird von Heute und den Texten früh geladen);
// so bleiben Vorlagen, Inhalte und Speicherformen aus der Einstiegsdatei.

// Zufall, Datum, Diagnose
export { hash32 } from '../../domain/random';
export { addDays, daysBetween } from '../../domain/date';
export { logError, logWarn } from '../../platform/diagnostics';

// Text
export { usesChunk } from '../../domain/text/chunkMatch';
export { repairNorm } from '../../domain/repair/norm';
export type { NewRepair } from '../../domain/repair/repair';
export { errorEdits, locateRaw, normWs, repairsFromEdits } from '../../domain/tutor/edits';
export type { Edit, EditKind, Used } from '../../domain/tutor/edits';

// Speicherformen
export { outId } from '../../domain/nbdrill/outDoc';
export type { OutItem, OutKind } from '../../domain/nbdrill/outDoc';
export type { ProdInput } from '../../domain/c1/prod';

// Inhalte: Posteingang (Antworten), Artikel-Vorrat (Zusammenfassen), Mail-Situationen (Schreiben), Berufsprofil
export { inboxMails } from '../../content/nb/load';
export type { InboxMail } from '../../content/nb/schemas';
export { articleStock } from '../../content/nb/stock';
export type { StockArticle } from '../../content/nb/stock';
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
export type { Good, GreetCheck, GreetVars, PointCheck, StyleTip, TargetWord } from '../../prompts/applyCommon';

// P4 „Anwenden als Brücke“ (13.11.2026): Brücken-Sätze – Zielwahl, Rahmen, Zeit, Muster, Vorlage
export { dayKey } from '../../domain/date';
export { BRIDGE_MIN, BRIDGE_N, BRIDGE_SHORT_N, BRIDGE_STAT_MIN, bridgeMinutes, readBridgeStat } from '../../domain/apply/bridgeTime';
export { bridgeHistory, bridgeHistoryDays, knownPatterns, pickBridge, safePatterns } from '../../domain/apply/bridge';
export type { BridgeFrame, BridgeHistory, BridgeTarget, BridgeWord, PatWhy, WordWhy } from '../../domain/apply/bridge';
export { bridgeFrames } from '../../content/apply/frames';
export { alignWords } from '../../domain/answer/align';
export { applyBridge, bridgeNeedsFix, bridgeWordInText } from '../../prompts/applyBridge';
export type { BridgeOut, BridgeVars, PatVerdict } from '../../prompts/applyBridge';
