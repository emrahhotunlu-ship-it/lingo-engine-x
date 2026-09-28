import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { applyUpdate, cardPatch, chunkPatch, reviewWrite } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { CONTROL, FLIP, againPos, calibration, controlAllowed, controlsSince, dirFor, flipStage, flipSuggest, formatInterval, pickMode, weekStartMs } from '../../src/domain/srs/flip';
import { availableExercises, chooseExercise, exerciseDef } from '../../src/domain/srs/modes';
import { inboxTier, newCards } from '../../src/domain/srs/queue';
import type { AnswerEvent, Grade, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Pflicht-Tests aus docs/neubau/anki-regeln.md §7 (P3).

type Doc = Record<string, unknown>;
const NOW = berlin('2026-09-28', 10);
const DAY = dayKey(NOW);
const D = 86_400_000;

const vocabDoc = (over: Doc = {}): Doc => ({ word: 'leverage', de: 'nutzen', def: 'to use something to maximum advantage', ex: 'We can [leverage] our network.', pos: 'verb', state: 'new', src: 'lookup', added: '2026-09-01', ...over });
const card = (over: Doc = {}, id = 'leverage'): TrainCard => toTrainCard(id, vocabDoc(over), true, NOW) as TrainCard;
const answer = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: DAY, kind: 'v', id: 'leverage', ex: 'flip', grade: 3, given: '', ans: 'leverage', ms: 2500, lang: 'de', ctx: 'rev', ...over });
const chunkDoc = (over: Doc = {}): Doc => ({ en: 'push back on', de: 'sich wehren gegen', state: 'new', src: { kind: 'scene', upgraded: 'Their CFO will push back on the price.' }, ...over });

describe('Neue Karte: Aufdecken schreibt stage 1, kein invalid_result', () => {
  for (const g of [1, 2, 3, 4] as Grade[]) {
    it(`Vokabel, Note ${g}`, () => {
      const w = reviewWrite('vocab/leverage', vocabDoc(), answer({ grade: g }), null);
      expect(w.kind).toBe('update');
      if (w.kind !== 'update') return;
      expect(w.patch.stage).toBe(g >= 3 ? 1 : 1);
      expect(w.patch.xs).toEqual({ flip: { c: g > 1 ? 1 : 0, w: g > 1 ? 0 : 1 } });
      expect(w.patch.modes).toEqual({ recog: { c: g > 1 ? 1 : 0, w: g > 1 ? 0 : 1 } });
      expect((w.patch.hist as Doc[]).at(-1)).toMatchObject({ x: 'flip', m: 'recog', g });
      expect(w.patch.ac).toBeUndefined();
      // Alte Felder gespiegelt, fsrs zusätzlich (A6.14).
      expect(w.patch.fsrs).toMatchObject({ v: 1, src: 'lx', last: NOW });
      expect(w.patch.due).toBe((w.patch.fsrs as Doc).due);
    });
    it(`Wendung, Note ${g}`, () => {
      const w = reviewWrite('chunk/c1', chunkDoc(), answer({ kind: 'chunk', id: 'c1', grade: g, q: 'push back on' }), null);
      expect(w.kind).toBe('update');
      if (w.kind !== 'update') return;
      expect(w.patch.stage).toBe(1);
      expect(w.patch.modes).toBeUndefined();
      expect(w.patch.xs).toEqual({ flip: { c: g > 1 ? 1 : 0, w: g > 1 ? 0 : 1 } });
    });
  }
});

describe('Stufentabelle (§3)', () => {
  it('Tabelle', () => {
    expect(flipStage(0, 3)).toBe(1);
    expect(flipStage(1, 3)).toBe(2);
    expect(flipStage(2, 3)).toBe(2);
    expect(flipStage(4, 3)).toBe(4);
    expect(flipStage(4, 1)).toBe(3);
    expect(flipStage(0, 1)).toBe(1);
    expect(flipStage(1, 1)).toBe(1);
    expect(flipStage(3, 2)).toBe(3);
    expect(flipStage(0, 2)).toBe(1);
  });
  it('Leicht springt nicht weiter als Gut, Nochmal senkt höchstens um 1 und nie unter 1', () => {
    for (let s = 0; s <= 5; s++) {
      expect(flipStage(s, 4)).toBe(flipStage(s, 3));
      expect(flipStage(s, 1)).toBeGreaterThanOrEqual(Math.max(1, s - 1));
      expect(flipStage(s, 1)).toBeGreaterThanOrEqual(1);
    }
  });
  it('cardPatch und chunkPatch nutzen die Regel (Stufe 2 + Leicht bleibt 2)', () => {
    expect(cardPatch(vocabDoc({ state: 'review', stage: 2, reps: 3, S: 3, D: 5, due: NOW - D, last: NOW - 3 * D }), answer({ grade: 4 })).stage).toBe(2);
    expect(chunkPatch(chunkDoc({ state: 'review', stage: 2, reps: 3, S: 3, D: 5, due: NOW - D, last: NOW - 3 * D }), answer({ kind: 'chunk', grade: 4 })).stage).toBe(2);
  });
});

