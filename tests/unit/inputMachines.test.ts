import { describe, expect, it, vi } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { discoverMachine } from '../../src/features/discover/machine';
import { listenMachine } from '../../src/features/listen/machine';
import { readMachine } from '../../src/features/read/machine';
import { writeMachine } from '../../src/features/write/machine';
import type { ChoiceResult } from '../../src/domain/input/types';

// Die vier Abläufe (Plan §8.1 machines.test): Abschluss unabhängig von der KI (F6), Abbruch vor
// dem Abschluss → nichts geschrieben, erneuter Versuch schreibt genau einmal.

const r = (key: string, correct = true): ChoiceResult => ({ key, chosen: 0, correct, ms: 1000 });
const top = (s: { value: unknown }) => (typeof s.value === 'string' ? s.value : Object.keys(s.value as object)[0]);

describe('Lesen', () => {
  it('lesen → Fragen → Abschluss (ohne KI) → Zusammenfassung → fertig', async () => {
    const run = vi.fn((results: readonly ChoiceResult[]) => Promise.resolve(`r${results.length}`));
    const a = createActor(readMachine, { input: { total: 2, start: 'reading', run } }).start();
    expect(top(a.getSnapshot())).toBe('reading');
    a.send({ type: 'DONE_READING' });
    a.send({ type: 'NEXT' }); // vor einer Antwort ohne Wirkung
    expect(a.getSnapshot().context.i).toBe(0);
    a.send({ type: 'ANSWER', result: r('q0') });
    a.send({ type: 'NEXT' });
    a.send({ type: 'ANSWER', result: r('q1', false) });
    a.send({ type: 'NEXT' });
    await waitFor(a, (s) => s.matches('summary'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(a.getSnapshot().context.readingId).toBe('r2');
    a.send({ type: 'SKIP' });
    expect(a.getSnapshot().value).toBe('done');
  });

  it('ohne Fragen: „Fertig gelesen" schließt direkt ab; Verlassen vorher schreibt nichts', async () => {
    const run = vi.fn(() => Promise.resolve('r1'));
    const a = createActor(readMachine, { input: { total: 0, start: 'reading', run } }).start();
    a.send({ type: 'DONE_READING' });
    await waitFor(a, (s) => s.matches('summary'));
    expect(run).toHaveBeenCalledTimes(1);
    const run2 = vi.fn(() => Promise.resolve('r2'));
    const b = createActor(readMachine, { input: { total: 3, start: 'reading', run: run2 } }).start();
    b.send({ type: 'DONE_READING' });
    b.send({ type: 'ANSWER', result: r('q0') });
    b.stop();
    expect(run2).not.toHaveBeenCalled();
  });

  it('Fehler beim Speichern → erneut versuchen, dann weiter; heute Erledigtes startet als Zustand', async () => {
    let n = 0;
    const run = vi.fn(() => (++n === 1 ? Promise.reject(new Error('x')) : Promise.resolve('r9')));
    const a = createActor(readMachine, { input: { total: 0, start: 'reading', run } }).start();
    a.send({ type: 'DONE_READING' });
    await waitFor(a, (s) => s.matches('failed'));
    a.send({ type: 'RETRY' });
    await waitFor(a, (s) => s.matches('summary'));
    expect(run).toHaveBeenCalledTimes(2);
    expect(createActor(readMachine, { input: { total: 4, start: 'done', readingId: 'r1', run } }).start().getSnapshot().value).toBe('done');
  });
});

describe('Hören', () => {
  it('Fragen erst nach dem Hören; plays und help werden mitgegeben', async () => {
    const run = vi.fn(() => Promise.resolve(true));
    const a = createActor(listenMachine, { input: { total: 1, start: 'prep', run } }).start();
    a.send({ type: 'START' });
    a.send({ type: 'TO_QUESTIONS' });
    expect(top(a.getSnapshot())).toBe('listening');
    a.send({ type: 'PLAYED' });
    a.send({ type: 'HEARD' });
    a.send({ type: 'TO_QUESTIONS' });
    expect(top(a.getSnapshot())).toBe('questions');
    a.send({ type: 'ANSWER', result: r('q0') });
    a.send({ type: 'NEXT' });
    await waitFor(a, (s) => s.matches('transcript'));
    expect(run).toHaveBeenCalledWith({ results: [r('q0')], plays: 1, help: false });
  });

  it('ohne Ton oder übersprungen: Hilfe, trotzdem abschließbar; „nicht gespeichert" führt nicht zu doppeltem Abschluss', async () => {
    const run = vi.fn(() => Promise.resolve(false));
    const a = createActor(listenMachine, { input: { total: 1, start: 'prep', run } }).start();
    a.send({ type: 'NO_AUDIO' });
    expect(a.getSnapshot().context.textShown).toBe(true);
    a.send({ type: 'TO_QUESTIONS' });
    a.send({ type: 'ANSWER', result: r('q0') });
    a.send({ type: 'NEXT' });
    await waitFor(a, (s) => s.matches('transcript'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ help: true }));
    const b = createActor(listenMachine, { input: { total: 2, start: 'prep', run } }).start();
    b.send({ type: 'START' });
    b.send({ type: 'SKIP' });
    expect(b.getSnapshot().context.help).toBe(true);
    b.stop();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('Schreiben', () => {
  it('abgeben (erledigt), überarbeiten (rev + 1), Fehler beim Abgeben → zurück zum Entwurf', async () => {
    let fail = true;
    const submit = vi.fn(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve('w1')));
    const revise = vi.fn(() => Promise.resolve(1));
    const a = createActor(writeMachine, { input: { start: 'drafting', writingId: null, rev: 0, submit, revise } }).start();
    a.send({ type: 'SUBMIT', text: 'hello' });
    await waitFor(a, (s) => s.matches('drafting') && s.context.failed);
    fail = false;
    a.send({ type: 'SUBMIT', text: 'hello' });
    await waitFor(a, (s) => s.matches('submitted'));
    expect(a.getSnapshot().context.writingId).toBe('w1');
    a.send({ type: 'REVISE' });
    a.send({ type: 'RESUBMIT', text: 'hello again' });
    await waitFor(a, (s) => s.matches('submitted') && s.context.rev === 1);
    expect(revise).toHaveBeenCalledWith('w1', 'hello again');
  });

  it('heute schon abgegeben: startet als Zustand; Verlassen vor dem Abgeben schreibt nichts', () => {
    const submit = vi.fn(() => Promise.resolve('w'));
    const a = createActor(writeMachine, { input: { start: 'submitted', writingId: 'w7', rev: 2, submit, revise: vi.fn() } }).start();
    expect(a.getSnapshot().value).toBe('submitted');
    const b = createActor(writeMachine, { input: { start: 'drafting', writingId: null, rev: 0, submit, revise: vi.fn() } }).start();
    b.stop();
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('Entdecken', () => {
  it('Artikel: Schritte werden vermerkt, Prüfen mit Fragen, Anwenden schließt ab', async () => {
    const mark = vi.fn();
    const finish = vi.fn(() => Promise.resolve());
    const a = createActor(discoverMachine, { input: { steps: ['prep', 'take', 'check', 'use'], startAt: 'prep', total: 1, mark, finish } }).start();
    a.send({ type: 'NEXT' });
    a.send({ type: 'NEXT' });
    expect(top(a.getSnapshot())).toBe('check');
    a.send({ type: 'ANSWER', result: r('q0') });
    a.send({ type: 'NEXT' });
    expect(a.getSnapshot().value).toBe('use');
    expect(mark.mock.calls.map((c) => String(c[0]))).toEqual(['prep', 'take', 'check']);
    a.send({ type: 'SUBMIT', text: 'mein Text' });
    await waitFor(a, (s) => s.matches('done'));
    expect(finish).toHaveBeenCalledWith('mein Text', [r('q0')]);
  });

  it('Video: ohne Prüfen; Wiedereinstieg; Verlassen vor dem Abgeben schließt nichts ab', () => {
    const mark = vi.fn();
    const finish = vi.fn(() => Promise.resolve());
    const a = createActor(discoverMachine, { input: { steps: ['prep', 'take', 'use'], startAt: 'take', total: 0, mark, finish } }).start();
    expect(a.getSnapshot().value).toBe('take');
    a.send({ type: 'NEXT' });
    expect(a.getSnapshot().value).toBe('use');
    a.stop();
    expect(finish).not.toHaveBeenCalled();
    expect(createActor(discoverMachine, { input: { steps: ['prep', 'take', 'use'], startAt: 'done', total: 0, mark, finish } }).start().getSnapshot().value).toBe('done');
  });
});
