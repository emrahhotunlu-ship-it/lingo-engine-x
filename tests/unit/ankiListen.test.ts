import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { cardPatch, levelFor } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { readDecks } from '../../src/domain/srs/decks';
import { pickMode } from '../../src/domain/srs/flip';
import { listenExercise, loopItems, LOOP_SIZE } from '../../src/domain/srs/listen';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import { repeatPauseMs } from '../../src/features/vocab/listen/ListenLoop';
import { berlin } from './helpers';

// N35 Hör-Modus (Aa „Hören“) und Hörschleife: Auswahl der Abfrage, Stufenregel der Hör-Lücke,
// Auswahl der Sätze. Die Hörschleife schreibt nichts (siehe ListenLoop – kein Schreibaufruf).

type Doc = Record<string, unknown>;
const NOW = berlin('2026-09-28', 10);
const DAY = dayKey(NOW);
const D = 86_400_000;
const TTS = { tts: true, ai: false };
const doc = (i: number, over: Doc = {}): Doc => ({ word: `word${i}`, de: `Wort ${i}`, ex: `We say [word${i}] every day.`, pos: 'noun', state: 'review', stage: 2, S: 3, D: 5, due: NOW - D, last: NOW - 5 * D, reps: 3, lapses: 0, src: 'lookup', ...over });
const card = (i: number, over: Doc = {}): TrainCard => toTrainCard(`word${i}`, doc(i, over), true, NOW) as TrainCard;
const answer = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: DAY, kind: 'v', id: 'word1', ex: 'dictation', grade: 3, given: 'word1', ans: 'word1', ms: 2500, lang: 'de', ctx: 'xtra', ...over });

describe('Hör-Modus: Abfrage', () => {
  it('mit Satz und Sprachausgabe: Hör-Lücke (dictation) – auf jeder Stufe', () => {
    for (const stage of [1, 2, 3, 4, 5]) expect(listenExercise(card(1, { stage }), 'de', 10, TTS)).toBe('dictation');
  });
  it('ohne Satz: junge Karten nach Gehör auswählen, gefestigte über die Leiter', () => {
    expect(listenExercise(card(1, { ex: undefined, stage: 1 }), 'de', 10, TTS)).toBe('listen_mc');
    expect(listenExercise(card(1, { ex: undefined, stage: 4 }), 'de', 10, TTS)).toBeNull();
  });
  it('ohne Sprachausgabe: gewöhnliche Leiter', () => {
    expect(listenExercise(card(1), 'de', 10, { tts: false, ai: false })).toBeNull();
  });
  it('pickMode: Hören fragt nie per Aufdecken', () => {
    expect(pickMode({ card: card(1, { stage: 1 }), requested: 'listen', day: DAY, lang: 'de', due: true })).toBe('type');
  });
  it('Stapel merken „listen“', () => {
    expect(readDecks({ v: 1, builtin: { hard: { mode: 'listen' } } }).builtin.hard?.mode).toBe('listen');
  });
});

describe('Hör-Lücke: Stufe höchstens +1', () => {
  it('levelFor: Hör-Lücke zählt höchstens eine Stufe über der eigenen, andere Arten unverändert', () => {
    expect(levelFor('dictation', 1)).toBe(2);
    expect(levelFor('dictation', 3)).toBe(4);
    expect(levelFor('dictation', 4)).toBe(5);
    expect(levelFor('dictation', 5)).toBe(5);
    expect(levelFor('type', 1)).toBe(4);
  });
  it('junge Karte: richtig → +1, Leicht → +2, falsch → bleibt', () => {
    expect(cardPatch(doc(1, { stage: 1 }), answer({ grade: 3 })).stage).toBe(2);
    expect(cardPatch(doc(1, { stage: 1 }), answer({ grade: 4 })).stage).toBe(3);
    expect(cardPatch(doc(1, { stage: 3 }), answer({ grade: 1, given: 'x' })).stage).toBe(3);
  });
  it('Leiter auf Stufe 4–5 unverändert (4 → 5, 5 falsch → 4)', () => {
    expect(cardPatch(doc(1, { stage: 4 }), answer({ grade: 3 })).stage).toBe(5);
    expect(cardPatch(doc(1, { stage: 5 }), answer({ grade: 1, given: 'x' })).stage).toBe(4);
  });
});

describe('Hörschleife: Sätze', () => {
  it('höchstens 10, fällige zuerst (früheste zuerst), ohne neue, ausgeblendete und satzlose Karten', () => {
    const cards = [
      ...Array.from({ length: 12 }, (_, i) => card(i, { due: NOW + (i + 1) * D, stage: (i % 5) + 1 })),
      card(20, { due: NOW - 3 * D }),
      card(21, { due: NOW - 1 * D }),
      card(22, { state: 'new', reps: 0, stage: undefined, S: undefined, D: undefined, due: undefined, last: undefined }),
      card(23, { hidden: true, due: NOW - 9 * D }),
      card(24, { ex: undefined, due: NOW - 9 * D }),
    ];
    const items = loopItems(cards, NOW);
    expect(items).toHaveLength(LOOP_SIZE);
    expect(items.slice(0, 2).map((x) => x.key)).toEqual(['vocab/word20', 'vocab/word21']);
    const keys = items.map((x) => x.key);
    for (const k of ['vocab/word22', 'vocab/word23', 'vocab/word24']) expect(keys).not.toContain(k);
    expect(items.every((x) => x.sentence.length > 0 && !x.sentence.includes('['))).toBe(true);
  });
  it('gleicher Satz nur einmal; leer ohne Karten', () => {
    const same = [card(1, { ex: 'We say [it] daily.', word: 'it' }), card(2, { ex: 'We say [it] daily.', word: 'it' })];
    expect(loopItems(same, NOW)).toHaveLength(1);
    expect(loopItems([], NOW)).toEqual([]);
  });
  it('Pause zum Nachsprechen: 2–8 s nach Satzlänge', () => {
    expect(repeatPauseMs('Hi.')).toBe(2000);
    expect(repeatPauseMs('We can leverage our network to reach new clients in Europe.')).toBe(11 * 420);
    expect(repeatPauseMs(Array.from({ length: 40 }, () => 'word').join(' '))).toBe(8000);
  });
});
