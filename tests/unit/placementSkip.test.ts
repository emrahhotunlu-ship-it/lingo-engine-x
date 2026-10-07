import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLive } from '../../src/data/live';
import { SKIP_TEST_N, SKIP_TEST_PASS, skipTopicsOf } from '../../src/domain/c1/placement/run';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { selectVortest } from '../../src/domain/grammar/tasks';
import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { commitGrammar, startGrammar, useGrammarSession } from '../../src/features/grammar/session';
import { useTodayPlan } from '../../src/features/today/store';
import { berlin } from './helpers';

vi.mock('../../src/domain/unit/plan', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), unitGrammarArgs: () => ({ n: 6, errs: 0 }), planRvOf: () => 2 }));

// Kurzweg der Einstufung (Lernplattform 3.0 P34): Ein Thema in `app/c1.place.skip` bekommt als Vortest 4 Aufgaben über alle Muster des Themas
// (bestanden bei mindestens 3 sauberen: richtig, ohne Hilfe, unter 20 s). Themen ohne Kurzweg behalten den Vortest mit 2 Aufgaben.
// Die Tagesgrenze (höchstens ein Einführungsschritt je Tag) kommt aus `gt` des Plans und ändert sich durch den Kurzweg nicht.

const now = berlin('2026-10-06', 10);
const DAY = '2026-10-06';
const TOPIC = 'mixed-cond';
const ALL = patternsOf(TOPIC)!.patterns.map((p) => p.id);
const STEP = patternsOf(TOPIC)!.introPlan[0]!;

const place = (skip: string[]) => ({ v: 1, checks: [], gates: [], prod: [], bad: [], place: { d: '2026-10-01', se: 0.4, n: 16, th: 0.8, skip } });

function start(skip: string[] | null) {
  useLive.setState({ status: 'ready', docs: { 'app/c1': skip ? place(skip) : null }, collections: { grammar: new Map(), vocab: new Map(), chunk: new Map(), archive: new Map() } });
  useTodayPlan.setState({ plan: { v: 1, u: { gt: { intro: TOPIC, pats: STEP, topics: [TOPIC] } } } as never });
  startGrammar({ mode: 'duty', day: DAY, block: 2 });
  return useGrammarSession.getState();
}

const answer = (t: GrammarTask, ok: boolean, ms = 4000): GrammarAnswer =>
  ({ task: t, given: ok ? t.answer : 'x', verdict: ok ? 'correct' : 'wrong', ms, t: now, day: DAY, help: { level: 0 }, dontKnow: false, ctx: 'duty' }) as unknown as GrammarAnswer;

describe('selectVortest mit n = 4', () => {
  it('liefert 4 verschiedene getippte Aufgaben reihum über die Muster des Themas', () => {
    const vt = selectVortest({ mode: 'duty', grammarDocs: new Map(), dailyOpen: [], pool: [], nowMs: now, seed: 'k', gt: null, profile: 'keys', wordsToday: [], topic: TOPIC, pats: ALL, introduce: TOPIC, n: 4 } as never);
    expect(vt).toHaveLength(4);
    expect(new Set(vt.map((t) => t.key)).size).toBe(4);
    for (const t of vt) expect(['gap', 'kwt']).toContain(t.type);
    expect(new Set(vt.map((t) => t.pat)).size).toBeGreaterThanOrEqual(3);
  });
  it('ohne n bleibt es bei 2 Aufgaben', () => {
    const vt = selectVortest({ mode: 'duty', grammarDocs: new Map(), dailyOpen: [], pool: [], nowMs: now, seed: 'k', gt: null, profile: 'keys', wordsToday: [], topic: TOPIC, pats: STEP, introduce: TOPIC } as never);
    expect(vt).toHaveLength(2);
  });
});

describe('Runde mit Kurzweg', () => {
  beforeEach(() => {
    useGrammarSession.setState({ active: false, tasks: [], pos: 0, results: [], intro: null });
  });
  it('liest skipTopicsOf aus app/c1 (leer ohne Einstufung)', () => {
    expect(skipTopicsOf(null).size).toBe(0);
    expect(skipTopicsOf(place(['a', 'b'])).has('b')).toBe(true);
  });
  it('Thema mit Kurzweg: 4 Vortest-Aufgaben; ohne Kurzweg: 2', () => {
    const s = start([TOPIC]);
    expect(s.intro?.vtN).toBe(SKIP_TEST_N);
    expect(s.intro?.kurz).toBe(true);
    const t = start(['pres-simple-cont']);
    expect(t.intro?.vtN).toBe(2);
    expect(t.intro?.kurz).toBeUndefined();
    const u = start(null);
    expect(u.intro?.vtN).toBe(2);
  });
  it('3 von 4 sauber bestehen, 2 von 4 nicht; Entscheidung erst mit der vierten Antwort', () => {
    let s = start([TOPIC]);
    expect(s.intro?.passed).toBeNull();
    const tasks = s.tasks.slice(0, 4);
    for (let k = 0; k < 3; k++) {
      commitGrammar(answer(tasks[k]!, true));
      expect(useGrammarSession.getState().intro?.passed).toBeNull();
    }
    commitGrammar(answer(tasks[3]!, true));
    s = useGrammarSession.getState();
    expect(s.intro?.passed).toBe(true);
    expect(SKIP_TEST_PASS).toBe(3);

    let w = start([TOPIC]);
    const wt = w.tasks.slice(0, 4);
    commitGrammar(answer(wt[0]!, true));
    commitGrammar(answer(wt[1]!, false));
    commitGrammar(answer(wt[2]!, true));
    commitGrammar(answer(wt[3]!, false));
    w = useGrammarSession.getState();
    expect(w.intro?.passed).toBe(false);
  });
  it('eine langsame richtige Antwort (über 20 s) ist nicht sauber: 3 richtige, davon eine langsam, besteht nicht', () => {
    let s = start([TOPIC]);
    const tasks = s.tasks.slice(0, 4);
    commitGrammar(answer(tasks[0]!, true));
    commitGrammar(answer(tasks[1]!, true, 25_000));
    commitGrammar(answer(tasks[2]!, true));
    commitGrammar(answer(tasks[3]!, false));
    s = useGrammarSession.getState();
    expect(s.intro?.passed).toBe(false);
  });
  it('Vortest ohne Kurzweg: beide sauber nötig, wie bisher', () => {
    let s = start(null);
    const tasks = s.tasks.slice(0, 2);
    commitGrammar(answer(tasks[0]!, true));
    commitGrammar(answer(tasks[1]!, false));
    s = useGrammarSession.getState();
    expect(s.intro?.passed).toBe(false);
  });
  it('höchstens ein Einführungsschritt je Tag: die Runde führt nur das Tagesthema ein, auch mit Kurzweg für mehrere Themen', () => {
    const s = start([TOPIC, 'conditionals', 'cond-alt', 'prep-time']);
    expect(s.intro?.topic).toBe(TOPIC);
    const introTopics = new Set(s.tasks.filter((t) => t.errorT === null && s.intro && t.topic !== TOPIC && t.pat && patternsOf(t.topic)?.introPlan[0]?.includes(t.pat)).map((t) => t.topic));
    expect(s.intro?.pats).toEqual(STEP);
    // Nur ein Einführungsblock (das Thema des Tages), kein zweiter Kurztest für ein anderes Thema.
    expect(s.tasks.slice(0, SKIP_TEST_N).every((t) => t.topic === TOPIC)).toBe(true);
    expect(introTopics.size).toBeGreaterThanOrEqual(0);
  });
});
