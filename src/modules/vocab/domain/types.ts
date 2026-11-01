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
  /** V2: Formen-Statistik des Lexems (Formwahl M22/M27, Satzbindung M57, Ausweichwort M41). Fehlt bei Lexemen aus V1. */
  fq?: Fq;
};

/**
 * Formen-Statistik je Lexem (V2): `l` zuletzt gestellte Form · `c` Zähler der Benutzen-Abrufe ab Stufe 4 (jeder 3. ohne Satz, M27) ·
 * `h` je Form [Versuche, frei richtig] · `nb` noch so viele Termine ohne Satz (Signal „satzgebunden“, M57) · `ak` letzte Antwort im
 * Ankersatz richtig (1) / falsch (0) / unbekannt (null) · `ew` schon benutzte Ausweichwörter (M41: das zweite gleiche gibt Hard) ·
 * `xf` Fehler in neuen Sätzen in Folge seit dem letzten richtigen Abruf im Ankersatz.
 */
export type Fq = { l: Form | null; c: number; h: Partial<Record<Form, [number, number]>>; nb: number; ak: 0 | 1 | null; ew: string[]; xf?: number };

export type TrackKey = 'u' | 'b';

/**
 * Form einer Abfrage (V2: vollständige Leiter, plan.md §5 „Spur je Form“; Spur und höchste Note in `grade.ts` FORM_SPEC,
 * Formen je Stufe in `forms.ts`). Namen ≤ 12 Zeichen (`vmod/day.plan`).
 */
export type Form =
  | 'intro' // Einführung (Stufe 1): Satz mit Lücke, erst kurz versuchen, dann Lösung (M36); keine Planwirkung
  | 'probe' // „Kenne ich schon“ mit Probe (V5): frei getippt, ohne Satz
  | 'gap' // Lücke frei getippt (Benutzen)
  | 'nosent' // ohne Satz: deutscher Chunk → Englisch (Benutzen, M27)
  | 'de_sent' // deutscher Satz → Lexem im englischen Satz (Benutzen, Stufe 4)
  | 'gap_hint' // Lücke mit Anfangsbuchstabe (Benutzen, höchstens Hard)
  | 'cloze_part' // Teil einer Wendung frei (Benutzen, höchstens Hard)
  | 'complete' // Satz vervollständigen (Benutzen, höchstens Hard)
  | 'prep' // Präposition/Wortmuster ergänzen (M78, höchstens Hard)
  | 'count' // Zählbarkeit (M79, höchstens Hard)
  | 'particle' // Partikel-Lücke bzw. Umstellform *set it up* (M81, höchstens Hard; Umstellform nur bei gr.sep = 1)
  | 'partner' // Wortpartner tippen (Benutzen)
  | 'family' // andere Wortform/Wortfamilie in neuem Satz (Benutzen)
  | 'situation' // Situation → Ausdruck (M29, Benutzen, ohne englischen Satz)
  | 'diplomatic' // diplomatischer sagen (M80, Form mit Claude: V4)
  | 'own' // eigener Satz (gelenkt ab Stufe 5, frei ab 6; Prüfung mit Claude: V4)
  | 'say' // „Sag es“ (Diktat, erkannt; Ablehnung der Erkennung ist nie ein Fehler, M31)
  | 'transfer' // Anwenden mit mehreren Lexemen (Benutzen)
  | 'listen' // Hören → tippen (Verstehen, höchstens Good)
  | 'dictation' // Diktat des Satzes (Verstehen, höchstens Good)
  | 'tiles' // Bausteine (nur Wendungen, Verstehen, höchstens Hard)
  | 'meaning' // Bedeutung frei nennen (Verstehen)
  | 'tone_mean' // Ton → Bedeutung (Verstehen)
  | 'flip' // Aufdecken, Anki (nur Verstehen, Selbsturteil)
  | 'choice' // Auswahl (keine Planwirkung)
  | 'find_trap' // Falle finden (keine Planwirkung)
  | 'contrast'; // Kontrastkarte (falscher Freund, Hyperkorrektur; keine Planwirkung)

/**
 * Ausgang einer Antwort (plan.md §3.4, V2 §5). Reihenfolge der Prüfung in `check.ts`.
 * `typo` (a) · `spell` (b) Liste deutscher Lerner · `infl` (c) Beugung · `pos` (d) Wortart/Ableitung · `other` (e) anderes echtes Wort ·
 * `hyph` (f) Bindestrich/Leerzeichen mit Wortartwechsel · `syn` Auch richtig (Synonym, `gr.var`, britischer Wortschatz) · `evade` Ausweichwort ·
 * `colloc` Kollokationsfehler (M56) · `prep` Präposition/Muster (M78) · `plural` Plural bei nicht Zählbarem (M79) · `order` Stellung des
 * Pronomens (M81) · `unfair` „Aufgabe war unfair“ (M43) · `asr` Erkennung abgelehnt (M31) · `wrong` · `dunno`.
 */
export type Outcome =
  | 'ok'
  | 'typo'
  | 'spell'
  | 'infl'
  | 'pos'
  | 'other'
  | 'hyph'
  | 'syn'
  | 'evade'
  | 'colloc'
  | 'prep'
  | 'plural'
  | 'order'
  | 'unfair'
  | 'asr'
  | 'wrong'
  | 'dunno';

export const OUTCOMES: readonly Outcome[] = ['ok', 'typo', 'spell', 'infl', 'pos', 'other', 'hyph', 'syn', 'evade', 'colloc', 'prep', 'plural', 'order', 'unfair', 'asr', 'wrong', 'dunno'];
export const FORMS: readonly Form[] = [
  'intro', 'probe', 'gap', 'nosent', 'de_sent', 'gap_hint', 'cloze_part', 'complete', 'prep', 'count', 'particle', 'partner', 'family', 'situation',
  'diplomatic', 'own', 'say', 'transfer', 'listen', 'dictation', 'tiles', 'meaning', 'tone_mean', 'flip', 'choice', 'find_trap', 'contrast',
];

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
  probe: 14_000,
  de_sent: 18_000,
  cloze_part: 13_000,
  complete: 30_000,
  prep: 10_000,
  count: 16_000,
  particle: 12_000,
  partner: 13_000,
  family: 16_000,
  situation: 25_000,
  diplomatic: 60_000,
  own: 70_000,
  say: 20_000,
  dictation: 25_000,
  tiles: 15_000,
  tone_mean: 12_000,
  find_trap: 12_000,
  contrast: 15_000,
};
