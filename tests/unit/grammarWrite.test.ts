import { describe, expect, it } from 'vitest';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { grammarWrite } from '../../src/domain/grammar/write';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { answer } from './learnHelpers';
import { berlin } from './helpers';

const t0 = berlin('2026-09-27', 10);

describe('grammarWrite (Schreibweg grammar/<topic>)', () => {
  it('fehlt → vollständig anlegen (Startwerte der alten App + Antwort)', () => {
    const w = grammarWrite(undefined, answer({ t: t0 }));
    expect(w.kind).toBe('create');
    if (w.kind !== 'create') return;
    expect(w.doc).toMatchObject({ id: 'future-perf-cont', n: 1, c: 1, last: t0, anchorD: '2026-09-27', anchor: 0.35 });
    expect(w.doc.seen).toEqual([legacyTaskKey('By next June, I ___ (finish) my course.')]);
    expect(w.doc.errors).toEqual([]);
  });

  it('unbekanntes Thema, ungültiges Dokument, schon angewendet, veraltet → nichts', () => {
    expect(grammarWrite(undefined, answer({ t: t0 }, { topic: 'klingon' }))).toEqual({ kind: 'skip', reason: 'unknown_topic' });
    expect(grammarWrite({ p: 'hoch' }, answer({ t: t0 }))).toEqual({ kind: 'skip', reason: 'invalid' });
    expect(grammarWrite({ p: 0.5, last: t0 }, answer({ t: t0 }))).toEqual({ kind: 'skip', reason: 'already_applied' });
    expect(grammarWrite({ p: 0.5, last: t0 + 5 }, answer({ t: t0 }))).toEqual({ kind: 'skip', reason: 'stale_answer' });
  });

  it('falsch → Fehler in der alten Form; „Weiß ich nicht" legt keinen Fehler an', () => {
    const w = grammarWrite({ p: 0.5, last: 1 }, answer({ t: t0, verdict: 'wrong', given: 'finish' }));
    expect(w.kind === 'update' && w.patch.errors).toEqual([{ q: 'By next June, I ___ (finish) my course.', given: 'finish', ans: 'will have finished', t: t0, src: 'seed' }]);
    const d = grammarWrite({ p: 0.5, last: 1 }, answer({ t: t0, verdict: 'wrong', dontKnow: true, given: '' }));
    expect(d.kind === 'update' && 'errors' in d.patch).toBe(false);
  });

  it('richtig erst nach Hinweis → zählt als falsch, der erste Versuch wird als Fehler gemerkt (Lernwissenschaft 27.09.)', () => {
    const w = grammarWrite({ p: 0.5, last: 1 }, { ...answer({ t: t0, verdict: 'correct', given: 'will have finished' }), firstWrong: 'finish' });
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    expect(w.patch.c).toBe(0);
    expect(w.patch.errors).toEqual([{ q: 'By next June, I ___ (finish) my course.', given: 'finish', ans: 'will have finished', t: t0, src: 'seed' }]);
    const plain = grammarWrite({ p: 0.5, last: 1 }, answer({ t: t0, verdict: 'correct', given: 'will have finished' }));
    expect(plain.kind === 'update' && (plain.patch.p as number) > (w.patch.p as number)).toBe(true);
  });

  it('Deckel 40/10/80/20/10, unbekannte Felder bleiben erhalten', () => {
    const cur = {
      id: 'future-perf-cont',
      p: 0.5,
      last: 1,
      hist: Array.from({ length: 40 }, (_, i) => ({ d: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, p: 0.5 })),
      errors: Array.from({ length: 10 }, (_, i) => ({ q: `q${i}`, t: i + 1 })),
      seen: Array.from({ length: 80 }, (_, i) => `k${i}`),
      seenText: Array.from({ length: 20 }, (_, i) => `p${i}`),
      recent: Array.from({ length: 10 }, () => 1),
      custom: { keep: true },
    };
    const w = grammarWrite(cur, answer({ t: t0, verdict: 'wrong', given: 'x' }));
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const next = applyUpdate(cur, w.patch);
    expect((next.hist as unknown[]).length).toBe(40);
    expect((next.errors as unknown[]).length).toBe(10);
    expect((next.seen as unknown[]).length).toBe(80);
    expect((next.seenText as unknown[]).length).toBe(20);
    expect((next.recent as unknown[]).length).toBe(10);
    expect(next.custom).toEqual({ keep: true });
    expect(next.id).toBe('future-perf-cont');
  });

  it('ein hist-Eintrag je Lerntag (der letzte wird ersetzt)', () => {
    const cur = { p: 0.5, last: 1, hist: [{ d: '2026-09-27', p: 0.4 }] };
    const w = grammarWrite(cur, answer({ t: t0 }));
    expect(w.kind === 'update' && (w.patch.hist as unknown[]).length).toBe(1);
  });

  it('Fehler-Wiederholung schreibt Box und FSRS-Schatten, kein neuer Fehler', () => {
    const cur = { p: 0.5, last: 1, errors: [{ q: 'By next June, I ___ (finish) my course.', given: 'finish', ans: 'will have finished', t: 7 }] };
    const w = grammarWrite(cur, answer({ t: t0 }, { errorT: 7, src: 'review' }));
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const errs = w.patch.errors as Array<Record<string, unknown>>;
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ box: 1, last: t0 });
    expect(errs[0]!.fsrs).toBeTruthy();
  });

  it('Mehr-Tab: zweimal dieselbe Antwort zählt nie doppelt', () => {
    const cur = { p: 0.5, last: 1, n: 3, c: 2 };
    const w1 = grammarWrite(cur, answer({ t: t0 }));
    if (w1.kind !== 'update') throw new Error('update erwartet');
    const after = applyUpdate(cur, w1.patch);
    expect(grammarWrite(after, answer({ t: t0 })).kind).toBe('skip');
    expect(after.n).toBe(4);
  });
});
