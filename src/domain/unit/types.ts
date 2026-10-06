import type { ThemeGoal, WeekTheme } from '../../content/nb/themes';
import type { StepArgs } from '../plan/types';

// Typen der Tageseinheit und des Wochenplans (Plan §1.5, §4.10, Prüfung Tageseinheit M1–M10, S1–S5).
// Rein, ohne React und ohne Datenbank. `UnitBlockKind` entspricht wörtlich dem Vertrag in Plan §4.10.

export type { ThemeGoal, WeekTheme };

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

export type UnitEnv = { ai: boolean; tts: boolean };

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
  /** Schritt-Argumente der Regelversion 2 (`errs`, `repairs`, `limit`); fehlt bei der alten Regel. */
  args?: StepArgs;
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
  shape: UnitShape;
  short: boolean;
  goalMin: number;
  /** Zeitbudget für Block 1 in Sekunden (M2); die Reparatur-Zeit geht davon ab. */
  reviewSec: number;
  blocks: readonly UnitBlock[];
  /** `plan.duty`: „x von n“ kommt immer aus `duty.length`. */
  duty: readonly UnitChannel[];
  minutes: number;
  /** Regelversion (Lernplattform 2.0 §2.3): `2` = Schritt 1 ohne Reparatur-Sätze, Grammatik ohne Fehlersätze, Schritt 4 mit `limit`. Fehlt = alte Regel. */
  rv?: 2;
  /** Wiedereinstieg (Gesamtkonzept 3.2): `reduced` = nur 3 Grammatikaufgaben, Satzbau pausiert; `restart` = Neustart-Woche (kleiner Plan). */
  comeback?: ComebackMode;
};

/** Plan-Form nach einer Pause (`domain/plan/comeback`). */
export type ComebackMode = 'reduced' | 'restart';

export type UnitPrefs = {
  /** Tagesziel in Minuten (`GOAL_MIN_OPTIONS`), gültig ab dem Lerntag, an dem der Plan entsteht (M3). */
  goalMin?: number;
  /** Tage bis zum nächsten Termin (`meeting/*`); 0–3 → Generalprobe am Donnerstag. */
  meetingInDays?: number | null;
  /** Geplanter Umfang von Block 1 (`goal.review`); 0 → Block 1 entfällt (M2). */
  reviewCount?: number;
  /** Geplante Minuten von Block 1 bei Rückstand (nie unter dem Grundwert, höchstens `REVIEW_MIN_MAX`). */
  reviewMin?: number;
  /** Fehlersätze, die heute fällig sind (nicht vom Anlegetag); 0 → der Schritt „Fehler korrigieren“ entfällt. Fehlt der Wert, bleibt der Schritt (ältere Pläne). */
  fixDue?: number;
  /** Wiedereinstieg: kleinerer Plan nach einer längeren Pause. */
  comeback?: ComebackMode;
  /** Regelversion; `2` schaltet Plan v2 ein (§2.3). Nur die Koordination stellt `PLAN_RV` um. */
  rv?: 1 | 2;
};

/**
 * Wochenziele (Rest aus dem früheren Wochenthema): seit dem Fokus-Umbau immer leer (`EMPTY_TARGETS`). Der Typ bleibt, weil
 * Block-Kontext, Fokus-Runde und Einwand-Training ihn noch durchreichen; neue Pläne schreiben nichts davon.
 */
export type WeekTargets = {
  wk: string | null;
  theme: string | null;
  /** ≤ 3 Fallen: eigene Muster-IDs zuerst, dann Startsatz (`f01`…). */
  traps: string[];
  /** Werkzeug der Woche (Grammatik-ID). */
  tool: string | null;
  goals: ThemeGoal[];
  /** Die 5 Wendungen der Woche (Englisch). */
  phrases: string[];
};

export const EMPTY_TARGETS: WeekTargets = { wk: null, theme: null, traps: [], tool: null, goals: [], phrases: [] };
