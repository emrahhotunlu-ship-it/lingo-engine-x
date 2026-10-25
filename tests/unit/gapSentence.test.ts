import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import { findContext } from '../../src/domain/srs/context';
import { buildExercise, meaningTwins } from '../../src/domain/srs/exercise';
import { bracketExample } from '../../src/domain/srs/newCard';
import { checkExercise, guardedExercise } from '../../src/domain/srs/guard';
import { GAP_SENTENCE_MAX_WORDS, gapSentence, gapSentenceIssues, isCleanGapSentence, sentencePieces } from '../../src/domain/srs/gapSentence';
import { makeEnv, supports } from '../../src/domain/srs/modes';
import { gapContext, gapContextsOf } from '../../src/domain/srs/rotate';
import type { ContextSpan, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Emrahs Meldung 25.10.2026 (live v83, „Auch ne blöde Aufgabe“): Abruf 2 zeigte einen langen, links und rechts mit „…“ abgeschnittenen Auszug,
// die Lücke stand im abgeschnittenen Satzanfang. Regel: EIN vollständiger Satz ≤ 22 Wörter, sonst ein anderer Satz der Karte oder eine Aufgabe ohne Satz.

const SCOUTS = '…technique and [attitude]. Their recommendations were based on experience and, to a large extent, on gut feeling. Some scouts were brilliant at this, but the system had obvious…';
const NOW = berlin('2026-10-25', 9);
type Doc = Record<string, unknown>;
const doc = (over: Doc = {}): Doc => ({ id: 'att', word: 'attitude', pos: 'noun', de: 'Einstellung', def: 'the way you think and feel about something', ex: SCOUTS, col: [], level: 'B2', state: 'learning', S: 0.5, D: 5, last: NOW - 3_600_000, due: NOW - 1000, reps: 1, lapses: 0, modes: {}, order: 900, src: 'read', added: '2026-10-25', stage: 1, hist: [], intro: '2026-10-25', ...over });
const card = (over: Doc = {}, stage = 1): TrainCard => ({ ...(toTrainCard(typeof over.id === 'string' ? over.id : 'att', doc(over), true, NOW) as TrainCard), stage: stage as TrainCard['stage'] });
const fill = (n = 6): TrainCard[] => Array.from({ length: n }, (_, i) => card({ id: `p${i}`, word: `padword${i}`, de: `Füllwort ${i}`, def: `filler meaning number ${i}`, ex: `A [padword${i}] is here.` }));
const KEYS = makeEnv(false, false, false);
const span = (s: string, w: string): ContextSpan => findContext(s, w) as ContextSpan;

describe('sentencePieces: Sätze eines Auszugs mit Lage', () => {
  it('trennt an . ! ? vor einem Satzanfang, markiert abgeschnittene Ränder', () => {
    const p = sentencePieces('…technique and attitude. Their ideas were good! Did it work? The system had obvious…');
    expect(p.map((x) => x.text)).toEqual(['technique and attitude.', 'Their ideas were good!', 'Did it work?', 'The system had obvious']);
    expect(p[0]!.cutStart).toBe(true);
    expect(p[3]!.cutEnd).toBe(true);
    expect(p[1]!.cutStart || p[1]!.cutEnd).toBe(false);
  });
  it('Abkürzungen und Zahlen trennen nicht', () => {
    expect(sentencePieces('Mr. Smith met U.S. Steel in 2.5 hours. Then he left.').map((x) => x.text)).toEqual(['Mr. Smith met U.S. Steel in 2.5 hours.', 'Then he left.']);
  });
  it('drei Punkte gelten wie „…“', () => {
    const p = sentencePieces('...so we changed our approach. It worked...');
    expect(p[0]!.cutStart).toBe(true);
    expect(p[1]!.cutEnd).toBe(true);
  });
});

describe('gapSentence: der eine Satz der Lücke', () => {
  it('Emrahs Beispiel: Lücke im abgeschnittenen Satzanfang → kein Lückensatz', () => {
    const c = span(SCOUTS, 'attitude');
    expect(c.gap).toBe('attitude');
    expect(gapSentenceIssues(c)).toEqual(expect.arrayContaining(['multi', 'cut_start']));
    expect(gapSentence(c)).toBeNull();
  });
  it('Lücke in einem vollständigen Satz eines Auszugs → genau dieser Satz, Lage neu berechnet', () => {
    const c = span('…the old way. Their [attitude] to risk changed after the merger. Some scouts were…', 'attitude');
    const g = gapSentence(c) as ContextSpan;
    expect(g.sentence).toBe('Their attitude to risk changed after the merger.');
    expect(g.sentence.slice(g.start, g.end)).toBe('attitude');
    expect(isCleanGapSentence(g)).toBe(true);
  });
  it('ein sauberer Satz kommt unverändert zurück (dasselbe Objekt)', () => {
    const c = span('Her [attitude] to work is excellent.', 'attitude');
    expect(gapSentence(c)).toBe(c);
  });
  it(`mehr als ${GAP_SENTENCE_MAX_WORDS} Wörter → kein Lückensatz`, () => {
    const long = `Her [attitude] ${Array.from({ length: GAP_SENTENCE_MAX_WORDS }, (_, i) => `w${i}`).join(' ')}.`;
    expect(gapSentenceIssues(span(long, 'attitude'))).toContain('too_long');
    expect(gapSentence(span(long, 'attitude'))).toBeNull();
    const ok = `Her [attitude] ${Array.from({ length: GAP_SENTENCE_MAX_WORDS - 2 }, (_, i) => `w${i}`).join(' ')}.`;
    expect(gapSentence(span(ok, 'attitude'))).not.toBeNull();
  });
  it('„…“ mitten im Satz → unvollständig', () => {
    expect(gapSentenceIssues(span('Her [attitude] … changed a lot.', 'attitude'))).toContain('ellipsis_inside');
  });
  it('kurzer vollständiger Mini-Kontext (Bindewort braucht den Satz davor) bleibt ganz; ist er zu lang, nur der Satz der Lücke', () => {
    const c = span('The license fee is higher. [That said], the total cost over three years is lower.', 'that said');
    expect(gapSentence(c)).toBe(c);
    expect(isCleanGapSentence(c)).toBe(true);
    const long = span(`The license fee is much higher than the old one we had in ${Array.from({ length: 8 }, (_, i) => `w${i}`).join(' ')}. Their [attitude] changed.`, 'attitude');
    expect(gapSentence(long)?.sentence).toBe('Their attitude changed.');
    expect(isCleanGapSentence(long)).toBe(false);
  });
  it('deterministisch: dieselbe Eingabe, derselbe Satz', () => {
    const c = span('…the old way. Their [attitude] to risk changed. Some scouts were…', 'attitude');
    expect(gapSentence(c)).toEqual(gapSentence({ ...c }));
  });
});

describe('Ursprungssatz beim Speichern aus einem Absatz (bracketExample)', () => {
  it('nur der vollständige Satz des Worts wird gespeichert, kein abgeschnittener Auszug', () => {
    const para = 'When people imagine a successful software company, they often picture a sales team celebrating a big new deal. The reason is simple economics. Winning a new customer is expensive.';
    expect(bracketExample(para, 'economics', 'economics')).toBe('The reason is simple [economics].');
  });
  it('ein einzelner Satz bleibt unverändert', () => {
    expect(bracketExample('Her attitude to work is excellent.', 'attitude', 'attitude')).toBe('Her [attitude] to work is excellent.');
  });
});

describe('Bedeutungs-Zwillinge (meaningTwins)', () => {
  const tc = (id: string, word: string, de: string, pos = 'verb'): TrainCard => card({ id, word, de, pos, ex: `We [${word.replace(/^to /, '')}] it.` });
  it('gleiche deutsche Hauptbedeutung und Wortart → Zwilling; anders → nicht', () => {
    const a = tc('pp', 'to postpone', 'verschieben');
    const pool = [a, tc('po', 'to put off', 'verschieben, aufschieben'), tc('dl', 'to delay', 'verzögern, verschieben'), tc('sh', 'to shift', 'verschieben', 'noun')];
    expect(meaningTwins(a, pool)).toEqual(['put off']);
  });
  it('kein Zwilling ohne Bedeutung', () => {
    expect(meaningTwins(tc('x', 'to x', ''), [tc('y', 'to y', '')])).toEqual([]);
  });
});

describe('Satzwahl der Lückenaufgabe (rotate.gapContext)', () => {
  it('ohne sauberen Satz: keine Lücke, stattdessen Deutsch → Englisch tippen', () => {
    const c = card();
    expect(gapContextsOf(c)).toEqual([]);
    expect(gapContext(c, '2026-10-25', true)).toBeNull();
    for (const ex of ['cloze', 'cloze_hint', 'wordfam', 'dictation'] as const) expect(supports(c, ex, 'de', 8, makeEnv(true, true, false))).toBe(false);
    expect(supports(c, 'type', 'de', 8, KEYS)).toBe(true);
    const e = guardedExercise(c, 'cloze', 'de', [c, ...fill()], '2026-10-25|0', {}, KEYS);
    expect(e.sentence === null || isCleanGapSentence(e.sentence)).toBe(true);
  });
  it('abgeschnittener Ursprungssatz, aber ein anderer Satz der Karte: der andere Satz (auch an Tag 0 und als Anker)', () => {
    const c = card({ xEx: [{ en: 'A positive attitude helps in difficult negotiations.', t: 1 }] });
    const g = gapContext(c, '2026-10-25', true) as ContextSpan;
    expect(g.sentence).toBe('A positive attitude helps in difficult negotiations.');
    expect(supports(c, 'cloze', 'de', 8, KEYS)).toBe(true);
    const e = buildExercise(c, 'cloze', 'de', [c, ...fill()], '2026-10-25|1');
    expect(e.sentence?.sentence).toBe('A positive attitude helps in difficult negotiations.');
    expect(e.meaning).toBe('Einstellung');
    expect(checkExercise(e, c, 'de')).toEqual([]);
  });
  it('Ursprungssatz aus einem Auszug mit vollständigem Satz der Lücke: dieser Satz ist der Anker an Tag 0', () => {
    const c = card({ ex: '…the old way. Their [attitude] to risk changed after the merger. Some scouts were…', xEx: [{ en: 'A positive attitude helps in difficult negotiations.', t: 1 }] });
    expect(gapContext(c, '2026-10-25')?.sentence).toBe('Their attitude to risk changed after the merger.');
    expect(gapContext(c, '2026-10-25', true)?.sentence).toBe('Their attitude to risk changed after the merger.');
  });
  it('der Wächter weist einen abgeschnittenen oder zu langen Lückensatz ab (R7) und eine Lücke ohne Satz (R2)', () => {
    const c = card({ ex: 'Her [attitude] to work is excellent.' });
    const e = buildExercise(c, 'cloze', 'de', [c, ...fill()], '2026-10-25|0');
    expect(checkExercise(e, c, 'de')).toEqual([]);
    const bad = { ...e, sentence: span(SCOUTS, 'attitude') };
    expect(checkExercise(bad, c, 'de').map((v) => v.rule)).toContain('R7');
    expect(checkExercise({ ...e, sentence: null }, c, 'de').map((v) => v.rule)).toContain('R2');
  });
});
