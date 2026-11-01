// Wörter-Modul, Tür nach innen (docs/umbau/vokabeln/plan.md §2.1): die EINZIGE Datei im Modul, die aus dem Rest der App importiert.
// Erlaubnisliste in tests/unit/vocab/isolation.test.ts. Kein Import aus src/domain/srs: das Modul ist neu, keine Reparatur am Alten.

export { addDays, dayKey, dayStartOf, daysBetween, isDayKey, learningDayEnd, learningDayStart, DAY_START_HOUR } from '../../domain/date';
export type { Writer, TransformOp } from '../../data/writer';
export { logError, logWarn } from '../../platform/diagnostics';
// V2: britische Schreibweise ist in Emrahs Eingaben richtig (A7, Tippfehler-Regel (h)); dieselbe Liste wie im Rest der App.
export { toUSText } from '../../domain/text/british';
// V3: Grundformen einer Wortform (*brought* → *bring*), um die Lücke im Satz zu finden (domain/card.ts). Rein, dieselbe Liste wie im Rest der App.
export { lemmaCandidates } from '../../domain/text/lemma';
// V4 (Großpaket A Schritt 5): Bausteine der drei Claude-Vorlagen (prompts/): Kopfzeile, Kürzen, Sprachtreue, tolerantes Lesen,
// Nachprüfung der korrigierten Fassung (britisch → US, Selbstprüfung). Nur reine Funktionen und Typen; der Aufruf selbst (KI-Tor) kommt von außen.
export { block, clip, fenced, header, langName } from '../../prompts/common';
export type { PromptTemplate, UiLang } from '../../prompts/types';
export { clipped } from '../../prompts/tolerant';
export { correctionRules, withFixedGate } from '../../prompts/fixedGate';
export { isWrongLang } from '../../domain/lang/detect';
