import type { z } from 'zod';

// Versionierte Prompt-Vorlagen (Kap. 3.4, Kap. 10). Jede Vorlage bringt Anweisung, Daten
// und Ausgabeformat selbst mit, denn `sample` hat kein Gedächtnis (contract/sample.d.ts).

export type ModelTier = Claude.sample.ModelTier;
/** Wie `SampleOptions.cache`: `true` = fünf Minuten, `false` = nie, `{gcTime}` = bis zu 24 h. */
export type CacheOpt = boolean | { gcTime: number; refresh?: boolean };
/** Oberflächensprache; in ihr schreibt die KI ihre Erklärungen (Sprachtreue, Kap. 10). */
export type UiLang = 'de' | 'en';

export type PromptTemplate<V, O> = {
  /** Kennung aus a-z, 0-9 und '-', z. B. 'word-lookup'. */
  id: string;
  /** Wird erhöht, sobald sich Wortlaut oder Schema ändern. */
  version: number;
  tier: ModelTier;
  cache: CacheOpt;
  /**
   * Aufrufart (Phase 6, Plan W4): `json` (Standard) ruft `sample.json`. `text-json` ruft `sample()`
   * und liest die Antwort selbst nach denselben drei Regeln – nur so meldet die Laufzeit die
   * tatsächlich antwortende Stufe (`modelTierApplied`), z. B. für die Einschätzung (`complex`).
   */
  verb?: 'json' | 'text-json';
  /** Der ganze Prompt. Erste Zeile: `[${id}@${version}]`. */
  build(vars: V): string;
  /** Prüft die Antwort; hängt von den Variablen ab (z. B. Sprache der Erklärung). */
  schema(vars: V): z.ZodType<O>;
};

/**
 * Ein Gesprächsschritt für `sample` mit Verlauf (contract/sample.d.ts, `SampleMessage`).
 * Die Liste beginnt und endet mit `user`; es gibt keine `system`-Rolle.
 */
export type Turn = { role: 'user' | 'assistant'; content: string };
export type TurnInput = ReadonlyArray<Turn>;

/**
 * Gesprächsvorlage (Phase 3 Rollenspiel, Phase 5 Begleiter): liefert die Schritte statt eines
 * Prompts, gestreamt als Freitext ohne Schema. Der erste Schritt beginnt mit `[${id}@${version}]`.
 * Nie zwischengespeichert (`cache: false`, sample.d.ts: „every turn of a chat") und nie
 * automatisch wiederholt.
 */
export type ChatTemplate<V> = {
  id: string;
  version: number;
  tier: ModelTier;
  cache: false;
  /** Führender `user`-Schritt mit Anweisungen und Kontext, dann Verlauf, dann neue Nachricht. */
  buildTurns(vars: V): TurnInput;
  /** Optional: bereinigt Teil- und Endtext (Namenspräfix, Anführungszeichen, Regieanweisungen); '' = leer. Rein und idempotent. */
  clean?(text: string): string;
};