describe('Katalog: flip wird nie automatisch gewählt', () => {
  it('Eintrag vorhanden, supports immer false', () => {
    expect(exerciseDef('flip')).toMatchObject({ ex: 'flip', stage: 0, level: 2, mode: 'recog', input: 'flip' });
    for (let s = 0; s <= 5; s++) {
      const c = card({ state: 'review', stage: s, reps: 2, S: 2, D: 5, due: NOW, last: NOW - 2 * D });
      expect(availableExercises(c, 'de', 10)).not.toContain('flip');
      expect(chooseExercise(c, 'de', 10)).not.toBe('flip');
    }
  });
});

const hist = (...h: Array<[number, number, string]>) => h.map(([t, g, x]) => ({ t, g, x, m: x === 'flip' ? 'recog' : 'type' }));
const reviewed = (stage: number, h: Doc[]) => card({ state: 'review', stage, reps: h.length || 1, S: 3, D: 5, due: NOW - 1000, last: (h.at(-1)?.t) ?? NOW - 3 * D, hist: h });

describe('pickMode: alle 7 Regeln in ihrer Reihenfolge', () => {
  const base = { day: DAY, lang: 'de' as const, due: true };
  it('1: Tippen gewünscht oder keine Bedeutung', () => {
    expect(pickMode({ ...base, card: reviewed(1, []), requested: 'type' })).toBe('type');
    const noMeaning = card({ de: undefined });
    expect(pickMode({ ...base, card: noMeaning, requested: 'auto' })).toBe('type');
    expect(pickMode({ ...base, card: noMeaning, requested: 'flip' })).toBe('type');
  });
  it('2: heute schon bewertet → derselbe Modus (auch vor Stapel-Wunsch)', () => {
    const today = NOW - 60_000;
    expect(pickMode({ ...base, card: reviewed(4, hist([today, 1, 'flip'])), requested: 'auto' })).toBe('flip');
    expect(pickMode({ ...base, card: reviewed(1, hist([today, 3, 'cloze'])), requested: 'flip' })).toBe('type');
  });
  it('3: Stapel im Aufdecken-Modus → Aufdecken, Kontrolle nur wenn erlaubt', () => {
    const easy = reviewed(2, hist([NOW - 5 * D, 4, 'flip']));
    expect(pickMode({ ...base, card: reviewed(4, []), requested: 'flip' })).toBe('flip');
    expect(pickMode({ ...base, card: easy, requested: 'flip' })).toBe('flip');
    expect(pickMode({ ...base, card: easy, requested: 'flip', controlAllowed: true })).toBe('control');
    expect(pickMode({ ...base, card: easy, requested: 'flip', controlAllowed: true, due: false })).toBe('flip');
  });
  it('4: auto nach Aufdecken + Leicht → Kontrolle (nur fällig, nie vorziehen)', () => {
    const easy = reviewed(4, hist([NOW - 5 * D, 4, 'flip']));
    expect(pickMode({ ...base, card: easy, requested: 'auto' })).toBe('control');
    expect(pickMode({ ...base, card: easy, requested: 'auto', due: false })).toBe('type');
  });
  it('5: auto, gespeicherte Stufe ≥ 3 → Tippen', () => {
    expect(pickMode({ ...base, card: reviewed(3, hist([NOW - 5 * D, 3, 'cloze'])), requested: 'auto' })).toBe('type');
  });
  it('6: auto nach Aufdecken + Gut → Prüfabfrage', () => {
    expect(pickMode({ ...base, card: reviewed(2, hist([NOW - 5 * D, 3, 'flip'])), requested: 'auto' })).toBe('probe');
  });
  it('7: sonst Aufdecken (neu, Stufe 1–2, nach Nochmal oder Schwer)', () => {
    expect(pickMode({ ...base, card: card(), requested: 'auto' })).toBe('flip');
    expect(pickMode({ ...base, card: reviewed(2, hist([NOW - 5 * D, 1, 'flip'])), requested: 'auto' })).toBe('flip');
    expect(pickMode({ ...base, card: reviewed(1, hist([NOW - 5 * D, 2, 'flip'])), requested: 'auto' })).toBe('flip');
  });
  it('Wendung mit gespeicherter Stufe 2 wird aufgedeckt (nicht über chunkStage)', () => {
    const c = toChunkCard('c1', chunkDoc({ state: 'review', stage: 2, reps: 2, S: 3, D: 5, due: NOW - 1000, last: NOW - 3 * D, hist: [] }), NOW) as TrainCard;
    expect(c.stage).toBe(3);
    expect(pickMode({ ...base, card: c, requested: 'auto' })).toBe('flip');
  });
});

