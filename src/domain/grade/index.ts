import type { Grade } from '../srs/types';

// EINE Notentabelle (Gesamtkonzept 3.6, Umbau Fokus): Note 1 bis 4 allein aus Richtigkeit, Zeit, Hilfe (H0 bis H3) und Eingabeform
// (Auswahl, Tippen, Bausteine, Umformen). `srs/grade.ts` (Wörter) und `learn/grade.ts` (Grammatik, Übungen) delegieren hierher;
// es gibt keine zweite Tabelle. Gleiche Eingabe ergibt immer dieselbe Note. Die Gewichtung der Note für FSRS bleibt in `srs/weight.ts`.
//
// Hinweisleiter: H0 keine Hilfe · H1 Tipp (Note höchstens 3) · H2 erster Buchstabe oder zweiter Versuch (höchstens 2) · H3 Lösung gezeigt
// bzw. „Weiß ich nicht“ (immer 1).
//
// Bewusste Angleichung gegenüber den zwei früheren Tabellen: Hören und Diktat geben je Wiederholung 1,2 s Zeitzuschlag (vorher nur bei
// Wörtern), und mehr als zwei Wiederholungen zählen als Hilfe 1 (vorher nur bei Grammatik und Übungen). Das Prüfen auf langsames Tippen
// und Löschen gilt, sobald die Länge (`chars`) bzw. die Löschungen angegeben sind.

export type Verdict = 'correct' | 'near' | 'wrong';
export type HelpLevel = 0 | 1 | 2 | 3;
export type GradeForm = 'choice' | 'typed' | 'tiles' | 'transform' | 'timed' | 'free';

/** Übungsart (Wörter: ExerciseId) oder Aufgabenart (Grammatik und Übungen) als Schlüssel der Tabelle. */
export type GradeKey =
  | 'mc_en'
  | 'mc_de'
  | 'match'
  | 'listen_mc'
  | 'spot'
  | 'colloc'
  | 'cloze_hint'
  | 'cloze'
  | 'type'
  | 'situation'
  | 'dictation'
  | 'tiles'
  | 'speed'
  | 'produce'
  | 'flip'
  | 'mc'
  | 'gap'
  | 'transform'
  | 'correct'
  | 'dictate'
  | 'order';

type Row = {
  form: GradeForm;
  /** Bis hierhin „Gut“, darüber „Schwer“ (Millisekunden; bei Bausteinen Grundwert, dazu `PER_UNIT_MS` je Baustein). */
  good: number;
  /** Bis hierhin „Leicht“; `null` = nie „Leicht“ (Auswahl ist ratbar, Bausteine sind vorgegeben). */
  easy: number | null;
  /** Welche Zeit zählt: bis zum ersten Zeichen oder bis zum Abschicken bzw. zur Wahl. */
  measure: 'firstKey' | 'submit';
};

const choice = (good: number): Row => ({ form: 'choice', good, easy: null, measure: 'submit' });
const typed = (good: number, easy: number): Row => ({ form: 'typed', good, easy, measure: 'firstKey' });
const rewrite: Row = { form: 'transform', good: 20_000, easy: 8000, measure: 'submit' };

/** Die Tabelle: je Schlüssel Eingabeform und Zeitgrenzen. */
export const GRADE_TABLE: Readonly<Record<GradeKey, Row>> = {
  mc_en: choice(8000),
  spot: choice(8000),
  listen_mc: choice(8000),
  mc_de: choice(9000),
  match: choice(9000),
  colloc: choice(11_000),
  mc: choice(8000),
  cloze_hint: typed(6000, 2500),
  cloze: typed(8000, 3000),
  type: typed(8000, 3000),
  situation: typed(10_000, 4000),
  dictation: typed(6000, 2500),
  dictate: typed(6000, 2500),
  gap: typed(8000, 3000),
  transform: rewrite,
  correct: rewrite,
  // Bausteine: Grundwert plus 0,6 s je Baustein (Lesen und Ordnen), nie „Leicht“ (die Teile sind vorgegeben).
  tiles: { form: 'tiles', good: 9000, easy: null, measure: 'submit' },
  order: { form: 'tiles', good: 13_000, easy: null, measure: 'submit' },
  speed: { form: 'timed', good: 10_000, easy: null, measure: 'submit' },
  produce: { form: 'free', good: 0, easy: null, measure: 'submit' },
  flip: { form: 'free', good: 0, easy: null, measure: 'submit' },
};

export const formOf = (key: GradeKey): GradeForm => GRADE_TABLE[key].form;

/** Zeitzuschlag je Baustein (Bausteine). */
export const PER_UNIT_MS = 600;
/** Zeitzuschlag je Wiederholung des Vorlesens (Hören, Diktat). */
export const REPLAY_MS = 1200;
/** Mehr als so viele Wiederholungen zählen als Hilfe 1. */
export const FREE_REPLAYS = 2;

export type GradeInput = {
  key: GradeKey;
  verdict: Verdict;
  /** Millisekunden bis zur Wahl bzw. bis „Prüfen“. */
  timeMs: number;
  /** Millisekunden bis zum ersten getippten Zeichen (Tippen; Diktat ab Tonende). */
  firstKeyMs?: number;
  help?: HelpLevel;
  /** Länge der Lösung in Zeichen (nur Tippen, für die Prüfung auf langsames Tippen). */
  chars?: number;
  /** Gelöschte Zeichen (Rücktaste): drei und mehr deckeln „Leicht“ auf „Gut“. */
  deletions?: number;
  /** Zahl der Bausteine. */
  units?: number;
  /** Wiederholungen des Vorlesens. */
  replays?: number;
  /** Zeitgrenze und ob sie abgelaufen war (nur `speed`). */
  limitMs?: number;
  timedOut?: boolean;
};

function byTime(i: GradeInput): Grade {
  const row = GRADE_TABLE[i.key];
  const replays = Math.max(0, i.replays ?? 0);
  if (row.form === 'free') return 3;
  if (row.form === 'timed') {
    const G = i.limitMs ?? row.good;
    if (i.timedOut || i.timeMs > G) return 2;
    return i.timeMs <= 0.6 * G ? 4 : 3;
  }
  if (row.form === 'choice') return i.timeMs <= row.good + REPLAY_MS * replays ? 3 : 2;
  if (row.form === 'tiles') return i.timeMs <= row.good + PER_UNIT_MS * Math.max(0, i.units ?? 0) ? 3 : 2;
  const raw = row.measure === 'firstKey' ? (i.firstKeyMs ?? i.timeMs) : i.timeMs;
  const t = raw - (i.key === 'dictation' || i.key === 'dictate' ? REPLAY_MS * replays : 0);
  let g: Grade = row.easy !== null && t <= row.easy ? 4 : t <= row.good ? 3 : 2;
  if (g === 4 && i.chars !== undefined) {
    const slowTyping = i.timeMs > t + 1000 * i.chars + 5000;
    if ((i.deletions ?? 0) >= 3 || slowTyping) g = 3;
  }
  return g;
}

/** Die Note einer Antwort: falsch 1, fast richtig 2, richtig nach Zeit 2/3/4, gedeckelt durch die Hilfe. */
export function gradeAnswer(i: GradeInput): Grade {
  const help = i.help ?? 0;
  if (i.verdict === 'wrong' || help >= 3) return 1;
  if (i.verdict === 'near') return 2;
  const g = byTime(i);
  const level = Math.max(help, (i.replays ?? 0) > FREE_REPLAYS ? 1 : 0);
  if (level >= 2) return Math.min(g, 2) as Grade;
  if (level === 1) return Math.min(g, 3) as Grade;
  return g;
}
