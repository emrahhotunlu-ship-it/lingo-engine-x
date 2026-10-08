// Gemeinsame Typen für Sprechen (Phase 3, Plan §10 „Schnittstellen, in S0 festgelegt").
// Reine Daten, ohne Abhängigkeit von zod oder der Oberfläche.

export type Lang = 'de' | 'en';

/** Ein Zug im Rollenspiel. `usedChip`: eine vorgeschlagene Wendung wurde per Tipp eingefügt. */
export type Turn = {
  role: 'persona' | 'me';
  text: string;
  t: number;
  usedChip?: boolean;
  truncated?: boolean;
  /** LP3 P51: Text ganz oder teilweise eingefügt (Paste/Drop); das Gespräch zählt dann nie für K7. */
  pasted?: boolean;
};

export type Verdict = 'clean' | 'minor' | 'errors';

/** `pat` (turn-analysis@3, LP3 P51): Kennung aus der Musterliste des Kapitels, sonst fehlt das Feld. */
export type AnalysisError = { wrong: string; right: string; cat: string; why: string; pat?: string };
export type AnalysisChange = { from: string; to: string; why: string };

/** Wendungsvorschlag aus einer Analyse (höchstens 3 je Zug). */
export type ChunkSuggestion = {
  en: string;
  de: string;
  def: string;
  kind: 'collocation' | 'frame' | 'phrase';
  register: 'formal' | 'neutral' | 'informal';
  why: string;
};

/** Die drei Schichten einer Analyse (Plan §5.3/§6.2). */
export type AnalysisView = {
  verdict: Verdict;
  english: boolean;
  errors: AnalysisError[];
  upgraded: string;
  changes: AnalysisChange[];
  lands: string;
  chunks: ChunkSuggestion[];
  targets: string[];
  /** turn-analysis@3 (LP3 P51): Muster der Kapitelliste, die im Satz richtig benutzt wurden (Kapitelziel). */
  used?: string[];
  /** turn-analysis@3: Claudes zweite, unabhängige Fehlerzählung (K7, Mittelwert mit der Liste); `null` = keine. */
  count?: number | null;
};

export type AnalysisState = 'pending' | 'done' | 'failed' | 'skipped';
export type AnalysisSlot = { state: AnalysisState; data?: AnalysisView; lang?: Lang };

export type Persona = { name: string; role: string; org: string; traits: string };

/** Szene in Oberflächensprache (Rückfall Englisch), zusammengeführt aus Inhalt und Datenbank. */
export type SceneView = {
  id: string;
  src: 'legacy' | 'db' | 'ai';
  title: string;
  titleEn: string;
  situation: string;
  situationEn: string;
  goal: string;
  goalEn: string;
  persona: Persona | null;
  stake: string;
  objection: string;
  opening: string;
  useful: Array<{ en: string; de: string }>;
  level: string;
  runs: number;
  lastRun: number | null;
  /** Fokus einer KI-Szene. */
  gram: string | null;
  words: string[];
  valid: boolean;
  raw: Record<string, unknown>;
};

/** Verdichtete Zeile eines Gesprächs (u/up ≤ 200 Zeichen). */
export type TalkLine = { u: string; up: string; v: Verdict | 'na'; c: string[] };

export type StoredReport = {
  lang: Lang;
  goal: { state: 'reached' | 'partly' | 'missed'; why: string };
  summary: string;
  strengths: Array<{ quote: string; why: string }>;
  focus: Array<{ title: string; said: string; better: string; why: string; cat: string }>;
  phrases: Array<{ en: string; de: string; def: string; ex: string }>;
  /** roleplay-report@3 (C1-Werkzeugkasten): abgeschwächt, strukturiert, betont? Fehlt in älteren Berichten. */
  toolkit?: ToolkitNote[];
  t: number;
};

export type ToolkitSkill = 'hedge' | 'structure' | 'emphasis';
export type ToolkitNote = { skill: ToolkitSkill; used: boolean; note: string };

export type TalkRun = {
  id: string;
  t: number;
  day: string;
  scene: string;
  title: string;
  src: 'legacy' | 'db' | 'ai';
  turns: number;
  ms: number;
  end: 'user' | 'goal';
  goal: 'reached' | 'partly' | 'missed' | null;
  clean: number;
  errs: Record<string, number>;
  taken: string[];
  lines: TalkLine[];
  report: StoredReport | null;
  lang: Lang;
  tier: string;
  v: 1;
};
