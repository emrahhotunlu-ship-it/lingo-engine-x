import { describe, expect, it } from 'vitest';
import { addFlag, FLAGS_MAX, type TaskFlag } from '../../src/features/tutor/flagLog';
import { validateDoc } from '../../src/data/validate';

const f = (id: string, over: Partial<TaskFlag> = {}): TaskFlag => ({ t: 1, id, topic: 'passive', q: 'The report ___ sent.', given: 'are', ans: 'is', r: 'solution', ...over });

describe('Großpaket G6: „Aufgabe war unfair“ im Tagesprotokoll (flags)', () => {
  it('hängt an, doppelte Meldung ändert nichts, Grenze je Tag', () => {
    const one = addFlag(undefined, f('gr:a'))!;
    expect(one).toHaveLength(1);
    expect(addFlag(one, f('gr:a'))).toBeNull();
    const full = Array.from({ length: FLAGS_MAX }, (_, i) => f(`gr:${i}`));
    expect(addFlag(full, f('gr:new'))).toBeNull();
  });

  it('kürzt lange Texte und bleibt im gültigen Tagesprotokoll, ohne die Einträge zu berühren', () => {
    const long = 'x'.repeat(900);
    const list = addFlag([], f('gr:b', { q: long, given: long, c: true }))!;
    expect(list[0]!.q.length).toBe(300);
    expect(list[0]!.c).toBe(true);
    const doc = { date: '2026-11-03', entries: [{ t: 1, ok: true, k: 'g', topic: 'passive' }], flags: list };
    expect(validateDoc('log/2026-11-03', doc).ok).toBe(true);
    // Ein kaputtes `flags` macht das Dokument ungültig – dann schreibt `recordFlag` nie hinein.
    expect(validateDoc('log/2026-11-03', { ...doc, flags: 'x' }).ok).toBe(false);
  });
});
