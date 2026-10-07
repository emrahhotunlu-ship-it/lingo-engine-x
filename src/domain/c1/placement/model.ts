// Einstufung, Rechenmodell (Lernplattform 3.0 §4.2, P33; C1-Programm §4.1): Rasch-Modell mit Ratekorrektur auf einem Raster von −3 bis +3 (61 Punkte),
// Start Normal(0; 1), also bei B2. Rein: keine Uhr, kein Zufall, keine Datenbank. Mit einem Nutzer sind die Schwierigkeiten NICHT eichbar; die Werte
// sind begründete Startwerte, die Einstufung ist ein Wegweiser und kein Testergebnis.

export type PlaceLevel = 'B1' | 'B2' | 'B2+' | 'C1';
export type PlaceFmt = 'mc' | 'gap' | 'find' | 'kwt';

export type PlaceItem = {
  id: string;
  topic: string;
  /** Kapitel 1 bis 7 (für den Inhaltsausgleich). */
  chapter: number;
  level: PlaceLevel;
  fmt: PlaceFmt;
  /** Lehrerkorrektur der Schwierigkeit, −0,3 bis +0,3. */
  adj?: number;
  /** Herkunft im Inhalt (`'place'` für den Einstufungsvorrat); fehlt = zählt als Einstufungsaufgabe. */
  pool?: string;
};

/** Stufenwert (B1 −1,0 · B2 0 · B2+ 0,5 · C1 1,0). */
export const STAGE_B: Readonly<Record<PlaceLevel, number>> = { B1: -1, B2: 0, 'B2+': 0.5, C1: 1 };
/** Formatwert (mc −0,4 · gap 0 · find +0,3 · kwt +0,6). */
export const FORMAT_B: Readonly<Record<PlaceFmt, number>> = { mc: -0.4, gap: 0, find: 0.3, kwt: 0.6 };
/** Ratewahrscheinlichkeit: 0,25 bei Auswahl, sonst 0. */
export const GUESS: Readonly<Record<PlaceFmt, number>> = { mc: 0.25, gap: 0, find: 0, kwt: 0 };

export const GRID_N = 61;
/** Das Raster −3,0 … +3,0 in Schritten von 0,1. */
export const GRID: readonly number[] = Array.from({ length: GRID_N }, (_, i) => (i - 30) / 10);

const clampAdj = (v: number | undefined): number => Math.min(0.3, Math.max(-0.3, v ?? 0));

/** Schwierigkeit `b` = Stufenwert + Formatwert + Lehrerkorrektur. */
export const difficulty = (it: PlaceItem): number => STAGE_B[it.level] + FORMAT_B[it.fmt] + clampAdj(it.adj);

/** P(richtig) = c + (1 − c) / (1 + e^−(θ − b)). */
export function pCorrect(theta: number, it: PlaceItem): number {
  const c = GUESS[it.fmt];
  return c + (1 - c) / (1 + Math.exp(-(theta - difficulty(it))));
}

/** Startverteilung Normal(0; 1) auf dem Raster, auf Summe 1 gebracht. */
export function prior(): number[] {
  const w = GRID.map((t) => Math.exp(-(t * t) / 2));
  const sum = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / sum);
}

/** Verteilung nach einer Antwort (Bayes auf dem Raster). */
export function update(post: readonly number[], it: PlaceItem, correct: boolean): number[] {
  const w = post.map((p, i) => {
    const pc = pCorrect(GRID[i] ?? 0, it);
    return p * (correct ? pc : 1 - pc);
  });
  const sum = w.reduce((s, x) => s + x, 0);
  // Entartet nur bei unmöglichen Zahlen: dann bleibt die alte Verteilung stehen statt NaN.
  return sum > 0 && Number.isFinite(sum) ? w.map((x) => x / sum) : [...post];
}

/** Erwartungswert und Standardabweichung der Verteilung (θ und Standardfehler). */
export function estimate(post: readonly number[]): { theta: number; se: number } {
  let m = 0;
  for (let i = 0; i < GRID_N; i++) m += (GRID[i] ?? 0) * (post[i] ?? 0);
  let v = 0;
  for (let i = 0; i < GRID_N; i++) v += ((GRID[i] ?? 0) - m) ** 2 * (post[i] ?? 0);
  return { theta: m, se: Math.sqrt(Math.max(0, v)) };
}

/**
 * Information einer Aufgabe bei θ (mit Ratekorrektur): I = Q/P · ((P − c) / (1 − c))². Je größer, desto mehr lernt man aus der Antwort;
 * Aufgaben nahe an θ tragen am meisten bei, Auswahlaufgaben etwas weniger.
 */
export function information(theta: number, it: PlaceItem): number {
  const c = GUESS[it.fmt];
  const p = pCorrect(theta, it);
  return ((1 - p) / p) * ((p - c) / (1 - c)) ** 2;
}

/** Belastbarkeit aus dem Standardfehler (dünn / brauchbar / gut). */
export type Reliability = 'thin' | 'ok' | 'good';
export const reliabilityOf = (se: number): Reliability => (se <= 0.4 ? 'good' : se <= 0.55 ? 'ok' : 'thin');

/** Grobe Einordnung: θ < −0,5 B1+ · −0,5 bis 0,5 B2 · 0,5 bis 1,2 B2+ · ab 1,2 C1. Nur für die Anzeige „Messwerte dahinter“. */
export type PlaceBand = 'B1+' | 'B2' | 'B2+' | 'C1';
export const bandOf = (theta: number): PlaceBand => (theta < -0.5 ? 'B1+' : theta < 0.5 ? 'B2' : theta < 1.2 ? 'B2+' : 'C1');
