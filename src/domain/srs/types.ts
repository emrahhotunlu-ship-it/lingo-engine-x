import type { FsrsStored } from '../../data/schemas';

// Gemeinsame Typen des Vokabeltrainers (Architektur-Entwurf §5.0, Daten-Entwurf §1.1).

export type Grade = 1 | 2 | 3 | 4;
export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
export type Lang = 'de' | 'en';

/**
 * Übungsarten (phase1-plan §4.2). Die IDs folgen der alten App, wo sie dieselbe Übung kannte
 * (Daten-Entwurf 1.2). `situation` = Wendung „aus der Situation heraus“ (M15, nur Wendungen mit Szene).
 */
export type ExerciseId =
  | 'mc_en'
  | 'spot'
  | 'listen_mc'
  | 'mc_de'
  | 'match'
  | 'cloze_hint'
  | 'tiles'
  | 'type'
  | 'cloze'
  | 'colloc'
  | 'situation'
  | 'dictation'
  | 'speed'
  | 'produce'
  // Lernplattform 2.0 (§4.8): „Was heißt das hier?“, Partnerwort-Lücke, Satz vervollständigen, Wortfamilie, Falle finden.
  | 'ctx_mc'
  | 'colloc_gap'
  | 'complete'
  | 'wordfam'
  | 'find_trap'
  /** Anki „Aufdecken“ (anki-regeln.md): nie automatisch gewählt, nur über `pickMode`. */
  | 'flip'
  /** Lernplattform 3.0 P52: „Welches Wort passt?“ mit dem Kontrast-Satz von Claude (`cfx`); nie automatisch gewählt, nur von der Runde eingesetzt. */
  | 'contrast';
/** Modus der alten App (Schlüssel in `modes` und `hist[].m`). */
export type LegacyMode = 'recog' | 'cloze' | 'type' | 'colloc' | 'listen' | 'produce';
export type InputKind = 'choice' | 'typed' | 'spot' | 'tiles' | 'produce' | 'flip' | 'sentence';

/** Satz mit markierter Stelle: `sentence.slice(start, end) === gap`. */
export type ContextSpan = { sentence: string; start: number; end: number; gap: string };
/** `ai`: von Claude ergänzt (`collocs.ts`): kann Fehler enthalten, „Ich lag richtig“ ist erlaubt. */
export type Colloc = { index: number; p: string; de: string; gap: string; opts: string[]; ctx: ContextSpan | null; ai?: boolean };
export type Counts = { c: number; w: number };

/** Herkunft und Zusatzangaben einer Wendung (`chunk/<id>`, altapp-analyse §5). */
export type ChunkInfo = {
  register: string | null;
  why: string | null;
  /** Sprache von `why` (fehlt bei Wendungen der alten App: dann Deutsch). */
  whyLang: Lang | null;
  /** Eigener Satz im Gespräch bzw. im Entwurf („Damals hattest du gesagt“). */
  utterance: string | null;
  /** Aufgewertete Fassung – der Ursprungssatz der Karte. */
  upgraded: string | null;
  /** Szene (Rollenspiel) oder null (Mail, Pitch, Baukasten). */
  scene: string | null;
  sceneTitle: string | null;
  /** 'scene' | 'mail' | 'pitch' | 'biz' | … */
  srcKind: string;
  /** Titel der Quelle (Szene, „Email Refiner“ …). */
  title: string | null;
};

export type CardKind = 'vocab' | 'chunk';

export type TrainCard = {
  /** Vokabel (`vocab/<id>`) oder Wendung (`chunk/<id>`). */
  kind: CardKind;
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
  /** Übungsart der letzten Antwort (`hist[].x`, nur von dieser App geschrieben). */
  lastEx: string | null;
  /** Nur bei Wendungen. */
  chunk: ChunkInfo | null;
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
  /** Vorgelesener Text (listen_mc, dictation). */
  speak?: string;
  /** Bausteine (tiles). */
  tiles?: Tile[];
  /** Zeitgrenze in ms (speed). */
  limitMs?: number;
  /** Szene und Absicht (situation, M15). */
  situation?: SituationTask;
  /** Anki (anki-regeln §1): getippte Kontrolle nach „Leicht“ bzw. Prüfabfrage nach „Gut“. */
  check?: 'control' | 'probe' | 'known';
  /** Nur `flip`: Richtung der Karte (§8). */
  dir?: 'de-en' | 'en-de';
  /** `complete`: Satzanfang aus dem Paket (sonst frei). */
  start?: string | null;
  /** `wordfam`: das Familienmitglied, aus dem das gesuchte Wort gebildet wird (Wortart, Wort). */
  famFrom?: { pos: 'noun' | 'verb' | 'adj' | 'adv'; word: string } | null;
  /** `find_trap`: Übungssatz der Falle und die falsch benutzte Stelle darin. */
  trap?: { id: string; sentence: string; start: number; end: number } | null;
  /** Lernplattform 3.0 P52: der Satz stammt von Claude (`wx` bzw. `cfx`): die Übung zeigt `AiMark`, „Melden“ markiert genau diesen Satz. */
  ai?: { tpl: string; kind: 'wx' | 'cfx'; en: string } | null;
  /** `contrast`: Begründung von Claude, zweisprachig (gezeigt in der Oberflächensprache). */
  contrastWhy?: { de: string; en: string } | null;
};

/** Baustein (tiles): Text und ob er ein Fremdbaustein ist. */
export type Tile = { id: number; text: string; distractor: boolean };

/** Aufgabe „aus der Situation heraus“ (M15). */
export type SituationTask = {
  sceneTitle: string;
  situation: string;
  counterpart: string;
  intent: string;
  then: string;
  upgraded: string;
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
  /** Vokabel (`v`) oder Wendung (`chunk`). */
  kind: 'v' | 'chunk';
  id: string;
  ex: ExerciseId;
  /** Nur Wendungen: die Wendung selbst (Protokoll `q`, Form der alten App). */
  q?: string;
  grade: Grade;
  given: string;
  ans: string;
  ms: number;
  lang: Lang;
  /** Pflichtrunde „Wiederholen", Pflicht der Lektion (Phase 2) oder freiwillige Extra-Runde. */
  ctx: 'rev' | 'duty' | 'xtra';
  /** Lektion, aus deren Wörter-Schritt die Antwort stammt (Phase 2, D17). */
  lesson?: string;
  colIndex?: number;
  /** Schlüssel des gezeigten Satzes (`sentKey`, V1): kommt als `s` in `hist`, damit derselbe Satz nicht zweimal in Folge kommt. */
  sx?: string;
  /** Eingabeprofil der Runde: Touch oder Tastatur (Lernplattform 2.0 §3.1). */
  dev?: 't' | 'k';
  /** Einspruch „Ich lag richtig" (M4): als richtig gewertet, höchstens „Gut", im Log `override:true`. */
  override?: boolean;
  /** Genutzter Tipp (1 Platzhalter, 2 erster Buchstabe): gewichtet die Antwort geringer (`weight.ts`). */
  hint?: 0 | 1 | 2;
  /** Prüfabfrage bzw. Kontrolle (`flip.ts`). */
  check?: 'probe' | 'control';
  /** Aufdecken im Aufholmodus: gilt nur als schwacher Beleg (`weight.ts`). */
  catchUp?: true;
};

export type WhyPart = { key: string; vars?: Record<string, string | number>; lang?: Lang };
