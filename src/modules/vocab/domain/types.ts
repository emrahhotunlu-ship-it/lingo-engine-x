// Wörter-Modul V1: Typen des Lernstands (plan.md §3). Rein, ohne Abhängigkeiten.

/** Spur nach ts-fsrs 5 (FsrsStored), kurz benannt: `st` 0 neu · 1 lernt · 2 Wiederholung · 3 neu lernen. */
export type Track = { due: number; s: number; d: number; st: number; reps: number; lapses: number; last: number | null; sd: number; ls: number };

/** Art: Wort, Phrasal Verb, Kollokation, Chunk. */
export type LexKind = 'w' | 'pv' | 'col' | 'ch';

/** Laufender Lernschritt: `n` Versuch/Schritt (1 = A, 2 = B, 11.. = Wiederkehr nach Fehler), `at` Zeitpunkt, `gap` Karten seitdem nötig. */
export type Step = { n: number; at: number; gap: number };

export type Lex = {
  v: 1;
  k: LexKind;
  of: string | null;
  core: string | null;
  sense: string | null;
  lv: number;
  u: Track;
  b: Track | null;
  day: string | null;
  dayU: string | null;
  step: Step | null;
  ev: { f: string[]; o: number; s: number };
  sn: [string, string][];
  gr: { pat?: string; cnt?: 'u' | 'c' | 'uc'; sep?: 0 | 1; var?: string[] } | null;
  reg: 'f' | 'n' | 'i' | null;
  pri: 'core' | 'edge';
  lc: number;
  pair: string | null;
  mv: number;
  sync: number;
  mig: { t: number; from: 'srs1'; h: number; full: 0 | 1 } | null;
  /** Einführungstag (Lerntag), gesetzt mit der Einführung durch das Modul oder aus dem alten `intro`. */
  intro: string | null;
};

export type TrackKey = 'u' | 'b';

/** Form einer Abfrage im Planer (V1-Ausschnitt; die vollständige Leiter je Stufe baut V2). */
export type Form =
  | 'intro'
  | 'gap' // Lücke frei getippt (Benutzen)
  | 'nosent' // ohne Satz tippen / deutscher Chunk → Englisch (Benutzen)
  | 'gap_hint' // Lücke mit Anfangsbuchstabe (Benutzen, höchstens Hard)
  | 'meaning' // Bedeutung frei nennen (Verstehen)
  | 'listen' // Hören → tippen (Verstehen, höchstens Good)
  | 'choice' // Auswahl (keine Planwirkung)
  | 'flip' // Aufdecken, Anki (nur Verstehen)
  | 'transfer'; // Anwenden mit mehreren Lexemen (Benutzen)

/** Ausgang einer Antwort (plan.md §3.4; V2 verfeinert die Ableitung). */
export type Outcome = 'ok' | 'typo' | 'infl' | 'pos' | 'other' | 'syn' | 'evade' | 'colloc' | 'wrong' | 'dunno';

export const OUTCOMES: readonly Outcome[] = ['ok', 'typo', 'infl', 'pos', 'other', 'syn', 'evade', 'colloc', 'wrong', 'dunno'];
export const FORMS: readonly Form[] = ['intro', 'gap', 'nosent', 'gap_hint', 'meaning', 'listen', 'choice', 'flip', 'transfer'];

export type Grade = 1 | 2 | 3 | 4;

/** Einstellungen (app/profile.vcfg + newPerDay). */
export type VocabCfg = { min: number; ret: number; newPerDay: number; mod: 0 | 1; restDow: number | null };
export const DEFAULT_CFG: VocabCfg = { min: 15, ret: 0.9, newPerDay: 5, mod: 0, restDow: null };

/** Median-Zeiten je Form in ms (vmod/stats.med); Startwerte, bis echte Antworten da sind. */
export type FormStats = Partial<Record<Form, number>>;
export const DEFAULT_FORM_MS: Readonly<Record<Form, number>> = {
  intro: 25_000,
  gap: 14_000,
  nosent: 14_000,
  gap_hint: 13_000,
  meaning: 12_000,
  listen: 14_000,
  choice: 9_000,
  flip: 8_000,
  transfer: 180_000,
};
