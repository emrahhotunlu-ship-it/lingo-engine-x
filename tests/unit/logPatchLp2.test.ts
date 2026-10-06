import { describe, expect, it } from 'vitest';
import { drillLogEntry, grammarLogEntry, logEntry, mergeLogEntries, unitSecondsPatch, UM_MAX_SEC } from '../../src/domain/progress/logPatch';
import type { AnswerEvent } from '../../src/domain/srs/types';
import type { DrillAnswer, GrammarAnswer } from '../../src/domain/learn/types';

// Lernplattform 2.0 §8 (P4): `dev` (Eingabeprofil der Antwort) und `um` (Sekunden je Pflichtschritt) im Tagesprotokoll – nur wenn vorhanden.

const base = { t: 1, lang: 'de', ms: 1500, ctx: 'rev' } as const;

describe('Protokoll: dev', () => {
  it('Vokabel und Wendung tragen dev nur, wenn es gesetzt ist', () => {
    const v = { ...base, kind: 'vocab', id: 'w1', ex: 'cloze', grade: 3, given: 'a', ans: 'a' } as unknown as AnswerEvent;
    expect(logEntry(v)).not.toHaveProperty('dev');
    expect(logEntry({ ...v, dev: 't' })).toMatchObject({ dev: 't', k: 'v' });
    const c = { ...base, kind: 'chunk', id: 'c1', ex: 'cloze', grade: 2, given: 'a', ans: 'a', q: 'q' } as unknown as AnswerEvent;
    expect(logEntry(c)).not.toHaveProperty('dev');
    expect(logEntry({ ...c, dev: 'k' })).toMatchObject({ dev: 'k', type: 'chunk' });
  });

  it('Grammatik und Übungen tragen dev nur, wenn es gesetzt ist', () => {
    const task = { key: 'k', topic: 'passive', type: 'gap', prompt: 'p', answer: 'a', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null };
    const g = { t: 1, lang: 'de', grade: 3, given: 'a', ms: 10, ctx: 'duty', verdict: 'correct', task } as unknown as GrammarAnswer;
    expect(grammarLogEntry(g)).not.toHaveProperty('dev');
    expect(grammarLogEntry({ ...g, dev: 't' })).toMatchObject({ dev: 't', k: 'g' });
    const d = { t: 1, lang: 'de', type: 'order', q: 'q', given: 'g', ans: 'a', grade: 3, ms: 10, ctx: 'xtra', verdict: 'correct' } as unknown as DrillAnswer;
    expect(drillLogEntry(d)).not.toHaveProperty('dev');
    expect(drillLogEntry({ ...d, dev: 'k' })).toMatchObject({ dev: 'k' });
  });

  it('das Zusammenführen behält dev', () => {
    const e = logEntry({ ...base, kind: 'vocab', id: 'w1', ex: 'cloze', grade: 3, given: 'a', ans: 'a', dev: 't' } as unknown as AnswerEvent);
    expect(mergeLogEntries([], [e])).toEqual([e]);
  });
});

describe('Protokoll: um', () => {
  it('schreibt Sekunden und Gerät eines fertigen Schritts, einmal je Schritt', () => {
    expect(unitSecondsPatch(undefined, { block: 1, s: 481.4, dev: 'k' })).toEqual({ um: { 1: { s: 481, dev: 'k' } } });
    expect(unitSecondsPatch({ 1: { s: 400, dev: 'k' } }, { block: 1, s: 999, dev: 't' })).toBeNull();
    expect(unitSecondsPatch({ 1: { s: 400, dev: 'k' } }, { block: 2, s: 300, dev: 't' })).toEqual({ um: { 2: { s: 300, dev: 't' } } });
  });

  it('ohne Gerät, mit ungültigem Block oder ungültiger Zeit wird nichts geschrieben', () => {
    expect(unitSecondsPatch({}, { block: 1, s: 10, dev: undefined })).toBeNull();
    expect(unitSecondsPatch({}, { block: 4, s: 10, dev: 't' })).toBeNull();
    expect(unitSecondsPatch({}, { block: 1, s: -1, dev: 't' })).toBeNull();
    expect(unitSecondsPatch({}, { block: 1, s: Number.NaN, dev: 't' })).toBeNull();
  });

  it('begrenzt die Sekunden', () => {
    expect(unitSecondsPatch({}, { block: 5, s: 99_999, dev: 't' })).toEqual({ um: { 5: { s: UM_MAX_SEC, dev: 't' } } });
  });
});
