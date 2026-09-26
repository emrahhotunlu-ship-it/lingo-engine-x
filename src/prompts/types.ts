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
  /** Der ganze Prompt. Erste Zeile: `[${id}@${version}]`. */
  build(vars: V): string;
  /** Prüft die Antwort; hängt von den Variablen ab (z. B. Sprache der Erklärung). */
  schema(vars: V): z.ZodType<O>;
};
