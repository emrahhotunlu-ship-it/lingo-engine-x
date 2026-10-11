import type { C1Item, C1Kind } from '../c1x/types';
import type { TaskWhy } from '../explain/types';
import type { Grade, Lang } from '../srs/types';

// Gemeinsame Typen von Phase 2 (docs/phase2-plan.md §10.1, S0a). Nur der Lead ändert diese
// Datei; die Pakete A, B, C, D und E bauen darauf auf.

export type Ctx = 'rev' | 'duty' | 'xtra';
export type LearnAct = 'lesson' | 'gram' | 'dictate' | 'cloze' | 'order' | 'sprint';
export type ChannelId = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order' | 'listen' | 'read' | 'write' | 'speak' | 'discover';
export type ExecChannel = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order';
/** `order` nur noch in gespeicherten Plänen (seit „Sag es“ freiwillig); `say` = „Sag es“ (Lernberatung V1/V2). */
export type DutyChannel = 'gram' | 'cloze' | 'order' | 'say';
export type Verdict = 'correct' | 'near' | 'wrong';
/** `meaning`, `find` und `kwt` sind Aufgabenarten von Lernplattform 2.0 (docs/umbau/lernplattform-2.md §4.7). */
export type GrammarTaskType = 'mc' | 'gap' | 'transform' | 'correct' | 'meaning' | 'find' | 'kwt';
export type TaskSrc = 'seed' | 'daily' | 'pool' | 'lesson' | 'ai' | 'review';

export type GrammarTask = {
  /** Schlüssel der alten App (`legacyTaskKey(prompt)`), Grundlage von `seen` und Pool-Abgleich. */
  key: string;
  topic: string;
  type: GrammarTaskType;
  prompt: string;
  answer: string;
  accepted: string[];
  options: string[] | null;
  hint: string | null;
  expl: { de: string | null; en: string | null };
  src: TaskSrc;
  /** Herkunft, z. B. `daily/2026-09-27` oder `lesson/l07`. */
  ref: string | null;
  /** Zeitstempel des Fehlereintrags, wenn die Aufgabe eine Fehler-Wiederholung ist. */
  errorT: number | null;
  /** Muster-Kennung (Lernplattform 2.0 §3.1). */
  pat?: string | null;
  /** Aufgabengenaue Begründung (Lernplattform 2.0 §3.1). */
  why?: TaskWhy | null;
  /** Zusatzdaten der neuen Aufgabenarten `kwt`, `find` und `meaning` (Lernplattform 2.0 §3.4); `prompt` trägt dort den Rahmensatz, den Satz bzw. Satz a. */
  x?: TaskExtra;
  /** Aufgabe des Aufgabensystems c1x (Lernplattform 3.0 §3.2): der Rahmen zeigt dann `<C1Item/>`; die alten Felder bleiben die Wahrheit für `seen`, Fehlersätze und Protokoll. */
  c1?: C1Item;
};

/** `kwt`: Ausgangssatz, Schlüsselwort (Großbuchstaben), erlaubte Wortzahl in der Lücke. `find`: Wortbereich des Fehlers (`null` = fehlerfrei) und der ganze richtige Satz. `meaning`: Satz a und b, Frage. */
export type TaskExtra =
  | { kind: 'kwt'; from: string; key: string; words: [number, number] }
  | { kind: 'find'; err: [number, number] | null; fixed: string | null }
  | { kind: 'meaning'; a: string; b: string; q: { de: string; en: string } };

export type Help = { level: 0 | 1 | 2; replays?: number };
export type WordOp = { op: 'eq' | 'typo' | 'sub' | 'ins' | 'del'; given?: string; expected?: string };
export type GrammarCheck = {
  verdict: Verdict;
  kind?: 'typo' | 'uk' | 'contraction' | 'alt' | 'form' | 'key' | 'words';
  /** US-Form als Hinweis, wenn britisch geantwortet wurde (A7.3). */
  us?: string;
  ops: WordOp[];
  /** Lokal abgelehnt, frei formuliert und lang genug: das KI-Urteil darf gefragt werden (D13). */
  needsJudge: boolean;
};
export type Timing = { submitMs: number; firstKeyMs?: number; units?: number; replays?: number };

