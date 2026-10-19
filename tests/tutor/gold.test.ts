import { describe, expect, it } from 'vitest';
import { allSeedTasks } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import { judge, type Judgement } from '../../src/domain/tutor/judge';
import gold from './gold/grammar.json';

// Gold-Liste (Tutor-Engine v3 §4.3): nur das lokale `judge`, ohne KI und ohne gespeicherte Urteile (`fitAlt` leer).
// Positive Fälle dürfen nie `wrong` ergeben, negative nie `correct`/`alt_ok`.

type Case = {
  id: string;
  topic: string;
  prompt: string;
  given: string;
  tapped?: number[];
  targetRetry?: boolean;
  emrah?: boolean;
  expect?: Partial<Pick<Judgement, 'v' | 'kind' | 'fitsGoal' | 'book'>>;
};

const tasks = allSeedTasks();
const taskOf = (c: Case): GrammarTask | undefined => tasks.find((t) => t.topic === c.topic && t.prompt === c.prompt);
const run = (c: Case): Judgement => {
  const task = taskOf(c);
  if (!task) throw new Error(`Aufgabe fehlt im Bestand: ${c.id}`);
  const tapped = c.tapped && c.tapped.length === 2 ? ([c.tapped[0], c.tapped[1]] as [number, number]) : null;
  return judge(task, c.given, { fitAlt: {}, aiState: { confirmed: false, available: false, budgetLeft: 0 }, tapped, targetRetry: c.targetRetry === true });
};

const pos = gold.pos as Case[];
const neg = gold.neg as Case[];

describe('Gold-Liste: Umfang', () => {
  it('hat rund 40 positive und 20 negative Fälle, darunter Emrahs gemeldete', () => {
    expect(pos.length).toBeGreaterThanOrEqual(40);
    expect(neg.length).toBeGreaterThanOrEqual(20);
    expect(new Set([...pos, ...neg].map((c) => c.id)).size).toBe(pos.length + neg.length);
    expect([...pos, ...neg].filter((c) => c.emrah).map((c) => c.id)).toEqual(expect.arrayContaining(['ut-had', 'cp-sub-while', 'cp-sub-walked']));
  });
});

describe('Gold-Liste: positive Fälle sind nie falsch', () => {
  for (const c of pos) {
    it(c.id, () => {
      const j = run(c);
      expect(j.v, `${c.id}: ${c.given}`).not.toBe('wrong');
      for (const [k, v] of Object.entries(c.expect ?? {})) expect(j[k as keyof Judgement], `${c.id}.${k}`).toEqual(v);
    });
  }
});

describe('Gold-Liste: negative Fälle sind nie richtig', () => {
  for (const c of neg) {
    it(c.id, () => {
      const j = run(c);
      expect(['correct', 'alt_ok'], `${c.id}: ${c.given}`).not.toContain(j.v);
      for (const [k, v] of Object.entries(c.expect ?? {})) expect(j[k as keyof Judgement], `${c.id}.${k}`).toEqual(v);
    });
  }
});

describe('KI stuft nur hoch', () => {
  const c = neg.find((x) => x.id === 'ut-have-had') as Case;
  const task = taskOf(c) as GrammarTask;
  const ai = { confirmed: true, available: true, budgetLeft: 3 };
  it('„falsch“ von Claude ändert ein lokales Urteil nie nach unten', () => {
    const ok = pos.find((x) => x.id === 'ut-used-to') as Case;
    const j = judge(taskOf(ok) as GrammarTask, ok.given, { fitAlt: {}, aiState: ai, ai: { fits: false, certain: true, why: '' } });
    expect(j.v).toBe('correct');
  });
  it('unsicheres Ja hebt nicht hoch', () => {
    const j = judge(task, c.given, { fitAlt: {}, aiState: ai, ai: { fits: true, certain: false, why: '' } });
    expect(['correct', 'alt_ok']).not.toContain(j.v);
  });
  it('fitAlt by me → correct, by ai → alt_ok ohne Buchung', async () => {
    const { fitAltHash } = await import('../../src/domain/tutor/judge');
    const h = fitAltHash(c.given);
    const me = judge(task, c.given, { fitAlt: { [task.key]: { [h]: { a: c.given, t: 1, by: 'me', pv: 'grammar-fit@1' } } }, aiState: ai });
    expect([me.v, me.by, me.book]).toEqual(['correct', 'me', 'full']);
    const byAi = judge(task, c.given, { fitAlt: { [task.key]: { [h]: { a: c.given, t: 1, by: 'ai', pv: 'grammar-fit@1' } } }, aiState: ai });
    expect([byAi.v, byAi.by, byAi.book]).toEqual(['alt_ok', 'ai', 'none']);
  });
});