describe('flipSuggest (§2)', () => {
  for (const phrase of [false, true]) {
    const f = phrase ? FLIP.phraseFactor : 1;
    it(`Grenzen 1 / 3 / 10 s bei f = ${f}`, () => {
      expect(flipSuggest({ revealMs: 999, phrase })).toBe(3);
      expect(flipSuggest({ revealMs: 1000, phrase })).toBe(4);
      expect(flipSuggest({ revealMs: 3000 * f, phrase })).toBe(4);
      expect(flipSuggest({ revealMs: 3000 * f + 1, phrase })).toBe(3);
      expect(flipSuggest({ revealMs: 10000 * f, phrase })).toBe(3);
      expect(flipSuggest({ revealMs: 10000 * f + 1, phrase })).toBe(2);
    });
  }
  it('Lesezuschlag nur auf Gut (150 ms je Wort ab dem 9., höchstens 3 s)', () => {
    expect(flipSuggest({ revealMs: 10_500, phrase: false, frontWords: 12 })).toBe(3);
    expect(flipSuggest({ revealMs: 10_700, phrase: false, frontWords: 12 })).toBe(2);
    expect(flipSuggest({ revealMs: 12_900, phrase: false, frontWords: 40 })).toBe(3);
    expect(flipSuggest({ revealMs: 13_100, phrase: false, frontWords: 40 })).toBe(2);
    // Leicht-Grenze bleibt 3 s
    expect(flipSuggest({ revealMs: 3100, phrase: false, frontWords: 40 })).toBe(3);
  });
  it('heute gesehen → höchstens Gut; verborgen → Gut; strenge Kalibrierung 2 s', () => {
    expect(flipSuggest({ revealMs: 1500, phrase: false, seenToday: true })).toBe(3);
    expect(flipSuggest({ revealMs: 20_000, phrase: false, hidden: true })).toBe(3);
    expect(flipSuggest({ revealMs: 2500, phrase: false, strict: true })).toBe(3);
    expect(flipSuggest({ revealMs: 2000, phrase: false, strict: true })).toBe(4);
  });
  it('nie 1', () => {
    for (const ms of [0, 500, 1000, 2999, 5000, 9999, 20_000, 120_000, Number.NaN]) {
      for (const phrase of [false, true]) for (const seenToday of [false, true]) expect(flipSuggest({ revealMs: ms, phrase, seenToday })).toBeGreaterThan(1);
    }
  });
});

describe('Nochmal: Wiedervorlage', () => {
  it('Aufdecken an pos + 6, Tippen an pos + 4, höchstens ans Ende', () => {
    expect(againPos(3, 40, true)).toBe(9);
    expect(againPos(3, 40, false)).toBe(7);
    expect(againPos(38, 40, true)).toBe(40);
  });
});

