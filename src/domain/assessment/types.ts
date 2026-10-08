// KI-Einschätzung (Phase 6, docs/phase6-plan.md §4): gemeinsame Typen.

export const LEVELS = ['A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'] as const;
export type Level = (typeof LEVELS)[number];
export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);
/** Rang einer Stufe (A2 = 0 … C1+ = 6), `-1` für unbekannt. */
export const levelRank = (v: unknown): number => (isLevel(v) ? LEVELS.indexOf(v) : -1);

export const CONFIDENCES = ['thin', 'fair', 'good'] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export const isConfidence = (v: unknown): v is Confidence => typeof v === 'string' && (CONFIDENCES as readonly string[]).includes(v);
export const confidenceRank = (c: Confidence): number => CONFIDENCES.indexOf(c);

/** Belegstärke im Code: wie `Confidence`, dazu `none` (gar keine Belege, Plan §4.3). */
export type Strength = Confidence | 'none';

export const TRENDS = ['up', 'flat', 'down'] as const;
export type Trend = (typeof TRENDS)[number];

export const DIMS = ['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'] as const;
export type Dim = (typeof DIMS)[number];
/** Seit dem Fokus-Umbau (04.10.2026) beurteilt und zeigt die App nur Grammatik und Wortschatz; `DIMS` bleibt für alte Einschätzungen lesbar. */
export const FOCUS_DIMS = ['grammar', 'vocabulary'] as const;
export type FocusDim = (typeof FOCUS_DIMS)[number];

export type AssessDim = { id: Dim; level: Level | null; confidence: Confidence; why: string | null };
export type AssessItem = { title: string; why: string; ev: string[] };
export type AssessBlocker = AssessItem & { fix: string; action: string | null };
export type AssessFocus = { title: string; why: string; action: string | null; days: number; channels: string[] };

/** Urteil „Weg zu C1“ (assess@4, Lernplattform 3.0 P45): nur Worte, keine Punktzahl. `missing` = höchstens 3 offene Kriterien (k1–k7). */
export const C1_VERDICTS = ['not_yet', 'on_track', 'ready'] as const;
export type C1Verdict = (typeof C1_VERDICTS)[number];
export type AssessC1 = { status: C1Verdict; why: string; missing: Array<{ crit: string; title: string }>; ev: string[] };

/** Inhalt `data` in der Hüllenform (Plan E1). Fehlendes ist `null` bzw. leer. */
export type AssessData = {
  level: string | null;
  cefr: Level | null;
  levelWhy: string | null;
  trend: Trend | null;
  trendWhy: string | null;
  today: string | null;
  c1gap: string[];
  strengths: AssessItem[];
  blockers: AssessBlocker[];
  dims: AssessDim[];
  focus: AssessFocus | null;
  /** Nur assess@4; ältere Einschätzungen haben keins (`undefined`/`null`). */
  c1?: AssessC1 | null;
};

export type AssessHist = { d: string; cefr: Level | null; trend: Trend | null; dims: Partial<Record<Dim, Level | null>> };

/** Gelesene Einschätzung (beide Formen, `envelope.readAssess`). */
export type AssessRead = {
  d: string | null;
  t: number;
  lang: 'de' | 'en';
  answers: number;
  writings: number;
  tier: string | null;
  data: AssessData;
  hist: AssessHist[];
  /** Tag des letzten automatischen Laufs (`run.d`), Sperre für den Tag (Plan W1). */
  runDay: string | null;
};

/** Ein Abschnitt des Belegpakets: Zeilen der Form `[id] text`. */
export type EvidenceLine = { id: string; text: string };
export type EvidenceSection = { key: EvidenceKey; title: string; lines: EvidenceLine[] };
export type EvidenceKey = 'p' | 'g' | 'r' | 'v' | 'l' | 'cd' | 'a';

export type EvidencePack = {
  sections: EvidenceSection[];
  ids: string[];
  /** Zählung für `basis` und die Belegstärke. */
  counts: EvidenceCounts;
};

export type EvidenceCounts = {
  answers14: number;
  grammarN: number;
  grammarTopics: number;
  vocabReviews30: number;
  vtestDays: number | null;
  vtestD: string | null;
};
