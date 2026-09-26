import { meaningOf } from './cards';
import type { Counts, ExerciseId, InputKind, Lang, LegacyMode, Stage, TrainCard } from './types';

// Katalog der Abfragearten im MVP (Lern-Entwurf §1.2, Zuordnung laut Daten-Entwurf §1.2).
// Jede Art gehört fest zu einer Stufe; `level` ist die Stufe der alten App für `nextStage`.

export type ExerciseDef = { ex: ExerciseId; stage: Stage; level: number; mode: LegacyMode; input: InputKind };

export const CATALOG: readonly ExerciseDef[] = [
  { ex: 'mc_en', stage: 1, level: 1, mode: 'recog', input: 'choice' },
  { ex: 'mc_de', stage: 2, level: 2, mode: 'recog', input: 'choice' },
  { ex: 'cloze_hint', stage: 3, level: 3, mode: 'cloze', input: 'typed' },
  { ex: 'type', stage: 4, level: 4, mode: 'type', input: 'typed' },
  { ex: 'cloze', stage: 4, level: 4, mode: 'type', input: 'typed' },
  { ex: 'colloc', stage: 4, level: 4, mode: 'colloc', input: 'choice' },
];

export const exerciseDef = (ex: ExerciseId): ExerciseDef => CATALOG.find((d) => d.ex === ex) ?? (CATALOG[0] as ExerciseDef);

/** Was eine Übungsart an Kartendaten braucht (ohne Sprachausgabe und KI). */
export function supports(card: TrainCard, ex: ExerciseId, lang: Lang, poolSize: number): boolean {
  const meaning = meaningOf(card, lang);
  switch (ex) {
    case 'mc_en':
    case 'mc_de':
      return !!meaning && poolSize >= 3;
    case 'type':
      return !!meaning;
    case 'cloze_hint':
    case 'cloze':
      return !!card.context;
    case 'colloc':
      return card.col.some((c) => c.ctx && c.opts.length >= 2);
  }
}

/**
 * Verfügbare Arten für die Stufe der Karte. Sind es weniger als 2, kommen Arten der Nachbarstufen
 * dazu (erst höher, dann tiefer, in Katalogreihenfolge) – so gibt es je Stufe mindestens zwei, wo möglich.
 */
export function availableExercises(card: TrainCard, lang: Lang, poolSize: number): ExerciseId[] {
  const k = Math.max(1, card.stage);
  const ok = (d: ExerciseDef) => supports(card, d.ex, lang, poolSize);
  const out = CATALOG.filter((d) => d.stage === k && ok(d)).map((d) => d.ex);
  for (let dist = 1; out.length < 2 && dist <= 4; dist++) {
    for (const s of [k + dist, k - dist]) {
      for (const d of CATALOG) {
        if (out.length >= 2) break;
        if (d.stage === s && ok(d) && !out.includes(d.ex)) out.push(d.ex);
      }
    }
  }
  return out;
}

const score = (c: Counts) => (c.c + 1) / (c.c + c.w + 2);

function countsFor(card: TrainCard, ex: ExerciseId): Counts {
  return card.xs[ex] ?? card.modes[exerciseDef(ex).mode] ?? { c: 0, w: 0 };
}

/**
 * Die Art, die diese Karte am schlechtesten kann (Laplace-geglättet). Gleichstand (< 0,05):
 * zuerst eine andere Art als zuletzt an dieser Karte, dann keine der beiden vorigen Arten der
 * Runde, dann die Katalogreihenfolge.
 */
export function chooseExercise(card: TrainCard, lang: Lang, poolSize: number, recent: readonly ExerciseId[] = []): ExerciseId | null {
  const avail = availableExercises(card, lang, poolSize);
  if (!avail.length) return null;
  const ranked = avail
    .map((ex, i) => ({ ex, i, s: score(countsFor(card, ex)) }))
    .sort((a, b) => a.s - b.s || a.i - b.i);
  const best = ranked[0];
  if (!best) return null;
  const tied = ranked.filter((r) => r.s - best.s < 0.05);
  const lastRecent = recent.slice(-2);
  tied.sort((a, b) => {
    const la = exerciseDef(a.ex).mode === card.lastMode ? 1 : 0;
    const lb = exerciseDef(b.ex).mode === card.lastMode ? 1 : 0;
    if (la !== lb) return la - lb;
    const ra = lastRecent.includes(a.ex) ? 1 : 0;
    const rb = lastRecent.includes(b.ex) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return a.s - b.s || a.i - b.i;
  });
  return tied[0]?.ex ?? best.ex;
}