export type GrammarAnswer = {
  kind: 'g';
  t: number;
  day: string;
  lang: Lang;
  ctx: Ctx;
  task: GrammarTask;
  given: string;
  dontKnow: boolean;
  verdict: Verdict;
  grade: Grade;
  ms: number;
  help: Help;
  judged: 'local' | 'ai' | 'noai';
  /** Einspruch „Ich lag richtig" (M4): als richtig gewertet, höchstens „Gut", im Log `override:true`. */
  override?: boolean;
  /** Erster, falscher Versuch vor dem Hinweis (Selbstkorrektur): zählt für Beherrschung und Fehler als falsch. */
  firstWrong?: string;
  /** Eingabeprofil der Runde: Touch oder Tastatur (Lernplattform 2.0 §3.1). */
  dev?: 't' | 'k';
  /** Letzte Antwort des Vortests (§5.3): trägt das Ergebnis beider Aufgaben; der Schreibweg legt daraus `vt` im Thema an. */
  vt?: { ok: boolean; pats: string[] };
  /** Kapitel-Arbeit (K4): letzte Antwort eines Themen-Tests, trägt das Ergebnis (richtig, gestellt); der Schreibweg legt daraus `tt` im Thema an. */
  tt?: { c: number; n: number };
  /** c1x (Lernplattform 3.0 §3.4): Punkte `[erreicht, möglich]`. Gebucht wird `ok` nur bei voller Punktzahl; „1 von 2“ ist „Fast“. */
  pts?: [number, number];
  /** Art der c1x-Aufgabe. */
  c1k?: C1Kind;
  /** Der urteilstragende Anteil wurde getippt (freier Abruf). Auswahl und Bausteine allein nie: sie setzen das Hilfe-Bit der Muster. */
  free?: boolean;
  /** Antwort aus einer Tempo-Runde: im Protokoll `tp: true`, zählt nicht für K6 (P44-Nachbesserung). */
  tempo?: boolean;
  /** Zweite Sicht einer schon gesehenen Aufgabe: hebt BKT nie, setzt das Bit „ohne Hilfe“ nicht. */
  again?: boolean;
  /** Zahl der Wahlmöglichkeiten für die Ratekorrektur im BKT (z. B. `pair` = 6, `err` Fundort = Wortzahl); sonst aus der Aufgabenart. */
  nOpt?: number;
};

/** Quellen: g Grammatik, s Sprint, w Schreiben, v Vokabeln (alte App); k Sprechen, b Business (Phase 3). */
/** Quellen der alten App: g Grammatik/Preply, w Schreiben, r Lesen, v Vokabeln, s Sprint; k Sprechen, b Business. */
export type RadarEvent = { c: string; s: 'g' | 's' | 'w' | 'r' | 'v' | 'k' | 'b'; t: number; q: string; g: string; a: string };

export type DrillAnswer = {
  kind: 'x';
  t: number;
  day: string;
  lang: Lang;
  ctx: Ctx;
  type: 'dictate' | 'cloze' | 'order' | 'lesson-q';
  q: string;
  given: string;
  ans: string;
  verdict: Verdict;
  grade: Grade;
  ms: number;
  lesson?: string;
  radar?: RadarEvent;
  /** Einspruch „Ich lag richtig" (M4). */
  override?: boolean;
  /** Eingabeprofil der Runde: Touch oder Tastatur (Lernplattform 2.0 §3.1). */
  dev?: 't' | 'k';
};

export type SprintEntry = { t: number; score: number; ok: number; n: number; avgMs: number; combo: number };

export type LearnRoundEnd = {
  day: string;
  act: LearnAct;
  ctx: Ctx;
  partial: boolean;
  n: number;
  right: number;
  activeMs: number;
  sprint?: SprintEntry;
  lessonAi?: boolean;
};

export type LessonDone = { lid: string; day: string; t: number; n: number; ok: number };

export type LessonMeta = {
  id: string;
  unit: string;
  kind: string;
  grammar: string;
  level: string;
  de: string;
  en: string;
  cando_de: string;
  cando_en: string;
  situation: string;
  words: Array<[en: string, de: string]>;
};

export type LessonContent = {
  words: Array<{ en: string; de: string; pos: string; def: string; ex: string }>;
  dialogue: { title: string; lines: Array<{ sp: string; en: string; de: string }> };
  /** Bereits in der Oberflächensprache aufgelöst. */
  questions: Array<{ q: string; options: string[]; answer: string }>;
  tasks: GrammarTask[];
  output: { de: string; en: string; mustUse: string[] } | null;
  source: 'db' | 'ai' | 'base';
};

export type GrammarItemProps = { task: GrammarTask; ctx: Ctx; p: number; onDone(a: GrammarAnswer): void };

/** Aufzeichnung (implementiert in features/progress/persist.ts, genutzt von B, C, D). */
export interface LearnRecorder {
  /** grammar/<topic> sofort + Log/Zähler/Radar in den Puffer. */
  grammar(a: GrammarAnswer): Promise<boolean>;
  /** Puffer (Sprint-Antworten nicht). */
  drill(a: DrillAnswer): void;
  radar(e: readonly RadarEvent[]): void;
  /** act, Minuten, sprints; sofort speichern. */
  roundEnd(r: LearnRoundEnd): Promise<boolean>;
  /** app/course im Sammel-Stapel, sofort. */
  lessonDone(d: LessonDone): Promise<boolean>;
}
