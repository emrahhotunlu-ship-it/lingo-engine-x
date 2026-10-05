import { describe, expect, it } from 'vitest';
import { addLocalDays } from '../../src/domain/date';
import { whyOfError } from '../../src/domain/grammar/errorWhy';
import { reviewError, type ErrorEntry } from '../../src/domain/grammar/errors';
import { grammarWrite } from '../../src/domain/grammar/write';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { reviewRepair, type RepairItem } from '../../src/domain/repair/repair';
import { berlin } from './helpers';
import { answer } from './learnHelpers';

// Prüfbefunde B1 (Warum zum Fehlersatz), S1 (Überlauf nie still verlieren), S3 („Fast richtig“ im Fehlersatz).

const t0 = berlin('2026-09-27', 10);
const Q = 'By next June, I ___ (finish) my course.';

describe('B1 Warum beim Fehlersatz', () => {
  it('beim Anlegen wird die Erklärung (de/en) mitgeschrieben', () => {
    const w = grammarWrite({ p: 0.5, last: 1 }, answer({ t: t0, verdict: 'wrong', given: 'finish' }));
    const e = (w.kind === 'update' ? w.patch.errors : []) as ErrorEntry[];
    expect(e[0]?.expl).toEqual({ de: 'By + Zeitpunkt → Future Perfect.', en: 'By + point in time → future perfect.' });
  });

  it('dueFehlersaetze füllt `why` in der Oberflächensprache: eigenes Feld, sonst Startaufgabe, sonst Regelblatt', () => {
    const base = { q: Q, given: 'finish', ans: 'will have finished', t: t0 - 3 * 86_400_000, due: t0 - 1000 };
    const docs = (e: Record<string, unknown>) => new Map<string, Readonly<Record<string, unknown>>>([['future-perf-cont', { errors: [e] }]]);
    const run = (e: Record<string, unknown>, lang: 'de' | 'en') => dueFehlersaetze({ grammarDocs: docs(e), repairDoc: null, nowMs: t0, today: '2026-09-27', lang })[0]?.why;
    expect(run({ ...base, expl: { de: 'Eigene Erklärung.', en: 'Own explanation.' } }, 'de')).toBe('Eigene Erklärung.');
    expect(run({ ...base, expl: { de: 'Eigene Erklärung.', en: 'Own explanation.' } }, 'en')).toBe('Own explanation.');
    // Älterer Eintrag ohne Feld: Fallback über legacyTaskKey (Startaufgabe) bzw. Regelblatt – nie leer.
    expect(run(base, 'de')).toBeTruthy();
    expect(run({ ...base, q: 'Ganz anderer Satz ___ (go).' }, 'en')).toBeTruthy();
    expect(whyOfError('future-perf-cont', { q: 'unbekannt ___' }, 'de').length).toBeGreaterThan(0);
  });
});

describe('S1 Überlauf', () => {
  it('Thema mit 10 offenen Fehlersätzen: der neue Fehler wird als Reparatur-Satz angeboten', () => {
    const errors = Array.from({ length: 10 }, (_, i) => ({ q: `Q${i} ___ (go).`, given: 'x', ans: 'y', t: t0 - 1000 * (i + 1) }));
    const w = grammarWrite({ p: 0.5, last: 1, errors }, answer({ t: t0, verdict: 'wrong', given: 'finish' }));
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    expect(w.patch.errors).toBeUndefined();
    expect(w.overflow).toMatchObject({ wrong: 'By next June, I finish (finish) my course.', src: 'lesson' });
    expect(w.overflow?.right).toContain('will have finished');
    // Dieselbe Frage schon offen: kein Überlauf.
    const dup = grammarWrite({ p: 0.5, last: 1, errors: [{ q: Q, given: 'x', ans: 'y', t: t0 - 5 }, ...errors.slice(1)] }, answer({ t: t0, verdict: 'wrong', given: 'finish' }));
    expect(dup.kind === 'update' && dup.overflow).toBeFalsy();
  });
});

describe('S3 Fast richtig im Fehlersatz', () => {
  it('Grammatik-Fehlersatz: Box unverändert, morgen wieder, nicht erledigt', () => {
    const list: ErrorEntry[] = [{ q: Q, given: 'x', ans: 'y', t: 5, box: 1, due: t0 - 10 }];
    const next = reviewError(list, 5, { ok: true, near: true, given: '', grade: 2, t: t0 })!;
    expect(next[0]).toMatchObject({ box: 1, done: false, due: addLocalDays(t0, 1), last: t0 });
    const good = reviewError(list, 5, { ok: true, given: '', grade: 3, t: t0 })!;
    expect(good[0]!.box).toBe(2);
  });
  it('Reparatur-Satz: Box unverändert, morgen wieder', () => {
    const r: RepairItem = { id: 'r1', wrong: 'a b', right: 'c d', src: 'say', t: 1, box: 1, due: t0 - 10 };
    const next = reviewRepair([r], 'r1', true, t0, true)!;
    expect(next[0]).toMatchObject({ box: 1, done: false, due: addLocalDays(t0, 1), last: t0 });
    expect(reviewRepair([r], 'r1', true, t0)![0]!.box).toBe(2);
  });
});
