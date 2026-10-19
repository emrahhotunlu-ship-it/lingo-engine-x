import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFailure } from '../../src/ai/types';
import { normalizeTask, toPoolItem } from '../../src/domain/grammar/tasks';
import { poolSchema } from '../../src/data/schemas';
import { useCapabilities } from '../../src/platform/capabilities';
import { solveCheck } from '../../src/prompts/solveCheck';

// Engine-Verdrahtung 19.10.2026: Neu erzeugte Grammatik-Aufgaben laufen durch `acceptGrammarItem` (Ziel-Satz bleibt) und – mit Zustimmung, Tutor-Bremse
// und Hintergrund-Budget – durch den zweiten Löser `solve-check@1`. Ohne Prüfung bleiben die lokal angenommenen Aufgaben wie bisher.

const askJson = vi.fn();
vi.mock('../../src/ai/gate', () => ({ askJson: (...a: unknown[]): unknown => askJson(...a) }));
const budget = vi.hoisted(() => ({ verdict: null as string | null, tutor: 20, taken: 0 }));
vi.mock('../../src/ai/budget', () => ({ bgVerdict: () => budget.verdict }));
vi.mock('../../src/ai/tutorBudget', () => ({
  tutorLeft: () => budget.tutor,
  takeTutorCall: () => {
    if (budget.tutor <= 0) return false;
    budget.tutor -= 1;
    budget.taken += 1;
    return true;
  },
}));

const { checkNewItems } = await import('../../src/features/grammar/generate');

const base = { topic: 'passive', accepted: [] as string[], options: null, hint_de: '(organize)', explanation_de: 'Der Workshop organisiert sich nicht selbst, deshalb Passiv.', explanation_en: 'The workshop does not organize itself, so we use the passive.', src: 'ai' };
const gap = { ...base, type: 'gap', prompt: 'The workshop ___ (organize) by our team last spring.', answer: 'was organized' };
const fix = {
  ...base,
  hint_de: '',
  type: 'correct',
  prompt: 'The invoices was sent to the client last Friday.',
  answer: 'The invoices were sent to the client last Friday.',
  goal: { de: 'Die Rechnungen gingen letzten Freitag an den Kunden.', en: 'The invoices went to the client last Friday.' },
};
const signal = new AbortController().signal;

beforeEach(() => {
  askJson.mockReset();
  budget.verdict = null;
  budget.tutor = 20;
  budget.taken = 0;
  useCapabilities.setState({ sampleConfirmed: true });
});

describe('solve-check@1 im Erzeugungsweg', () => {
  it('ohne Zustimmung: kein Aufruf, lokal angenommene Aufgaben mit Ziel-Satz', async () => {
    useCapabilities.setState({ sampleConfirmed: false });
    const r = await checkNewItems([gap, fix], signal);
    expect(askJson).not.toHaveBeenCalled();
    expect(r.checked).toBe(false);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[1]?.goal?.en).toBe('The invoices went to the client last Friday.');
    expect(r.raws).toEqual([gap, fix]);
  });

  it('Tutor-Bremse oder Hintergrund-Budget erschöpft: kein Aufruf, nichts gezählt', async () => {
    budget.tutor = 0;
    expect((await checkNewItems([gap], signal)).checked).toBe(false);
    budget.tutor = 20;
    budget.verdict = 'budget';
    expect((await checkNewItems([gap], signal)).checked).toBe(false);
    expect(askJson).not.toHaveBeenCalled();
    expect(budget.taken).toBe(0);
  });

  it('Hintergrund-Aufruf: nur bestätigte Aufgaben bleiben, mehrdeutige und fehlende fallen weg', async () => {
    askJson.mockResolvedValue({ data: { results: [{ i: 0, answers: ['was organized'], ambiguous: false, why: { de: '', en: '' } }] } });
    const r = await checkNewItems([gap, fix], signal);
    expect(askJson).toHaveBeenCalledTimes(1);
    const req = askJson.mock.calls[0]?.[0] as { template: unknown; priority: string; vars: { tasks: unknown[] } };
    expect(req.template).toBe(solveCheck);
    expect(req.priority).toBe('background');
    expect(req.vars.tasks).toHaveLength(2);
    // Die Aufgabe geht OHNE Lösung an Claude (nur Satz, Hinweis, Auswahl, Ziel).
    expect(solveCheck.build({ tasks: req.vars.tasks as never })).not.toContain('was organized');
    expect(budget.taken).toBe(1);
    expect(r.checked).toBe(true);
    expect(r.tasks.map((t) => t.answer)).toEqual(['was organized']);
    expect(r.raws).toEqual([gap]);
  });

  it('zweiter Löser findet eine weitere gültige Antwort → verworfen', async () => {
    askJson.mockResolvedValue({ data: { results: [{ i: 0, answers: ['was organized', 'got organized'], ambiguous: false, why: { de: '', en: '' } }] } });
    expect((await checkNewItems([gap], signal)).tasks).toEqual([]);
  });

  it('Fehler des KI-Tors: lokal geprüfte Aufgaben bleiben; Abbruch durch den Nutzer wird weitergereicht', async () => {
    askJson.mockRejectedValue(new AiFailure('busy', 'rate_limited', null));
    const r = await checkNewItems([gap], signal);
    expect(r.checked).toBe(false);
    expect(r.tasks).toHaveLength(1);
    const ac = new AbortController();
    ac.abort();
    askJson.mockRejectedValue(new AiFailure('cancelled', 'cancelled', null));
    await expect(checkNewItems([gap], ac.signal)).rejects.toBeInstanceOf(AiFailure);
  });
});

describe('Ziel-Satz im Pool', () => {
  it('toPoolItem schreibt goal, normalizeTask liest es zurück; Pool-Schema bleibt gültig', () => {
    const t = normalizeTask(fix, 'ai');
    expect(t?.goal).toEqual(fix.goal);
    const item = toPoolItem(t!);
    expect(item.goal).toEqual(fix.goal);
    expect(poolSchema.safeParse({ items: [item], t: 1 }).success).toBe(true);
    expect(normalizeTask(item, 'ai')?.goal).toEqual(fix.goal);
    // Nur zweisprachig: einseitige Ziele fallen weg.
    expect(normalizeTask({ ...fix, goal: { de: 'nur deutsch' } }, 'ai')?.goal).toBeUndefined();
  });
});
