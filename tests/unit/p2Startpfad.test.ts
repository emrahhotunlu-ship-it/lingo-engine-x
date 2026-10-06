import { describe, expect, it, vi } from 'vitest';
import type * as Dict from '../../src/domain/lexicon/dict';

// P2, N45 und Anhang A 5a/5c (leistung.md §3.2 Nr. 3): `dueErrors` zählt ohne Wörterbuch; die
// Grammatik-Inhalte werden erst beim ersten Gebrauch geparst.

const dictCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../src/domain/lexicon/dict', async (orig) => {
  const real = await orig<typeof Dict>();
  return {
    ...real,
    isDictWord: (w: string) => {
      dictCalls.n++;
      return real.isDictWord(w);
    },
  };
});

const { dueErrors, errorTask } = await import('../../src/domain/grammar/errors');
const raw = await import('../../src/domain/grammar/raw');

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-28T10:00:00Z');

function docs(): Map<string, Record<string, unknown>> {
  return new Map([
    [
      'future-forms',
      {
        errors: [
          { q: 'By June, I ___ my course.', given: 'finish', ans: 'will have finished', t: NOW - 3 * DAY, src: 'duty' },
          { q: 'She ___ (work) here since May.', given: 'works', ans: 'has worked', t: NOW - 2 * DAY, src: 'duty' },
        ],
      },
    ],
  ]);
}

describe('Startpfad ohne Wörterbuch und ohne JSON-Parsen', () => {
  it('Regelwerk, Startaufgaben und C1-Werkzeugkasten sind beim Import noch nicht geparst (steht vor den Tests, die die Erklärung lesen)', async () => {
    // Die Themenlisten (domain/content) laden, ohne die großen Inhalte zu parsen.
    await import('../../src/domain/content');
    expect(raw.parsedYet()).toEqual({ rules: false, grammar: false, toolkit: false });
    const { ruleOf } = await import('../../src/domain/grammar/rules');
    expect(ruleOf('past-perfect', 'de')?.core ?? '').not.toBe('');
    expect(raw.parsedYet().rules).toBe(true);
  });

  it('dueErrors zählt fällige Fehler, ohne das Wörterbuch zu fragen', () => {
    dictCalls.n = 0;
    const due = dueErrors(docs(), NOW);
    expect(due).toHaveLength(2);
    expect(dictCalls.n).toBe(0);
  });

  it('der Hinweis (Grundform) entsteht erst beim Lesen – und bleibt dann stehen', () => {
    dictCalls.n = 0;
    const [first] = dueErrors(docs(), NOW);
    expect(dictCalls.n).toBe(0);
    expect(first?.task.hint).toBe('(finish)');
    const n = dictCalls.n;
    expect(n).toBeGreaterThan(0);
    expect(first?.task.hint).toBe('(finish)');
    expect(dictCalls.n).toBe(n);
    // Kopien (Runde einfrieren, Fortsetzen) tragen den Wert mit.
    expect({ ...first!.task }.hint).toBe('(finish)');
    expect((JSON.parse(JSON.stringify(first!.task)) as { hint: unknown }).hint).toBe('(finish)');
  });

  it('eine Lücke mit Klammer-Hinweis bekommt keinen zusätzlichen Hinweis', () => {
    const task = errorTask('future-forms', { q: 'She ___ (work) here since May.', given: 'works', ans: 'has worked', t: NOW });
    expect(task?.hint).toBeNull();
  });
});
