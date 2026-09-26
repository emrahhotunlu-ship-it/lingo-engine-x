import { describe, expect, it } from 'vitest';
import { applyUpdate, cardPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
import { nextStage, stageOf } from '../../src/domain/srs/ladder';
import { previewIntervals, readFsrs, reviewFsrs } from '../../src/domain/srs/scheduler';
import { CATALOG } from '../../src/domain/srs/modes';
import type { AnswerEvent, ExerciseId, Grade } from '../../src/domain/srs/types';
import { seedCard, SEED_VOCAB } from '../../src/domain/content';
import { berlin, loadSeed } from './helpers';

const seed = loadSeed();
const T = berlin('2026-09-20', 21);
const DAY = 86_400_000;

const answer = (id: string, ex: ExerciseId, grade: Grade, t = T): AnswerEvent => ({
  t,
  day: '2026-09-20',
  kind: 'v',
  id,
  ex,
  grade,
  given: 'x',
  ans: 'y',
  ms: 3000,
  lang: 'de',
  ctx: 'rev',
});

describe('FSRS-Planung und Spiegelung der alten Felder', () => {
  it('neue Karte: Nochmal 1 Min., Gut 10 Min., Leicht mehrere Tage', () => {
    const f = readFsrs(seedCard(SEED_VOCAB[0]!, 0), T);
    const iv = previewIntervals(f, T);
    expect(iv[1]).toBe(60_000);
    expect(iv[3]).toBe(600_000);
    expect(iv[4]).toBeGreaterThan(2 * DAY);
  });

  it('gleiche Eingabe ergibt denselben Termin (Unschärfe deterministisch) und höchstens 365 Tage', () => {
    const f = readFsrs({ state: 'review', S: 300, D: 3, due: T, last: T - 300 * DAY, reps: 9, lapses: 0 }, T);
    const a = reviewFsrs(f, 4, T);
    const b = reviewFsrs(f, 4, T);
    expect(a.due).toBe(b.due);
    expect((a.due - T) / DAY).toBeLessThanOrEqual(365);
  });

  it('jede Seed-Karte × jede Note × jede Übung: nur erlaubte Felder, alte Felder gespiegelt, alles andere unverändert', () => {
    for (const [path, doc] of Object.entries(seed)) {
      if (!path.startsWith('vocab/') || doc.hidden === true) continue;
      const id = path.slice(6);
      for (const g of [1, 2, 3, 4] as const) {
        for (const d of CATALOG) {
          const w = reviewWrite(path, doc, answer(id, d.ex, g), null);
          expect(w.kind, `${path} ${d.ex} ${g}: ${w.kind === 'skip' ? w.reason : ''}`).toBe('update');
          if (w.kind !== 'update') continue;
          expect(cardPatchSchema.safeParse(w.patch).success).toBe(true);
          const f = w.patch.fsrs as { stability: number; due: number; last: number; src: string };
          expect(w.patch.S).toBe(Math.min(f.stability, 365));
          expect(w.patch.due).toBe(f.due);
          expect(w.patch.last).toBe(T);
          expect(f.last).toBe(T);
          expect(f.src).toBe('lx');
          expect(w.patch.reps).toBe(Number(doc.reps ?? 0) + 1);
          const merged = applyUpdate(doc, w.patch);
          for (const k of ['word', 'de', 'def', 'ex', 'col', 'src', 'added', 'order', 'level', 'pos']) expect(merged[k], k).toEqual(doc[k]);
          expect((merged.hist as unknown[]).length).toBe(Math.min(12, ((doc.hist as unknown[] | undefined) ?? []).length + 1));
        }
      }
    }
  });

  it('lapses nur bei „Nochmal" auf einer nicht neuen Karte; intro nur beim Übergang von neu', () => {
    const review = { word: 'x', state: 'review', S: 5, D: 5, due: T, last: T - 5 * DAY, reps: 3, lapses: 1, stage: 3 };
    const w1 = reviewWrite('vocab/x', review, answer('x', 'type', 1), null);
    expect(w1.kind === 'update' && w1.patch.lapses).toBe(2);
    expect(w1.kind === 'update' && 'intro' in w1.patch).toBe(false);
    const fresh = { word: 'y', state: 'new', S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, stage: 0 };
    const w2 = reviewWrite('vocab/y', fresh, answer('y', 'mc_en', 1), null);
    expect(w2.kind === 'update' && w2.patch.lapses).toBe(0);
    expect(w2.kind === 'update' && w2.patch.intro).toBe('2026-09-20');
    expect(w2.kind === 'update' && w2.patch.stage).toBe(1);
    // Echte Altdaten: neue Karten mit bereits gesetztem Einführungsdatum behalten es.
    const introduced = { ...fresh, word: 'z', intro: '2026-09-18' };
    const w3 = reviewWrite('vocab/z', introduced, answer('z', 'mc_en', 3), null);
    expect(w3.kind === 'update' && 'intro' in w3.patch).toBe(false);
  });

  it('Startvokabel ohne Dokument wird vollständig angelegt, fehlende andere Karte nie', () => {
    const s = seedCard(SEED_VOCAB[1]!, 1);
    const w = reviewWrite(`vocab/${s.id}`, undefined, answer(s.id, 'mc_en', 3), s);
    expect(w.kind).toBe('create');
    expect(w.kind === 'create' && w.doc).toMatchObject({ word: s.word, src: 'seed', state: 'learning', intro: '2026-09-20' });
    expect(reviewWrite('vocab/fehlt', undefined, answer('fehlt', 'mc_en', 3), null)).toEqual({ kind: 'skip', reason: 'missing' });
  });

  it('überspringt: ungültig, ausgeblendet, schon angewendet, veraltet, neuere FSRS-Version', () => {
    const base = { word: 'x', state: 'review', S: 5, D: 5, due: T, last: T - DAY, reps: 3, lapses: 0 };
    expect(reviewWrite('vocab/x', { ...base, word: '' }, answer('x', 'type', 3), null)).toEqual({ kind: 'skip', reason: 'invalid' });
    expect(reviewWrite('vocab/x', { ...base, hidden: true }, answer('x', 'type', 3), null)).toEqual({ kind: 'skip', reason: 'hidden' });
    expect(reviewWrite('vocab/x', { ...base, last: T }, answer('x', 'type', 3), null)).toEqual({ kind: 'skip', reason: 'already_applied' });
    expect(reviewWrite('vocab/x', { ...base, last: T + 5 }, answer('x', 'type', 3), null)).toEqual({ kind: 'skip', reason: 'stale_answer' });
    const future = { ...base, fsrs: { v: 2, due: T, stability: 1, difficulty: 5, state: 2, reps: 1, lapses: 0, last: T - DAY, scheduledDays: 1, learningSteps: 0 } };
    expect(reviewWrite('vocab/x', future, answer('x', 'type', 3), null)).toEqual({ kind: 'skip', reason: 'future_fsrs' });
  });

  it('zieht FSRS aus den alten Feldern nach, wenn die alte App die Karte seitdem bewertet hat', () => {
    const doc = { word: 'x', state: 'review', S: 20, D: 4, due: T + DAY, last: T - 2 * DAY, reps: 5, lapses: 0, fsrs: { v: 1, due: 1, stability: 1, difficulty: 9, state: 2, reps: 1, lapses: 0, last: T - 30 * DAY, scheduledDays: 1, learningSteps: 0, src: 'lx' } };
    expect(readFsrs(doc, T).stability).toBe(20);
  });
});

describe('Leiter (Formeln der alten App)', () => {
  it('stageOf mit Ersatzregel ohne `stage`', () => {
    expect(stageOf({ state: 'new', reps: 0, stage: 3 })).toBe(0);
    expect(stageOf({ state: 'review', reps: 4, stage: 3 })).toBe(3);
    expect(stageOf({ state: 'review', reps: 4, ac: 0.75, S: 8 })).toBe(5);
    expect(stageOf({ state: 'review', reps: 4, ac: 0.65 })).toBe(4);
    expect(stageOf({ state: 'review', reps: 4, pa: 0.7 })).toBe(2);
    expect(stageOf({ state: 'review', reps: 4 })).toBe(1);
  });

  it('nextStage: Aufstieg nur mit Übung ≥ eigener Stufe, Leicht +1, Nochmal zurück', () => {
    expect(nextStage(0, 1, 3)).toBe(2);
    expect(nextStage(1, 1, 4)).toBe(3);
    expect(nextStage(4, 2, 3)).toBe(4);
    expect(nextStage(4, 4, 1)).toBe(3);
    expect(nextStage(3, 4, 2)).toBe(3);
    expect(nextStage(5, 4, 4)).toBe(5);
  });
});
