// Vertrag Lernplattform 2.0 (docs/umbau/lernplattform-2.md §3.1). Nur additiv ändern.
export type Bi = { de: string; en: string };

/** Begründung für eine bestimmte falsche Antwort. Die erste passende Regel gewinnt. */
export type WhyRule = {
  /** Alle Wörter stehen in der normalisierten Antwort (legacyNorm, Wortgrenzen). */
  if?: string[];
  /** Keines dieser Wörter steht in der Antwort. */
  not?: string[];
  /** Auswahl: genau diese Option wurde gewählt. */
  opt?: string;
  /** „Fehler finden“: angetipptes Wort; '*' = irgendein Wort außerhalb der Fehlerstelle; 'none' = „Kein Fehler“. */
  tap?: string;
  /** Verwechseltes Nachbarmuster (`<id>` oder `<topic>:<id>`); schaltet „Nicht verwechseln“ frei. */
  pat?: string;
  /** Kategorie der falschen Wahl (Lernplattform 3.0 K-2, additiv): Deutsch gedacht, falscher Partner, grammatisch, andere Bedeutung, Stilebene. */
  cat?: WhyCat;
  de: string; // höchstens 140 Zeichen
  en: string; // höchstens 140 Zeichen
};
export type WhyCat = 'calque' | 'partner' | 'grammar' | 'meaning' | 'register';
export type TaskWhy = { ok: Bi; wrong: WhyRule[] };

export type ExplainLine =
  | { k: 'pattern'; name: string; formula: string | null }
  | { k: 'yours'; given: string; text: string }
  | { k: 'why'; text: string }
  | { k: 'mistake'; bad: string; good: string; cause: string | null }
  | { k: 'contrast'; a: string; b: string; diff: string; /** Nur die Bedeutungen zeigen (Kontrast-Schritt: das Wortpaar steht schon im Kopf). */ meaningOnly?: boolean }
  | { k: 'note'; text: string }; // US-Form, „Auch richtig“, Register

export type ExplainExample = { en: string; de?: string | null; ctx?: 'meeting' | 'mail' | 'talk' | null };

export type ExplanationModel = {
  /** Feste Reihenfolge: pattern → yours → why → mistake → contrast → note. */
  lines: ExplainLine[];
  /** Nur Beispiele desselben Musters bzw. derselben Karte. Lieber [] als ein fremdes Beispiel. */
  examples: ExplainExample[];
  /** Englische Signalwörter, die im Übungssatz mit --lx-mark hervorgehoben werden. */
  mark: string[];
  /** Enthält Text von Claude → Kennzeichnung „von Claude, kann Fehler enthalten“. */
  ai: boolean;
  /** Herkunft (Diagnose und Tests). */
  source: 'pattern' | 'task' | 'card' | 'fallback';
};

export type ExplainDepth = 'full' | 'short' | 'min';
export type ResultVerdict = 'ok' | 'near' | 'wrong' | 'dontKnow' | 'unchecked';
