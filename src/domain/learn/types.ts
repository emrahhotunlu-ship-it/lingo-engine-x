import type { Grade, Lang } from '../srs/types';

// Gemeinsame Typen von Phase 2 (docs/phase2-plan.md §10.1, S0a). Nur der Lead ändert diese
// Datei; die Pakete A, B, C, D und E bauen darauf auf.

export type Ctx = 'rev' | 'duty' | 'xtra';
export type LearnAct = 'lesson' | 'gram' | 'dictate' | 'cloze' | 'order' | 'sprint';
export type ChannelId = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order' | 'listen' | 'read' | 'write' | 'speak' | 'discover';
export type ExecChannel = 'gram' | 'vocab' | 'sprint' | 'dictate' | 'cloze' | 'order';
export type DutyChannel = 'gram' | 'cloze' | 'order';
export type Verdict = 'correct' | 'near' | 'wrong';
export type GrammarTaskType = 'mc' | 'gap' | 'transform' | 'correct';
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
};

export type Help = { level: 0 | 1 | 2; replays?: number };
export type WordOp = { op: 'eq' | 'typo' | 'sub' | 'ins' | 'del'; given?: string; expected?: string };
export type GrammarCheck = {
  verdict: Verdict;
  kind?: 'typo' | 'uk' | 'contraction' | 'alt' | 'form';
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
