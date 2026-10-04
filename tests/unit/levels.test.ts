import { describe, expect, it } from 'vitest';
import { applyAttempt, attemptScore, levelsPatch, readEntry, roundLevel, START_LEVEL, type LevelEntry } from '../../src/domain/levels/levels';
import { objections } from '../../src/content/nb/load';
import { answerScore } from '../../src/features/pressure/session';
import { choiceOptions, MOVES, orderPool, starterOf, starterPrefill, structuredPart } from '../../src/domain/nbdrill/pressure';

// Lernpfad (docs/lernpfad-plan.md): Stufe folgt dem Erfolg, Hilfe deckelt, nie mehr als eine Stufe je Lerntag.

const entry = (l: LevelEntry['l'], w: number[] = [], ch = ''): LevelEntry => ({ l, w, n: w.length, ch });
const run = (e: LevelEntry, scores: number[], day = '2026-10-03'): LevelEntry => scores.reduce((x, s) => applyAttempt(x, s, day), e);

describe('Lernpfad-Stufen', () => {
  it('Wert eines Versuchs: Hilfe deckelt (1 / 0,6 / 0,3), Teilerfolge bleiben, Unsinn wird 0', () => {
    expect(attemptScore(1)).toBe(1);
    expect(attemptScore(1, 1)).toBe(0.6);
    expect(attemptScore(1, 2)).toBe(0.3);
    expect(attemptScore(0.5, 1)).toBe(0.5);
    expect(attemptScore(Number.NaN)).toBe(0);
    expect(attemptScore(3)).toBe(1);
  });

  it('fehlendes oder kaputtes Dokument: Startstufe (Einwände 2)', () => {
    expect(readEntry(undefined, 'nb-objection').l).toBe(START_LEVEL['nb-objection']);
    expect(readEntry({ k: { 'nb-objection': { l: 'x', w: 'y' } } }, 'nb-objection')).toEqual({ l: 2, w: [], n: 0, ch: '' });
    expect(readEntry({ k: { 'nb-objection': { l: 9 } } }, 'nb-objection').l).toBe(5);
  });

  it('Aufstieg erst nach 6 guten Versuchen, dann Fenster leer und Wechseltag gesetzt', () => {
    expect(run(entry(2), [1, 1, 1, 1, 1]).l).toBe(2);
    const up = run(entry(2), [1, 1, 1, 1, 1, 1]);
    expect(up).toEqual({ l: 3, w: [], n: 0, ch: '2026-10-03' });
  });

  it('höchstens eine Stufe je Lerntag', () => {
    const up = run(entry(2), [1, 1, 1, 1, 1, 1]);
    expect(run(up, [1, 1, 1, 1, 1, 1]).l).toBe(3);
    expect(run(up, [1, 1, 1, 1, 1, 1], '2026-10-04').l).toBe(4);
  });

  it('kein Aufstieg, wenn die letzten zwei schwach waren', () => {
    expect(run(entry(2), [1, 1, 1, 1, 1, 0.5]).l).toBe(2);
  });

  it('Abstieg: drei Fehlschläge in Folge oder Mittel der letzten 5 unter 0,6', () => {
    expect(run(entry(3), [0, 0, 0]).l).toBe(2);
    expect(run(entry(3), [0.5, 0.5, 0.5, 0.5, 0.5]).l).toBe(2);
    expect(run(entry(1), [0, 0, 0, 0, 0]).l).toBe(1);
  });

  it('in der Runde: nach zwei schwachen Antworten eine Stufe leichter, nie unter 1', () => {
    expect(roundLevel(4, [1, 0.2, 0.4])).toBe(3);
    expect(roundLevel(4, [0.2, 1])).toBe(4);
    expect(roundLevel(1, [0, 0])).toBe(1);
  });

  it('Patch ersetzt nur den eigenen Eintrag, andere Arten bleiben', () => {
    const cur = { v: 1, k: { other: { l: 4 } } };
    const p = levelsPatch(cur, 'nb-objection', [1], '2026-10-03');
    expect(p).toEqual({ k: { other: { l: 4 }, 'nb-objection': { l: 2, w: [1], n: 1, ch: '' } } });
    expect(levelsPatch(undefined, 'nb-objection', [1], '2026-10-03').v).toBe(1);
  });
});

describe('Einwände: Hilfen der Stufen 1–4', () => {
  const all = objections();

  it('Stufe 1: Sätze nie in Musterreihenfolge, alle vier dabei, gleiche Mischung bei jedem Zeichnen', () => {
    for (const o of all) {
      const pool = orderPool(o);
      expect(pool.map((x) => x.move).sort()).toEqual([...MOVES].sort());
      expect(pool.map((x) => x.move)).not.toEqual([...MOVES]);
      expect(orderPool(o)).toEqual(pool);
    }
  });

  it('Stufe 2: je Schritt genau eine richtige von drei Optionen, alle verschieden', () => {
    for (const o of all) {
      for (const m of MOVES) {
        const opts = choiceOptions(o, all, m);
        expect(opts).toHaveLength(3);
        expect(opts.filter((x) => x.ok)).toEqual([{ text: o.model[m], ok: true }]);
        expect(new Set(opts.map((x) => x.text)).size).toBe(3);
      }
    }
  });

  it('Zuordnung: Anteil richtiger Plätze', () => {
    expect(structuredPart(['acknowledge', 'ask', 'answer', 'secure'])).toBe(1);
    expect(structuredPart(['ask', 'acknowledge', 'answer', null])).toBe(0.25);
  });

  it('Satzanfänge: höchstens 4 Wörter bis zum ersten Komma, zum Weiterschreiben ohne „…“', () => {
    expect(starterOf('I appreciate you being open about that, and I understand why.')).toBe('I appreciate you being …');
    expect(starterOf('Of course, I am happy to help.')).toBe('Of course …');
    expect(starterPrefill('Of course, I am happy to help.')).toBe('Of course ');
  });
});

describe('Einwände: welche Antworten die Stufe steuern', () => {
  const base = { id: 'o01', text: 'x', ms: 0, moves: null, by: null } as const;
  const all = { acknowledge: true, ask: true, answer: true, secure: true };

  it('nicht gewertet (übersprungen, KI läuft noch, Fehler ohne Selbstcheck) zählt nicht', () => {
    expect(answerScore(undefined)).toBeNull();
    expect(answerScore({ ...base })).toBeNull();
  });

  it('KI-Wertung voll, Selbstcheck höchstens 0,6 (nur für den Abstieg), Hilfe deckelt', () => {
    expect(answerScore({ ...base, moves: all, by: 'ai' })).toBe(1);
    expect(answerScore({ ...base, moves: all, by: 'self' })).toBe(0.6);
    expect(answerScore({ ...base, moves: all, by: 'ai', hint: 1 })).toBe(0.6);
    expect(answerScore({ ...base, text: '', part: 0.75 })).toBe(0.75);
  });
});
