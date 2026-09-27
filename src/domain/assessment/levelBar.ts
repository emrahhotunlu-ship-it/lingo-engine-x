import { CONFIDENCES, levelRank, type AssessData, type Confidence, type Level } from './types';

// Niveau-Leiste (Funktionsabgleich M7): Skala B1 · B1+ · B2 · B2+ · C1 · C1+ mit einem Punkt für
// Claudes Gesamtstufe und einem hellen Band für die Belastbarkeit. Keine Punktzahl (Kap. 2.3).
// Die Breite des Bands folgt der überwiegenden Belastbarkeit der Fertigkeiten (dünn ±1 Stufe,
// mittel ±½, gut 0) – es zeigt Unsicherheit, nicht die Streuung zwischen den Fertigkeiten.

export const SCALE: readonly Level[] = ['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'];

export type LevelBar = {
  /** Position der Gesamtstufe auf der Skala (0 = B1 … 5 = C1+). A2 steht links am Rand. */
  pos: number;
  lo: number;
  hi: number;
  /** Überwiegende Belastbarkeit der Fertigkeiten. */
  confidence: Confidence;
  below: boolean;
};

const MAX = SCALE.length - 1;
const onScale = (level: Level): number => Math.max(0, levelRank(level) - 1);
const SPREAD: Record<Confidence, number> = { thin: 1, fair: 0.5, good: 0 };

/** Überwiegende Belastbarkeit; bei Gleichstand die vorsichtigere. Ohne Fertigkeiten: dünn. */
export function mainConfidence(data: Pick<AssessData, 'dims'>): Confidence {
  const counts = new Map<Confidence, number>(CONFIDENCES.map((c) => [c, 0]));
  for (const d of data.dims) counts.set(d.confidence, (counts.get(d.confidence) ?? 0) + 1);
  let best: Confidence = 'thin';
  let n = -1;
  for (const c of CONFIDENCES) {
    const k = counts.get(c) ?? 0;
    if (k > n) {
      best = c;
      n = k;
    }
  }
  return data.dims.length ? best : 'thin';
}

export function levelBar(data: Pick<AssessData, 'cefr' | 'dims'>): LevelBar | null {
  if (!data.cefr) return null;
  const pos = onScale(data.cefr);
  const confidence = mainConfidence(data);
  const spread = SPREAD[confidence];
  return { pos, lo: Math.max(0, pos - spread), hi: Math.min(MAX, pos + spread), confidence, below: levelRank(data.cefr) < 1 };
}
