import type { PromptTemplate } from './shared';

// Großpaket A S5c-3: Anschluss des Wörter-Moduls an Claude. Das Modul kennt das KI-Tor (src/ai) nicht (Isolation); der Bereich Wörter
// (src/areas/wortschatz.tsx) reicht es in dieser Form herein. Eigene Datei ohne Oberfläche, damit api.ts den Typ weitergeben darf.

/** KI-Tor von außen: `ask` liefert die geprüfte Antwort der Vorlage oder wirft; `fail` ordnet den Fehler ein; `ready` = Claude nutzbar. */
export type VocabAi = {
  ready(): boolean;
  ask<V, O>(template: PromptTemplate<V, O>, vars: V, signal: AbortSignal): Promise<O>;
  /** Hintergrund (Budget der Vorlage, still, nie ein Dialog): fehlt = keine Hintergrundaufrufe (Großpaket W2, Wort-Wissen). */
  bg?<V, O>(template: PromptTemplate<V, O>, vars: V, signal: AbortSignal): Promise<O>;
  /** abgebrochen · Claude nicht nutzbar (Muster und Selbstvergleich) · „Erneut versuchen“ mit Text-Schlüssel (`null` = allgemeiner Text). */
  fail(err: unknown): { kind: 'cancelled' | 'noai' | 'retry'; key: string | null };
};