describe('Kontrolle (§4)', () => {
  it('Grenzen 1 / 2 / 5 im Stapel', () => {
    expect(controlAllowed({ week: 0, day: 0, session: 0 })).toBe(true);
    expect(controlAllowed({ week: 0, day: 0, session: 1 })).toBe(false);
    expect(controlAllowed({ week: 1, day: 2, session: 0 })).toBe(false);
    expect(controlAllowed({ week: 5, day: 0, session: 0 })).toBe(false);
    expect(controlAllowed({ week: 4, day: 1, session: 0 })).toBe(true);
    expect(CONTROL).toMatchObject({ perSession: 1, perDay: 2, perWeek: 5 });
  });
  it('Kontrollen werden aus hist gezählt (Woche ab Montag 04:00)', () => {
    const ws = weekStartMs(NOW);
    expect(new Date(ws).getDay()).toBe(1);
    expect(new Date(ws).getHours()).toBe(4);
    const docs = [
      { hist: hist([ws - 3 * D, 4, 'flip'], [ws + 1000, 3, 'cloze']) },
      { hist: hist([ws - 3 * D, 4, 'flip'], [ws - D, 3, 'type']) },
      { hist: hist([ws - 3 * D, 3, 'flip'], [ws + 1000, 3, 'cloze']) },
    ];
    expect(controlsSince(docs, ws)).toBe(1);
  });
  const pairDocs = (hits: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({ hist: hist([NOW - 10 * D, 4, 'flip'], [NOW - 5 * D, i < hits ? 3 : 1, 'cloze']) }));
  it('Kalibrierung: 7 von 10 streng, 8 von 10 nicht, unter 10 Paaren nie', () => {
    expect(calibration(pairDocs(7, 10), NOW)).toMatchObject({ pairs: 10, hits: 7, strict: true });
    expect(calibration(pairDocs(8, 10), NOW)).toMatchObject({ pairs: 10, hits: 8, strict: false });
    expect(calibration(pairDocs(2, 9), NOW).strict).toBe(false);
  });
  it('Kalibrierung zählt nur die letzten 28 Tage', () => {
    const old = Array.from({ length: 10 }, () => ({ hist: hist([NOW - 40 * D, 4, 'flip'], [NOW - 35 * D, 1, 'cloze']) }));
    expect(calibration(old, NOW).pairs).toBe(0);
  });
});

describe('Eingangskorb (§5)', () => {
  it('meeting vor preply vor lookup vor seed, innerhalb einer Stufe die älteste zuerst', () => {
    const mk = (id: string, src: string, added: string) => card({ src, added, word: id, ex: `The [${id}] matters.` }, id);
    const cards = [mk('s1', 'seed', '2026-01-01'), mk('l2', 'lookup', '2026-09-10'), mk('l1', 'lookup', '2026-09-01'), mk('p1', 'preply', '2026-09-20'), mk('m1', 'meeting', '2026-09-25'), mk('x1', 'weird', '2026-01-01')];
    expect(newCards(cards).map((c) => c.id)).toEqual(['m1', 'p1', 'l1', 'l2', 's1', 'x1']);
  });
  it('Wochenthema ist Stufe 4 (vor eigenen Funden, hinter eigenem Output)', () => {
    expect(inboxTier('lookup', true)).toBe(3);
    expect(inboxTier('say', true)).toBe(2);
    expect(inboxTier('seed', true)).toBe(3);
    expect(inboxTier('lookup')).toBe(4);
  });
});

describe('Richtung und Intervalle', () => {
  it('gemischt: je Karte und Tag fest', () => {
    expect(dirFor('vocab/a', 'mix', DAY)).toBe(dirFor('vocab/a', 'mix', DAY));
    expect(dirFor('vocab/a', 'de-en', DAY)).toBe('de-en');
    const set = new Set(Array.from({ length: 20 }, (_, i) => dirFor(`vocab/w${i}`, 'mix', DAY)));
    expect(set.size).toBe(2);
  });
  it('formatInterval DE/EN', () => {
    expect(formatInterval(60_000, 'de')).toBe('1 Min.');
    expect(formatInterval(10 * 60_000, 'de')).toBe('10 Min.');
    expect(formatInterval(3 * D, 'de')).toBe('3 Tage');
    expect(formatInterval(D, 'de')).toBe('1 Tag');
    expect(formatInterval(60 * D, 'de')).toBe('2 Mon.');
    expect(formatInterval(60_000, 'en')).toBe('1 min');
    expect(formatInterval(3 * D, 'en')).toBe('3 days');
    expect(formatInterval(5 * 3_600_000, 'en')).toBe('5 h');
  });
});

describe('Schreibweg bleibt A6.14-treu', () => {
  it('alte Felder bleiben, nichts gelöscht', () => {
    const cur = vocabDoc({ state: 'review', stage: 2, reps: 3, S: 3, D: 5, due: NOW - D, last: NOW - 3 * D, custom: 'bleibt' });
    const w = reviewWrite('vocab/leverage', cur, answer({ grade: 2 }), null);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    const merged = applyUpdate(cur, w.patch);
    for (const k of Object.keys(cur)) expect(k in merged, k).toBe(true);
    expect(merged.custom).toBe('bleibt');
    expect(merged.stage).toBe(2);
  });
});
