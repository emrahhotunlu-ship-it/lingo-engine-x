import type { TargetKind, ThemeGoal, ThemeId, WeekTheme } from '../../content/nb/themes';

// Typen der Tageseinheit und des Wochenplans (Plan §1.5, §4.10, Prüfung Tageseinheit M1–M10, S1–S5).
// Rein, ohne React und ohne Datenbank. `UnitBlockKind` entspricht wörtlich dem Vertrag in Plan §4.10.

export type { TargetKind, ThemeGoal, ThemeId, WeekTheme };

export type UnitBlockKind =
  | 'review'
  | 'input.read'
  | 'input.listen'
  | 'pron.shadow'
  | 'task.say'
  | 'task.fluency'
  | 'task.tones'
  | 'task.inbox'
  | 'task.objection'
  | 'task.meeting'
  | 'task.roleplay'
  | 'task.check'
  | 'task.order'
  | 'grammar'
  | 'focus'
  | 'focus.colloc'
  | 'again';

/** `phone`: Handy-Ansicht gilt (Emrah 01.10.2026) – Nachsprechen und Sprech-/Schreibaufgaben entfallen. */
export type UnitEnv = { ai: boolean; tts: boolean; phone?: boolean };

/** Quelle des Inputs in Block 2 (Prüfung M7) bzw. des Nachsprechens. */
export type InputSrc =
  | 'theme-text' // Themen-Text der Woche (P7a, ohne KI verfügbar)
  | 'theme-listen' // Hörtext zum Thema (KI, während Block 1 erzeugt)
  | 'dialog' // Dialog-Hörtext mit mehreren Stimmen (KI)
  | 'feed' // ungelesener Feed-Beitrag oder Text aus der Bibliothek
  | 'feed-life' // Alltags-Input (Feed Alltag oder gespeicherter Alltagstext)
  | 'inbox' // Kundenmail des Posteingangs
  | 'phrases'; // die 5 Wendungen der Woche

export type UnitBlockOpts = {
  src?: InputSrc;
  /** Wortzahl des Hörtexts (S1: 60–75 s, etwa 150–180 Wörter). */
  words?: readonly [number, number];
  /** Tempo-Leiter beim Hören (H2). */
  ladder?: boolean;
  /** Ohne KI: Themen-Text vorlesen, dann in 3 Sätzen zusammenfassen (M7). */
  summary?: boolean;
  /** Frage A der Woche (Kennung aus `content/fluency/questions.ts`). */
  question?: string;
  /** Freitag: Wörter pro Minute gegen Dienstag. */
  compare?: 'tue';
  /** Posteingang: nur lesen (Block 2), antworten (Block 3) oder beides (Kurz-Einheit, Ersatz). */
  part?: 'read' | 'reply' | 'full';
  /** „Laut zuerst“ (Sag es, N71). */
  aloud?: boolean;
  /** Generalprobe für einen Termin in ≤ 3 Tagen. */
  rehearsal?: boolean;
  /** Kurzform (Samstag in der Kurz-Einheit: Einwand-Training statt Rollenspiel). */
  short?: boolean;
  /** Business-Szene zum Thema (Rollenspiel). */
  scene?: string;
  /** Grammatik-Block (Fokus als Block 2): Zahl der Hauptaufgaben. */
  n?: number;
};

export type UnitChannel = 'review' | 'ch:u-in' | 'ch:u-task' | 'ch:u-focus' | 'ch:u-again' | 'ch:u-check';

export type UnitStep = { kind: UnitBlockKind; steps: readonly UnitBlockKind[]; opts: UnitBlockOpts };

export type UnitBlock = UnitStep & {
  block: 1 | 2 | 3 | 4 | 5;
  /** Minuten (Deckel für die Planung, bricht nichts ab). */
  min: number;
  channel: UnitChannel;
};

export type UnitShape = 'full' | 'short' | 'sat' | 'sun';

/**
 * Der Plan eines Lerntags. Er hängt nie von `env` ab (Prüfung M5) und wird je Lerntag eingefroren:
 * Rückfälle ohne KI oder Sprachausgabe entscheidet `resolveBlock` erst beim Blockstart.
 */
export type UnitPlan = {
  v: 1;
  day: string;
  wk: string;
  /** 1 = Montag … 7 = Sonntag */
  dow: number;
  theme: ThemeId;
  themeBy: 'auto' | 'user';
  /** Bestätigungskarte vor Block 1 (erster Lerntag der Woche ohne gespeichertes Thema, M10). */
  confirmTheme: boolean;
  shape: UnitShape;
  short: boolean;
  goalMin: number;
  /** Zeitbudget für Block 1 in Sekunden (M2); die Reparatur-Zeit geht davon ab. */
  reviewSec: number;
  blocks: readonly UnitBlock[];
  /** `plan.duty`: „x von n“ kommt immer aus `duty.length`. */
  duty: readonly UnitChannel[];
  minutes: number;
};

export type UnitPrefs = {
  /** Tagesziel in Minuten (`GOAL_MIN_OPTIONS`), gültig ab dem Lerntag, an dem der Plan entsteht (M3). */
  goalMin?: number;
  /** Tage bis zum nächsten Termin (`meeting/*`); 0–3 → Generalprobe am Donnerstag. */
  meetingInDays?: number | null;
  /** Geplanter Umfang von Block 1 (`goal.review`); 0 → Block 1 entfällt (M2). */
  reviewCount?: number;
  /** Geplante Minuten von Block 1 bei Rückstand (nie unter dem Grundwert, höchstens `REVIEW_MIN_MAX`). */
  reviewMin?: number;
  /** Vorrang beim Themenvorschlag (N17). */
  themeHint?: ThemeHint;
};

export type ThemeHint = { meeting?: ThemeId | null };

/** Dokument `app/week` (Plan §4.10). */
export type WeekCur = { wk: string; theme: ThemeId; by: 'auto' | 'user'; at?: number };
export type WeekHist = { wk: string; theme: ThemeId; by: 'auto' | 'user' };
export type WeekStoredTargets = { wk: string; traps: string[]; tool: string };
/** Vorrang-Hinweis (N17): Thema eines Termins in Kalenderwoche `wk`. */
export type WeekHint = { wk: string; theme: ThemeId; src: 'meeting' };
export type WeekDoc = {
  v: 1;
  cur?: WeekCur;
  hist?: WeekHist[];
  targets?: WeekStoredTargets;
  hint?: WeekHint;
};

export type WeekTargets = {
  wk: string | null;
  theme: ThemeId | null;
  /** ≤ 3 Fallen: eigene Muster-IDs zuerst, dann Startsatz (`f01`…). */
  traps: string[];
  /** Werkzeug der Woche (Grammatik-ID). */
  tool: string | null;
  goals: ThemeGoal[];
  /** Die 5 Wendungen der Woche (Englisch). */
  phrases: string[];
};
