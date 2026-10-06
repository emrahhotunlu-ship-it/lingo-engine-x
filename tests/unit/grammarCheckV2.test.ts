import { describe, expect, it } from 'vitest';
import { checkFind, checkKwt, checkMeaning, guessOptions } from '../../src/domain/grammar/check';
import { bktStep } from '../../src/domain/grammar/bkt';
import { asFind, fromV2, allSeedTasks } from '../../src/domain/grammar/tasks';
import { v2Tasks } from '../../src/domain/grammar/patterns';
import type { GrammarTask } from '../../src/domain/learn/types';

const tasks = (type: GrammarTask['type']): GrammarTask[] => allSeedTasks().filter((t) => t.type === type && t.src === 'seed' && t.ref === 'content/grammar/tasks-v2');

describe('neue Aufgabenarten (Lernplattform 2.0 §4.7)', () => {
  it('alle v2-Aufgaben werden zu Aufgaben der Runde, mit Muster und Begründung', () => {
    const n = v2Tasks().length;
    expect(n).toBeGreaterThan(0);
    const mapped = v2Tasks().map(fromV2);
    expect(mapped.every((t) => t && t.pat && t.why && t.x)).toBe(true);
    expect(tasks('kwt').length + tasks('find').length + tasks('meaning').length).toBe(n);
  });

  it('kwt: Schlüsselwort muss ausgeschrieben dastehen, Lösung und accepted gelten', () => {
    const t = tasks('kwt')[0]!;
    expect(checkKwt(t, t.answer).verdict).toBe('correct');
    for (const a of t.accepted) expect(checkKwt(t, a).verdict).toBe('correct');
    const noKey = checkKwt(t, 'the client signs on time');
    expect(noKey).toMatchObject({ verdict: 'wrong', kind: 'key' });
    expect(checkKwt(t, '').verdict).toBe('wrong');
  });

  it('kwt: Wortzahl außerhalb des Bereichs ist falsch (Art words)', () => {
    const t = tasks('kwt').find((x) => x.x?.kind === 'kwt')!;
    const key = (t.x as { key: string }).key.toLowerCase();
    const r = checkKwt(t, `${key} one two three four five six seven eight`);
    expect(r.verdict).toBe('wrong');
    expect(r.kind).toBe('words');
  });

  it('find: Stelle antippen, „Kein Fehler“ und Ersetzen', () => {
    const t = tasks('find').find((x) => x.x?.kind === 'find' && x.x.err)!;
    const err = (t.x as { err: [number, number] }).err;
    expect(checkFind(t, { tapped: err })).toMatchObject({ verdict: 'correct', found: true });
    expect(checkFind(t, { tapped: [err[0], err[0]] }).found).toBe(true);
    expect(checkFind(t, { tapped: [err[1] + 3, err[1] + 3] }).found).toBe(false);
    expect(checkFind(t, { tapped: 'none' })).toMatchObject({ verdict: 'wrong', found: false });
    expect(checkFind(t, { replacement: t.answer }).verdict).toBe('correct');
    expect(checkFind(t, { replacement: 'xyzzy' }).verdict).toBe('wrong');
  });

  it('find: ein fehlerfreier Satz ist nur mit „Kein Fehler“ richtig', () => {
    const t = tasks('find').find((x) => x.x?.kind === 'find' && x.x.err === null)!;
    expect(t).toBeTruthy();
    expect(checkFind(t, { tapped: 'none' }).verdict).toBe('correct');
    expect(checkFind(t, { tapped: [0, 0] }).verdict).toBe('wrong');
  });

  it('meaning: a, b oder beide', () => {
    const t = tasks('meaning')[0]!;
    expect(checkMeaning(t, t.answer as 'a').verdict).toBe('correct');
    const other = (['a', 'b', 'both'] as const).find((x) => x !== t.answer)!;
    expect(checkMeaning(t, other).verdict).toBe('wrong');
  });

  it('correct → find für das Handy, wenn die Fehlerstelle eindeutig ist (Ersatz = Bereich der richtigen Fassung)', () => {
    const t: GrammarTask = { key: 'k', topic: 'passive', type: 'correct', prompt: 'The report are sent every Monday.', answer: 'The report is sent every Monday.', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null };
    const f = asFind(t)!;
    expect(f.type).toBe('find');
    expect(f.x).toMatchObject({ kind: 'find', err: [2, 2], fixed: 'The report is sent every Monday.' });
    expect(f.answer).toBe('is');
    expect(checkFind(f, { replacement: 'is' }).verdict).toBe('correct');
    // Zwei getrennte Stellen: nicht eindeutig.
    expect(asFind({ ...t, key: 'k2', prompt: 'The report are sent every Mondays.', answer: 'The report is sent every Monday.' })).toBeNull();
  });

  it('BKT: richtig bei meaning bringt höchstens so viel wie mc', () => {
    const base = { p: 0.4, anchor: null, anchorD: null, day: '2026-10-06', ok: true, helpLevel: 0 as const };
    const mc = bktStep({ ...base, type: 'mc', nOptions: 4 });
    const meaning = bktStep({ ...base, type: 'meaning', nOptions: guessOptions({ type: 'meaning', prompt: 'a', options: null }) });
    expect(meaning.p).toBeLessThanOrEqual(mc.p);
  });
});
