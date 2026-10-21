import type { FsrsStored } from '../../data/schemas';
import type { ActTask } from './actTask';
import type { Brief } from './brief';

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
  /** WL (19.10.2026): „Passt das Wort in diesen Satz?“ Ja/Nein mit Begründung (Stufe 1, nur Wörter): zweite Abfrage-Familie neben „Bedeutung wählen“. */
  | 'fits'
  | 'spot'
  | 'listen_mc'
  | 'mc_de'
  | 'match'
  | 'cloze_hint'
  | 'tiles'
  | 'type'
  | 'cloze'
  /** WL: nur Wendungen: EIN Wort der Wendung als freie Lücke im Satz (Stufe 3). Eigener Verlaufsschlüssel, damit das Tor sie zählen kann: höchstens ein Tag für Stufe 4, nie für Stufe 5. */
  | 'cloze_part'
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
  | 'contrast'
  // Wörter aktivieren, Stufe 2 (docs/umbau/aktivierung.md): A2 Mini-Szene, A3 Umformen, A4 ohne gezeigtes Wort, A5 Kombi-Satz und Kundenmail. Nie automatisch gewählt,
  // nur vom Fahrplan eingesetzt (`fahrplan.ts`); Stufe 0 im Katalog, `supports` liefert immer `false`.
  | 'act_scene'
  | 'act_rewrite'
  | 'act_impulse'
  | 'act_combo'
  | 'act_mail'
  /** Wort-Lernen 2: „Sag es“ – die deutsche Absicht auf Englisch sagen (Diktiertaste der Handytastatur, kein Mikrofonzugriff). Frei, ab 2 freien Tagen. */
  | 'say_it';
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
  /** Schon eine Wortpartner-Aufgabe (`colloc`, `colloc_gap`) an diesem Lerntag? Dann keine weitere (höchstens eine je Karte und Tag). */
  partnerToday?: true;
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
  /** `produce` („Eigener Satz“): Lage, Satzform, Ton und Zeitform dieser Aktivierung (`brief.ts`). */
  brief?: Brief;
  /** Aktivierungs-Aufgabe A2–A5 (`act_*`): Format, Vorgaben, Zielwörter, Quelle (`actTask.ts`). */
  act?: ActTask;
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
  /**
   * Wort-Lernen 2 (`spacing.ts`, `recallStep`): Abruf 1 bzw. 2 am Einführungstag (`day0a`, `day0b`) oder der erste Abruf nach dem
   * Einführungstag (`yesterday` = „Gestern-Check“, `first` = späterer erster Abruf). Nur Beschriftung; die Planung kennt es nicht.
   */
  recall?: 'day0a' | 'day0b' | 'yesterday' | 'first';
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
  /** `fits`: stimmt der Satz (das Wort passt) oder nicht? Bei „passt nicht“ das Wort, das hier eigentlich steht. */
  fits?: { truth: boolean; foil: { word: string; meaning: string | null } | null };
  /** `contrast`: Begründung von Claude, zweisprachig (gezeigt in der Oberflächensprache). */
  contrastWhy?: { de: string; en: string } | null;
  /** Wort-Werkstatt: Abruf am Ende der Werkstatt (schreibt `wk` und die Ruhe danach). */
  wk?: true;
  /** `say_it` („Sag es“): deutsche Absicht, die auf Englisch gesagt (diktiert) wird, und der englische Mustersatz. */
  sayIt?: { de: string; model: string | null };
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

/** `contrast` (P52): „Welches Wort passt?“ zusätzlich direkt nach der regulären Abfrage derselben Karte (höchstens 1 je Runde). */
/** `werkstatt` (Wort-Lernen 2, `werkstatt.ts`): die Karte wird erst neu verankert (Werkstatt-Karte), dann folgt ein gestützter Abruf (`Exercise.wk`). */
/**
 * Eintrag der Runde. `wk` (nur `phase: 'quiz'`): Abruf der Wort-Werkstatt – 1 = verzögerter Abruf drei Karten nach der Werkstatt,
 * 2 = einmalige Wiederholung nach einem Fehler (wieder drei Karten später).
 */
export type QueueItem = { key: string; reason: 'due' | 'new' | 'ahead' | 'again' | 'contrast'; phase: 'intro' | 'quiz' | 'werkstatt'; wk?: 1 | 2 };

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
  /** Code der Vorgabe eines eigenen Satzes (`brief.ts`, < 40 Zeichen): kommt als `a` in `hist`, damit die nächste Aktivierung anders ausfällt. */
  act?: string;
  /** Schritt des Fahrplans (1–5), wenn die Antwort eine Aktivierung war: der Kartenzähler `na` steigt im selben Schreibschritt (Note ≥ 2). */
  actStep?: 1 | 2 | 3 | 4 | 5;
  /** Die Aktivierung war nicht von Claude geprüft, abgeschrieben oder mit Hilfe der Vorprüfung: Der Verlaufseintrag trägt `u: 1`, `na` steigt nicht (Lernwissenschaft H1). */
  actUnverified?: true;
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
  /** Satzantwort ohne Prüfung durch Claude (lokale Prüfung): der Verlaufseintrag trägt `u: 1` und zählt nicht als freier Beleg (Lernwissenschaft N6). */
  unverified?: true;
  /** Richtige Antwort nach einer Unterbrechung (> 60 s, `wasInterrupted`): Note 3, hebt die Stufe aber nicht (kein Beleg für Können). Nicht gespeichert. */
  interrupted?: true;
  /** „Satz vervollständigen“ ohne Satzanfang (ganzer eigener Satz): wiegt wie „Satz bilden“ (`weight.ts`). Nicht im Protokoll. */
  free?: true;
  /** Falsche getippte Eingabe (Note 1, ≤ 40 Zeichen): kommt als `v` in `hist` (Diagnose der Wort-Werkstatt). */
  wrong?: string;
  /** Abruf am Ende der Wort-Werkstatt: schreibt `wk` und legt die Fälligkeit 2–3 Lerntage später (`werkstatt.ts`). */
  wk?: true;
};

export type WhyPart = { key: string; vars?: Record<string, string | number>; lang?: Lang };
