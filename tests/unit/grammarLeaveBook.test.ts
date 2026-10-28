import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLive } from '../../src/data/live';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { grammarWrite } from '../../src/domain/grammar/write';
import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { bookGrammarLeft, commitGrammar, startGrammar, useGrammarSession } from '../../src/features/grammar/session';
import { learnRecorder } from '../../src/features/progress/persist';
import { useTodayPlan } from '../../src/features/today/store';
import { berlin } from './helpers';

vi.mock('../../src/domain/unit/plan', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), unitGrammarArgs: () => ({ n: 6, errs: 0 }), planRvOf: () => 2 }));

// Befund 1 (Daten-Wächter, P3 S1-BAND „Buchen beim Verlassen“): Wird die Antwort beim Verbergen gebucht (`stay`) und danach mit „Weiter“
// weitergeführt, schreibt der Weiter-Weg nicht mehr (`saveGrammar` ist je Zeitstempel idempotent). Dann muss schon die Buchung beim Verlassen
// `vt` (Vortest-Ergebnis) bzw. `tt` (Themen-Test-Ergebnis) tragen – dieselbe Anreicherung wie bei „Weiter“.

const now = berlin('2026-10-06', 10);
const DAY = '2026-10-06';
const TOPIC = 'mixed-cond';
const STEP = patternsOf(TOPIC)!.introPlan[0]!;

function start() {
  useLive.setState({ status: 'ready', docs: { 'app/c1': null }, collections: { grammar: new Map(), vocab: new Map(), chunk: new Map(), archive: new Map() } });
  useTodayPlan.setState({ plan: { v: 1, u: { gt: { intro: TOPIC, pats: STEP, topics: [TOPIC] } } } as never });
  startGrammar({ mode: 'duty', day: DAY, block: 2 });
  return useGrammarSession.getState();
}

const answer = (t: GrammarTask, k: number, ok = true): GrammarAnswer =>
  ({ task: t, given: ok ? t.answer : 'x', verdict: ok ? 'correct' : 'wrong', ms: 4000, t: now + k, day: DAY, help: { level: 0 }, dontKnow: false, ctx: 'duty' }) as unknown as GrammarAnswer;

let saved: GrammarAnswer[];

describe('Buchen beim Verlassen trägt vt/tt wie „Weiter“', () => {
  beforeEach(() => {
    saved = [];
    useGrammarSession.setState({ active: false, tasks: [], pos: 0, results: [], intro: null, test: null });
    vi.spyOn(learnRecorder, 'grammar').mockImplementation((a) => {
      saved.push(a);
      return Promise.resolve(true);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('stay auf der Vortest-Antwort, dann Weiter: vt steht in der gebuchten Antwort und im Thema, es wird nur einmal gebucht', () => {
    const s = start();
    expect(s.intro?.vtN).toBe(2);
    const [t0, t1] = s.tasks;
    commitGrammar(answer(t0!, 0));
    const a1 = answer(t1!, 1);
    bookGrammarLeft(a1);
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ left: true, vt: { ok: true } });
    expect(saved[1]!.vt!.pats.length).toBeGreaterThan(0);
    // Weiter mit derselben Antwort: nichts mehr schreiben, die Runde rechnet den Vortest trotzdem aus.
    commitGrammar(a1);
    expect(saved).toHaveLength(2);
    expect(useGrammarSession.getState().intro?.passed).toBe(true);
    // Das Thema bekommt `vt` aus der gebuchten Antwort.
    const w = grammarWrite(undefined, saved[1]!);
    expect(w.kind).toBe('create');
    if (w.kind === 'create') expect(w.doc.vt).toMatchObject({ d: DAY, ok: true });
  });

  it('ohne stay bucht „Weiter“ wie bisher mit vt, die erste Antwort bleibt ohne vt und ohne left', () => {
    const s = start();
    const [t0, t1] = s.tasks;
    commitGrammar(answer(t0!, 0));
    commitGrammar(answer(t1!, 1));
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ vt: { ok: true } });
    expect(saved[1]!.left).toBeUndefined();
    expect(saved[0]!.vt).toBeUndefined();
  });

  it('stay auf der letzten Testantwort, dann Weiter: tt steht in der gebuchten Antwort und im Thema', () => {
    const s = start();
    const [t0, t1] = s.tasks;
    useGrammarSession.setState({ intro: null, test: { topic: TOPIC, n: 2, result: null }, tasks: [t0!, t1!], pos: 0, results: [] });
    commitGrammar(answer(t0!, 0));
    const a1 = answer(t1!, 1, false);
    bookGrammarLeft(a1);
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ left: true, tt: { c: 1, n: 2 } });
    commitGrammar(a1);
    expect(saved).toHaveLength(2);
    expect(useGrammarSession.getState().test?.result).toMatchObject({ c: 1, n: 2 });
    const w = grammarWrite(undefined, saved[1]!);
    expect(w.kind).toBe('create');
    if (w.kind === 'create') expect(w.doc.tt).toMatchObject({ c: 1, n: 2 });
  });
});
