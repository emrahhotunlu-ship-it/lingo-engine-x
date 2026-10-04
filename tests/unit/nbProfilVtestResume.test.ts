import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { restoredVtest, vtestMachine, vtestSnapOf, type VtestInput } from '../../src/features/vtest/machine';
import { takePendingVtest, useVtestSession, vtestResume } from '../../src/features/vtest/session';

// G3 (plan.md §4.0): Momentaufnahme → Herstellen → gleiche Position; Herstellen schreibt nie.

const input = (saves: unknown[] = []): VtestInput => ({ seed: '2026-09-20', lang: 'de', day: '2026-09-20', now: () => 1_000, save: (r) => { saves.push(r); return Promise.resolve(); } });

describe('Wortschatztest fortsetzbar', () => {
  it('Ja/Nein-Teil: gleiche Position, gleiches Wort, gleiche Antworten', () => {
    const a = createActor(vtestMachine, { input: input() }).start();
    a.send({ type: 'START' });
    for (let k = 0; k < 7; k++) a.send({ type: k % 2 ? 'NO' : 'YES' });
    const snap = vtestSnapOf(String(a.getSnapshot().value), a.getSnapshot().context);
    expect(snap).toMatchObject({ state: 'yesno', i: 7 });
    const raw = JSON.parse(JSON.stringify(snap)) as unknown;
    expect(vtestResume.restore(raw as never)).toBe(true);
    const pending = takePendingVtest();
    expect(pending).not.toBeNull();
    const saves: unknown[] = [];
    const b = createActor(vtestMachine, { input: input(saves), snapshot: restoredVtest(pending!, input(saves))! }).start();
    const s = b.getSnapshot();
    expect(s.value).toBe('yesno');
    expect(s.context.i).toBe(7);
    expect(s.context.yesno[7]?.w).toBe(a.getSnapshot().context.yesno[7]?.w);
    expect([...s.context.yes].sort()).toEqual([...a.getSnapshot().context.yes].sort());
    expect(saves).toEqual([]);
    b.send({ type: 'YES' });
    expect(b.getSnapshot().context.i).toBe(8);
  });

  it('Bedeutungsteil mit gegebener Antwort wird mit Antwort hergestellt; Unsinn wird verworfen', () => {
    const a = createActor(vtestMachine, { input: input() }).start();
    a.send({ type: 'START' });
    for (let k = 0; k < a.getSnapshot().context.yesno.length; k++) a.send({ type: 'YES' });
    expect(a.getSnapshot().value).toBe('meaning');
    const opt = a.getSnapshot().context.meaning[0]!.options[0]!;
    a.send({ type: 'CHOOSE', id: opt.id });
    const snap = vtestSnapOf('meaning', a.getSnapshot().context)!;
    const b = restoredVtest(snap, input())!;
    expect(b.context.meaning[0]?.w).toBe(a.getSnapshot().context.meaning[0]?.w);
    expect(b.context.answered).toEqual(a.getSnapshot().context.answered);
    expect(restoredVtest({ ...snap, i: 999 }, input())).toBeNull();
    expect(vtestResume.restore({ v: 2 } as never)).toBe(false);
    expect(vtestSnapOf('intro', a.getSnapshot().context)).toBeNull();
    useVtestSession.setState({ snap: null });
  });
});
