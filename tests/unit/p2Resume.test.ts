import { describe, expect, it } from 'vitest';
import { useFocus, focusSnapshot, restoreFocus, commitFocus } from '../../src/features/grammar/focus/session';
import { grammarSnapshot, restoreGrammar, useGrammarSession } from '../../src/features/grammar/session';
import { againSnapshot, restoreAgain, useAgain } from '../../src/features/repair/again/session';
import { drillSnapshot, restoreDrill, useDrill } from '../../src/features/drills/session';
import type { GrammarTask } from '../../src/domain/learn/types';
import type { FocusTask } from '../../src/domain/repair/unit';

// Fortsetz-Verträge von P2 (plan.md G3): Momentaufnahme → Herstellen → gleiche Position; nie ein
// Schreibvorgang (die Funktionen berühren nur die Sitzungs-Stores).

const task = (k: string): GrammarTask => ({ key: k, topic: 'articles', type: 'gap', prompt: `I saw ___ ${k}.`, answer: 'a', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null });

describe('Fortsetzen', () => {
  it('Grammatik-Runde: gleiche Aufgabe (4 von 6), Ergebnisse bleiben, Minuten zählen neu', () => {
    useGrammarSession.setState({ active: true, status: 'running', mode: 'xtra', topic: null, ctx: 'xtra', day: '2026-09-20', lang: 'de', tasks: ['a', 'b', 'c', 'd', 'e', 'f'].map(task), pos: 3, step: 9, results: [{ key: 'a', topic: 'articles', ok: true, verdict: 'correct' }], activeMs: 50_000 });
    const snap = JSON.parse(JSON.stringify(grammarSnapshot())) as NonNullable<ReturnType<typeof grammarSnapshot>>;
    useGrammarSession.setState({ active: false, tasks: [], pos: 0, results: [] });
    expect(restoreGrammar(snap)).toBe(true);
    const s = useGrammarSession.getState();
    expect(s.active).toBe(true);
    expect(s.pos).toBe(3);
    expect(s.tasks[s.pos]?.key).toBe('d');
    expect(s.results).toHaveLength(1);
    expect(s.activeMs).toBe(0);
    expect(restoreGrammar({ ...snap, pos: 99 })).toBe(false);
  });

  it('Kurzübung: Lückenjagd an derselben Stelle; Sprint wird nie gesichert', () => {
    useDrill.setState({ active: true, status: 'running', kind: 'order', ctx: 'xtra', day: '2026-09-20', lang: 'de', dictate: [], cloze: [], order: [{ key: 'o1', de: 'x' }, { key: 'o2', de: 'y' }] as never, sprint: [], pos: 1, results: [] });
    const snap = drillSnapshot();
    expect(snap?.pos).toBe(1);
    useDrill.setState({ active: false, pos: 0 });
    expect(restoreDrill(JSON.parse(JSON.stringify(snap)) as NonNullable<typeof snap>)).toBe(true);
    expect(useDrill.getState().pos).toBe(1);
    useDrill.setState({ kind: 'sprint', sprint: [{}] as never });
    expect(drillSnapshot()).toBeNull();
  });

  it('Satzbau aus der Zeit vor dem festen Pool (ohne deutsche Bedeutung, mit Ablenkern) wird nicht fortgesetzt', () => {
    useDrill.setState({ active: true, status: 'running', kind: 'order', ctx: 'xtra', day: '2026-09-20', lang: 'de', dictate: [], cloze: [], order: [{ key: 'o1' }, { key: 'o2' }] as never, sprint: [], pos: 1, results: [] });
    const old = JSON.parse(JSON.stringify(drillSnapshot())) as NonNullable<ReturnType<typeof drillSnapshot>>;
    useDrill.setState({ active: false, pos: 0 });
    expect(restoreDrill(old)).toBe(false);
    // Diktat und Lückenjagd bleiben unberührt.
    useDrill.setState({ active: true, status: 'running', kind: 'cloze', ctx: 'xtra', day: '2026-09-20', lang: 'de', dictate: [], cloze: [{ key: 'c1' }] as never, order: [], sprint: [], pos: 0, results: [] });
    const cl = JSON.parse(JSON.stringify(drillSnapshot())) as NonNullable<ReturnType<typeof drillSnapshot>>;
    useDrill.setState({ active: false });
    expect(restoreDrill(cl)).toBe(true);
  });

  it('Block 4: gleiche Aufgabe, beantwortete bleiben beantwortet', () => {
    const tasks: FocusTask[] = [
      { kind: 'trap', id: 't1', trapId: 'f01', wrong: 'x', right: ['y'], n: 0, of: 0, drill: false },
      { kind: 'trap', id: 't2', trapId: 'f02', wrong: 'x', right: ['y'], n: 0, of: 0, drill: false },
    ];
    useFocus.setState({ active: true, status: 'running', day: '2026-09-20', tasks, pos: 0, results: [], block: 4, reported: false });
    commitFocus({ id: 't1', kind: 'trap', ok: true, verdict: 'ok', right: 'y' });
    const snap = JSON.parse(JSON.stringify(focusSnapshot())) as NonNullable<ReturnType<typeof focusSnapshot>>;
    useFocus.setState({ active: false, pos: 0, results: [] });
    expect(restoreFocus(snap)).toBe(true);
    expect(useFocus.getState().pos).toBe(1);
    expect(useFocus.getState().results.map((r) => r.id)).toEqual(['t1']);
    // Eine schon übernommene Antwort wird nicht noch einmal gezählt.
    commitFocus({ id: 't1', kind: 'trap', ok: true, verdict: 'ok', right: 'y' });
    expect(useFocus.getState().results).toHaveLength(1);
  });

  it('Block 5: Schritt und Entwurf', () => {
    useAgain.setState({ active: true, phase: 'write', day: '2026-09-20', src: { before: 'b', better: null, betterFrom: null, fixes: [] }, draft: 'Mein Entwurf' });
    const snap = JSON.parse(JSON.stringify(againSnapshot())) as NonNullable<ReturnType<typeof againSnapshot>>;
    useAgain.setState({ active: false, draft: '' });
    expect(restoreAgain(snap)).toBe(true);
    expect(useAgain.getState().draft).toBe('Mein Entwurf');
  });
});
