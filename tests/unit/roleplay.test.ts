import { describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { AnalysisLane } from '../../src/features/speak/analysisLane';
import { roleplayMachine, stateName } from '../../src/features/speak/roleplayMachine';
import type { AnalysisView } from '../../src/domain/speak/types';

// Rollenspiel-Ablauf (Plan §5.2, §6.3, §9.1): Maschine und Analysespur.

const view: AnalysisView = { verdict: 'clean', english: true, errors: [], upgraded: 'Fine.', changes: [], lands: 'Gut.', chunks: [], targets: [] };

const start = () => {
  const a = createActor(roleplayMachine, { input: { opening: 'Convince me.', startedAt: 1000 } });
  a.start();
  return a;
};
const st = (a: ReturnType<typeof start>) => stateName(a.getSnapshot().value);

describe('roleplayMachine', () => {
  it('Eröffnung → 3 Züge → Beenden → Bericht', () => {
    const a = start();
    expect(a.getSnapshot().context.turns).toEqual([{ role: 'persona', text: 'Convince me.', t: 1000 }]);
    for (let i = 0; i < 3; i++) {
      a.send({ type: 'SEND', text: `Answer ${i}`, usedChip: i === 1, t: 2000 + i });
      expect(st(a)).toBe('thinking');
      a.send({ type: 'TEXT', text: 'Part' });
      expect(st(a)).toBe('streaming');
      expect(a.getSnapshot().context.partial).toBe('Part');
      a.send({ type: 'REPLY', text: `Reply ${i}`, truncated: false, t: 3000 + i });
      expect(st(a)).toBe('composing');
    }
    const c = a.getSnapshot().context;
    expect(c.turns).toHaveLength(7);
    expect(c.turns[3]).toMatchObject({ role: 'me', usedChip: true });
    a.send({ type: 'END', t: 9000 });
    expect(st(a)).toBe('finishing');
    a.send({ type: 'SAVED' });
    expect(st(a)).toBe('report');
    a.send({ type: 'REPORT_PHASE', state: 'thinking' });
    expect(a.getSnapshot().context.report.state).toBe('thinking');
  });

  it('leerer Satz wird nicht gesendet', () => {
    const a = start();
    a.send({ type: 'SEND', text: '   ', usedChip: false, t: 1 });
    expect(st(a)).toBe('composing');
  });

  it('Fehler der Figur: eigener Satz zurück ins Feld, Teiltext nur als Anzeige', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'My answer', usedChip: true, t: 2 });
    a.send({ type: 'FAIL', error: 'aiFailed', partial: 'Well, I', unavailable: false });
    const c = a.getSnapshot().context;
    expect(st(a)).toBe('composing');
    expect(c.turns).toHaveLength(1);
    expect(c).toMatchObject({ draft: 'My answer', draftChip: true, error: 'aiFailed', interrupted: 'Well, I' });
    expect(c.restoreN).toBe(2);
  });

  it('Stopp: Satz zurück, kein Fehler', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'My answer', usedChip: false, t: 2 });
    a.send({ type: 'SLOW' });
    expect(st(a)).toBe('slow');
    a.send({ type: 'CANCELLED' });
    expect(st(a)).toBe('composing');
    expect(a.getSnapshot().context).toMatchObject({ draft: 'My answer', error: null });
  });

  it('unavailable → blocked, Gespräch bleibt beendbar', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'Hi there', usedChip: false, t: 2 });
    a.send({ type: 'FAIL', error: 'aiUnavailable', partial: '', unavailable: true });
    expect(st(a)).toBe('blocked');
    a.send({ type: 'END', t: 3 });
    expect(st(a)).toBe('finishing');
  });

  it('Analysefehler ändert den Hauptzustand nie', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'Hi there', usedChip: false, t: 2 });
    a.send({ type: 'ANALYSIS', idx: 1, slot: { state: 'failed' } });
    expect(st(a)).toBe('thinking');
    a.send({ type: 'REPLY', text: 'Ok', truncated: false, t: 3 });
    a.send({ type: 'ANALYSIS', idx: 1, slot: { state: 'failed' } });
    expect(st(a)).toBe('composing');
  });

  it('Beenden mit laufenden Analysen: warten, „Bericht jetzt“ überspringt sie', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'Hi there', usedChip: false, t: 2 });
    a.send({ type: 'REPLY', text: 'Ok', truncated: false, t: 3 });
    a.send({ type: 'ANALYSIS', idx: 1, slot: { state: 'pending' } });
    a.send({ type: 'END', t: 4 });
    expect(st(a)).toBe('ending');
    a.send({ type: 'REPORT_NOW' });
    expect(st(a)).toBe('finishing');
    expect(a.getSnapshot().context.analyses[1]).toEqual({ state: 'skipped' });
  });

  it('Beenden wartet, bis die letzte Analyse fertig ist', () => {
    const a = start();
    a.send({ type: 'SEND', text: 'Hi there', usedChip: false, t: 2 });
    a.send({ type: 'REPLY', text: 'Ok', truncated: false, t: 3 });
    a.send({ type: 'ANALYSIS', idx: 1, slot: { state: 'pending' } });
    a.send({ type: 'END', t: 4 });
    a.send({ type: 'ANALYSIS', idx: 1, slot: { state: 'done', data: view } });
    expect(st(a)).toBe('finishing');
  });

  it('Fortsetzen stellt Züge und Analysen wieder her', () => {
    const a = createActor(roleplayMachine, {
      input: { opening: 'x', startedAt: 1, resume: { turns: [{ role: 'persona', text: 'Hi', t: 1 }, { role: 'me', text: 'Hello there', t: 2 }], analyses: { 1: { state: 'done', data: view } }, taken: ['sign off on'] } },
    });
    a.start();
    expect(a.getSnapshot().context.turns).toHaveLength(2);
    expect(a.getSnapshot().context.taken).toEqual(['sign off on']);
  });
});

describe('AnalysisLane', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const p = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { p, resolve, reject };
  };
  const tick = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('höchstens eine aktiv, FIFO', async () => {
    const lane = new AnalysisLane();
    const started: number[] = [];
    const d = [deferred(), deferred(), deferred()];
    d.forEach((x, i) =>
      lane.enqueue(i, () => {
        started.push(i);
        return x.p;
      }),
    );
    expect(started).toEqual([0]);
    expect(lane.waiting).toEqual([1, 2]);
    d[0]!.resolve();
    await tick();
    expect(started).toEqual([0, 1]);
    d[1]!.resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);
  });

  it('ein Fehler blockiert die nächste Analyse nicht', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const lane = new AnalysisLane();
    const d = deferred();
    const second = vi.fn(() => Promise.resolve());
    lane.enqueue(0, () => d.p);
    lane.enqueue(1, second);
    d.reject(new Error('boom'));
    await tick();
    expect(second).toHaveBeenCalledOnce();
  });

  it('Abbruch beim Aushängen: laufende bekommt abort, wartende starten nie', async () => {
    const lane = new AnalysisLane();
    let signal: AbortSignal | null = null;
    const later = vi.fn(() => Promise.resolve());
    lane.enqueue(0, (s) => {
      signal = s;
      return new Promise<void>(() => undefined);
    });
    lane.enqueue(1, later);
    lane.close();
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    await tick();
    expect(later).not.toHaveBeenCalled();
    lane.enqueue(2, later);
    expect(later).not.toHaveBeenCalled();
  });
});
