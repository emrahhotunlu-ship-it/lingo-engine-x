import { describe, expect, it } from 'vitest';
import { allSeedTasks, normalizeTask, selectRound, selectVortest, variantOf, wholeSentence, type RoundInput } from '../../src/domain/grammar/tasks';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { berlin } from './helpers';

const now = berlin('2026-10-06', 10);
const PILOT = ['past-simple-perfect', 'mixed-cond', 'time-clauses', 'cond-alt'];
const begun = (extra: Record<string, unknown> = {}) => ({ p: 0.5, n: 12, c: 8, last: now - 86_400_000, hist: [{ d: '2026-09-20', p: 0.4 }], recent: [1, 1, 0], seen: [] as string[], errors: [], ...extra });
const docs = (over: Record<string, Record<string, unknown>> = {}) => new Map<string, Record<string, unknown>>([...PILOT.map((t) => [t, begun()] as const), ...Object.entries(over)]);

const input = (over: Partial<RoundInput> = {}): RoundInput => ({ mode: 'duty', grammarDocs: docs(), dailyOpen: [], pool: [], nowMs: now, size: 6, seed: 's1', errorsMax: 0, gt: { intro: null, pats: [], topics: PILOT.slice(0, 3) }, ...over });

describe('Pflichtrunde (Lernplattform 2.0 §3.3, §4.7)', () => {
  it('stellt in Themen mit Musterdatei nur Aufgaben mit Muster, auch mit Pool-Aufgaben ohne Treffer', () => {
    const alien = normalizeTask({ topic: 'mixed-cond', type: 'gap', prompt: 'Zebras ___ (graze) quietly in the savannah.', answer: 'graze' }, 'pool')!;
    expect(alien.pat ?? null).toBeNull();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const r = selectRound(input({ seed, pool: [alien] }));
      expect(r.length).toBeGreaterThanOrEqual(5);
      for (const t of r) expect(t.pat, `${t.topic}: ${t.prompt}`).toBeTruthy();
      expect(r.some((t) => t.key === alien.key)).toBe(false);
    }
  });

  it('Profil touch: nie ein ganzer Satz, kein correct; auch in einem Thema ganz ohne kwt/find', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const r = selectRound(input({ seed, profile: 'touch', gt: { intro: null, pats: [], topics: ['conditionals', 'passive', 'relative'] }, grammarDocs: new Map(['conditionals', 'passive', 'relative'].map((t) => [t, begun({ p: 0.9 })] as const)) }));
      expect(r.length).toBeGreaterThan(0);
      for (const t of r) {
        expect(wholeSentence(t), t.prompt).toBe(false);
        expect(t.type).not.toBe('correct');
      }
    }
  });

  it('kein Muster vor seiner Einführung: nur eingeführte Muster in der gemischten Runde', () => {
    const d = docs({ 'mixed-cond': begun({ pats: { 'mc.past-cond': { n: 5, c: 4, last: 1, r: 31, k: 5, dd: [], i: '2026-09-20' } } }) });
    for (const seed of ['a', 'b', 'c']) {
      const r = selectRound(input({ seed, grammarDocs: d, gt: { intro: null, pats: [], topics: ['mixed-cond'] } }));
      expect(r.length).toBeGreaterThan(0);
      for (const t of r) expect(t.pat).toBe('mc.past-cond');
    }
  });

  it('Einführungsblock: die ersten 4 Plätze gehören den Mustern des Tages, danach nur Eingeführtes', () => {
    const d = docs();
    d.delete('mixed-cond');
    const step = patternsOf('mixed-cond')!.introPlan[0]!;
    const gt = { intro: 'mixed-cond', pats: step, topics: ['past-simple-perfect', 'mixed-cond', 'time-clauses'] };
    const r = selectRound(input({ grammarDocs: d, gt, introBlock: { topic: 'mixed-cond', pats: step } }));
    expect(r.length).toBe(6);
    for (const t of r.slice(0, 4)) {
      expect(t.topic).toBe('mixed-cond');
      expect(step).toContain(t.pat);
    }
    for (const t of r.slice(4)) if (t.topic === 'mixed-cond') expect(step).toContain(t.pat);
    // Erkennen vor Ergänzen: Platz 1 ist eine Auswahlform.
    expect(['meaning', 'mc']).toContain(r[0]!.type);
  });

  it('Wörter des Tages brechen den Gleichstand (mindestens 1 von 6 Aufgaben enthält ein Kartenwort)', () => {
    const t = allSeedTasks().find((x) => x.topic === 'time-clauses' && x.type === 'gap' && x.pat)!;
    const word = (t.prompt.replace(/_{3,}/, t.answer).match(/[A-Za-z]{6,}/g) ?? []).sort((a, b) => b.length - a.length)[0]!;
    const r = selectRound(input({ grammarDocs: docs(), gt: { intro: null, pats: [], topics: ['time-clauses'] }, wordsToday: [word] }));
    expect(r.some((x) => `${x.prompt} ${x.answer}`.toLowerCase().includes(word.toLowerCase()))).toBe(true);
  });

  it('errorsMax 0: keine Fehlersätze in der Runde (Plan rv 2)', () => {
    const e = { q: 'If I would know, I would tell you.', given: 'would know', ans: 'If I knew, I would tell you.', t: now - 3 * 86_400_000, src: 'seed', pat: 'mc.present-cond', box: 0, due: now - 1000 };
    const d = docs({ 'mixed-cond': begun({ errors: [e] }) });
    const withErr = selectRound(input({ grammarDocs: d, errorsMax: 3 }));
    expect(withErr.some((t) => t.errorT !== null)).toBe(true);
    expect(selectRound(input({ grammarDocs: d, errorsMax: 0 })).some((t) => t.errorT !== null)).toBe(false);
  });

  it('Vortest: zwei getippte Aufgaben zu den Mustern des Tages', () => {
    const step = patternsOf('mixed-cond')!.introPlan[0]!;
    const vt = selectVortest({ ...input(), topic: 'mixed-cond', pats: step });
    expect(vt).toHaveLength(2);
    for (const t of vt) {
      expect(['gap', 'kwt']).toContain(t.type);
      expect(step).toContain(t.pat);
    }
    expect(vt[0]!.key).not.toBe(vt[1]!.key);
  });

  it('Variante: ungesehen, gleiches Muster, nie dieselbe Aufgabe; ohne Muster keine', () => {
    const t = allSeedTasks().find((x) => x.topic === 'cond-alt' && x.pat && x.type === 'gap')!;
    const v = variantOf(t, input());
    expect(v).toBeTruthy();
    expect(v!.pat).toBe(t.pat);
    expect(v!.key).not.toBe(t.key);
    expect(variantOf({ ...t, pat: null }, input())).toBeNull();
  });
});
