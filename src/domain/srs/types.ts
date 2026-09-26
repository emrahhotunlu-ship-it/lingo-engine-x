import type { FsrsStored } from '../../data/schemas';

// Gemeinsame Typen des Vokabeltrainers (Architektur-Entwurf §5.0, Daten-Entwurf §1.1).

export type Grade = 1 | 2 | 3 | 4;
export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
export type Lang = 'de' | 'en';

/** Übungsarten des MVP. Die IDs folgen der alten App, wo sie dieselbe Übung kannte (Daten-Entwurf 1.2). */
export type ExerciseId = 'mc_en' | 'mc_de' | 'cloze_hint' | 'type' | 'cloze' | 'colloc';
/** Modus der alten App (Schlüssel in `modes` und `hist[].m`). */
export type LegacyMode = 'recog' | 'cloze' | 'type' | 'colloc' | 'listen' | 'produce';
export type InputKind = 'choice' | 'typed';

/** Satz mit markierter Stelle: `sentence.slice(start, end) === gap`. */
export type ContextSpan = { sentence: string; start: number; end: number; gap: string };
export type Colloc = { index: number; p: string; de: string; gap: string; opts: string[]; ctx: ContextSpan | null };
export type Counts = { c: number; w: number };

export type TrainCard = {
  key: string;
  id: string;
  path: string;
  /** Gibt es das Dokument schon (sonst Startvokabel aus den Voreinstellungen)? */
  inDb: boolean;
  word: string;
  lemma: string;
  pos: string | null;
  de: string | null;
  def: string | null;
  context: ContextSpan | null;
  col: Colloc[];
  src: string | null;
  fsrs: FsrsStored;
  stage: Stage;
  isNew: boolean;
  hidden: boolean;
  xs: Record<string, Counts>;
  modes: Record<string, Counts>;
  lastMode: string | null;
  intro: string | null;
  order: number;
  added: string;
  doc: Readonly<Record<string, unknown>>;
};

export type Option = { id: string; label: string; lang: Lang; correct: boolean; fromWord?: string; fromMeaning?: string };

export type Exercise = {
  ex: ExerciseId;
  input: InputKind;
  card: TrainCard;
  /** Stufe der Abfrage (mindestens 1). */
  stage: Stage;
  /** Satz mit Lücke (Lückenübungen, Kollokation) bzw. mit hervorgehobenem Wort (mc_en). */
  sentence: ContextSpan | null;
  /** Bedeutung in der Oberflächensprache (Aufgabe bzw. Stütze). */
  meaning: string | null;
  /** Erster Buchstabe als Stütze (cloze_hint). */
  firstLetter: string | null;
  colloc: Colloc | null;
  options: Option[];
  /** Akzeptierte Lösungen (getippt) bzw. richtige Beschriftung (Auswahl); `accepted[0]` wird angezeigt. */
  accepted: string[];
};

export type QueueItem = { key: string; reason: 'due' | 'new' | 'ahead' | 'again'; phase: 'intro' | 'quiz' };

export type Verdict = 'correct' | 'near' | 'wrong';
export type CheckResult = {
  verdict: Verdict;
  /** Britische Schreibweise oder britisches Wort: zählt als richtig (A7.3). */
  variant?: 'uk';
  us?: string;
  /** synonym: gewählte Option bedeutet dasselbe (auch möglich, gesucht war die Lösung). */
  kind?: 'typo' | 'form' | 'confusable' | 'synonym';
  /** Für die goldene Markierung: je Zeichen der Eingabe, ob es abweicht. */
  marks?: boolean[];
  otherWord?: string;
};

/** Eine bewertete Antwort (Daten-Entwurf 1.1). */
export type AnswerEvent = {
  /** ms, je Gerät streng steigend – zugleich die Kennung der Antwort. */
  t: number;
  /** Lerntag des Rundenbeginns. */
  day: string;
  kind: 'v';
  id: string;
  ex: ExerciseId;
  grade: Grade;
  given: string;
  ans: string;
  ms: number;
  lang: Lang;
  /** Pflichtrunde oder freiwillige Extra-Runde. */
  ctx: 'rev' | 'xtra';
  colIndex?: number;
};

export type WhyPart = { key: string; vars?: Record<string, string | number>; lang?: Lang };
