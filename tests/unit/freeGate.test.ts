import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { cardPatch } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { availableExercises, chooseExercise, productionWeak, CHOICE_PENALTY } from '../../src/domain/srs/modes';
import { FREE_ANSWER, FREE_DAYS_FOR_ADVANCE, freeCorrectDays } from '../../src/domain/srs/variety';
import type { AnswerEvent, ExerciseId, TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Auswertung 15.10.2026, Punkt 4: schwache Abfrageart nicht meiden; Aufstieg auf Stufe 4 und 5 nur mit zwei freien Antworten an verschiedenen Tagen.

type Doc = Record<string, unknown>;
const NOW = berlin('2026-10-15', 10);
const D = 86_400_000;
const ENV = { tts: false, ai: false, touch: false, listen: false };
const doc = (over: Doc = {}): Doc => ({
  word: 'reassure',
  de: 'beruhigen',
  def: 'to make someone feel less worried',
  ex: 'We [reassure] the customer every time.',
  pos: 'verb',
  state: 'review',
  stage: 3,
  S: 4,
  D: 5,
  due: NOW - D,
  last: NOW - 3 * D,
  reps: 6,
  lapses: 0,
  hist: [],
  modes: {},
  src: 'lookup',
  added: '2026-08-01',
  ...over,
});
const answer = (ex: ExerciseId, grade: 1 | 2 | 3 | 4, over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: dayKey(NOW), kind: 'v', id: 'reassure', ex, grade, given: 'x', ans: 'y', ms: 3000, lang: 'de', ctx: 'rev', ...over });
const hist = (...e: Array<[number, string, number]>): Doc[] => e.map(([ago, x, g]) => ({ t: NOW - ago * D, m: 'type', g, x }));

describe('Aufstieg auf Stufe 4 und 5 nur mit freien Antworten an verschiedenen Tagen', () => {
  it('freie Arten sind getippt oder selbst gebildet; Auswahl, Stütze und Aufdecken zählen nicht', () => {
    for (const ex of ['cloze', 'type', 'produce', 'colloc', 'situation', 'wordfam', 'dictation']) expect(FREE_ANSWER.has(ex), ex).toBe(true);
    for (const ex of ['mc_en', 'mc_de', 'match', 'ctx_mc', 'cloze_hint', 'tiles', 'colloc_gap', 'flip', 'contrast']) expect(FREE_ANSWER.has(ex), ex).toBe(false);
    expect(FREE_DAYS_FOR_ADVANCE).toBe(2);
  });

  it('freeCorrectDays zählt verschiedene Lerntage richtiger freier Antworten, nicht falsche, nicht ungeprüfte', () => {
    const h = [...hist([5, 'type', 3], [5, 'cloze', 3], [4, 'cloze', 1], [3, 'mc_en', 3], [2, 'cloze_hint', 3]), { t: NOW - D, m: 'produce', g: 3, x: 'produce', u: 1 }];
    expect(freeCorrectDays({ hist: h })).toBe(1);
    expect(freeCorrectDays({ hist: h }, { t: NOW, ex: 'cloze', grade: 3 })).toBe(2);
    expect(freeCorrectDays({ hist: h }, { t: NOW, ex: 'mc_de', grade: 3 })).toBe(1);
  });

  it('Stufe 3 → 4 mit nur einer freien Antwort bleibt 3; mit einer weiteren an einem anderen Tag wird es 4', () => {
    expect(cardPatch(doc(), answer('cloze', 3)).stage).toBe(3);
    expect(cardPatch(doc({ hist: hist([4, 'type', 3]) }), answer('cloze', 3)).stage).toBe(4);
  });

  it('zwei freie Antworten am selben Tag genügen nicht', () => {
    expect(cardPatch(doc({ hist: hist([0, 'type', 3]) }), answer('cloze', 3, { t: NOW + 60_000 })).stage).toBe(3);
  });

  it('Auswahl und Stütze heben nicht auf 4 (zählen auch nicht als Beweis)', () => {
    expect(cardPatch(doc({ hist: hist([5, 'mc_de', 3], [4, 'cloze_hint', 3], [3, 'match', 3]) }), answer('cloze', 3)).stage).toBe(3);
  });

  it('Stufe 4 → 5 ebenso', () => {
    expect(cardPatch(doc({ stage: 4 }), answer('dictation', 3)).stage).toBe(4);
    // Stufe 5 ist strenger als Stufe 4 (Prüfung M2): drei freie Tage, nicht zwei.
    expect(cardPatch(doc({ stage: 4, hist: hist([6, 'cloze', 3]) }), answer('produce', 3, { ex: 'produce' })).stage).toBe(4);
    expect(cardPatch(doc({ stage: 4, hist: hist([7, 'type', 3], [6, 'cloze', 3]) }), answer('produce', 3, { ex: 'produce' })).stage).toBe(5);
  });

  it('nichts wird zurückgestuft: ohne Verlauf bleibt eine Karte auf Stufe 4 oder 5 stehen, ein Fehler senkt wie bisher', () => {
    expect(cardPatch(doc({ stage: 5 }), answer('cloze', 3)).stage).toBe(5);
    expect(cardPatch(doc({ stage: 4 }), answer('mc_de', 3)).stage).toBe(4);
    expect(cardPatch(doc({ stage: 5 }), answer('cloze', 1)).stage).toBe(4);
  });

  it('Aufstieg auf Stufe 2 und 3 bleibt unverändert', () => {
    expect(cardPatch(doc({ stage: 2 }), answer('cloze_hint', 3)).stage).toBe(3);
    expect(cardPatch(doc({ stage: 1 }), answer('mc_en', 3)).stage).toBe(2);
  });
});

describe('Abfrageart nach der Schwäche der Karte', () => {
  const card = (over: Doc = {}): TrainCard => toTrainCard('reassure', doc(over), true, NOW) as TrainCard;

  it('productionWeak: viel erkannt, kaum produziert → schwach', () => {
    expect(productionWeak(card({ modes: { recog: { c: 20, w: 0 }, type: { c: 1, w: 2 } } }))).toBe(true);
    expect(productionWeak(card({ modes: { recog: { c: 20, w: 0 } } }))).toBe(true);
    expect(productionWeak(card({ modes: { recog: { c: 8, w: 2 }, type: { c: 8, w: 2 } } }))).toBe(false);
    expect(productionWeak(card({ modes: { recog: { c: 2, w: 0 } } }))).toBe(false);
  });

  it('ab Stufe 3 gewinnt eine getippte Art gegen eine Auswahl-Art mit hoher Trefferquote', () => {
    const c = card({ stage: 3, modes: { colloc: { c: 9, w: 1 } }, xs: { colloc_gap: { c: 9, w: 1 } }, col: [{ p: 'reassure customers', de: 'Kunden beruhigen', gap: 'customers', opts: ['clients', 'friends', 'owners'], ex: 'We [reassure customers] often.' }] });
    const picks = new Set<ExerciseId | null>();
    for (let i = 0; i < 6; i++) picks.add(chooseExercise(c, 'de', 12, [], ENV));
    for (const ex of picks) expect(ex).not.toBe('colloc_gap');
    expect(CHOICE_PENALTY).toBeGreaterThan(0.2);
  });

  it('eine Auswahl-Art, in der die Karte schwach ist, wird weiter gefragt (sie bleibt trotz Aufschlag der schwächste Posten)', () => {
    const c = card({ stage: 3, xs: { cloze_hint: { c: 12, w: 0 }, colloc_gap: { c: 0, w: 9 } }, col: [{ p: 'reassure customers', de: 'Kunden beruhigen', gap: 'customers', opts: ['clients', 'friends', 'owners'], ex: 'We [reassure customers] often.' }] });
    expect(availableExercises(c, 'de', 12, ENV)).toContain('colloc_gap');
    expect(chooseExercise(c, 'de', 12, [], ENV)).toBe('colloc_gap');
  });

  it('Karte auf Stufe 2, die erkannt aber nie produziert wurde, bekommt eine Produktions-Art (nächsthöhere Stufe) als Kandidat', () => {
    const c = card({ stage: 2, modes: { recog: { c: 20, w: 0 } }, xs: { mc_de: { c: 12, w: 0 }, match: { c: 8, w: 0 } } });
    expect(chooseExercise(c, 'de', 12, [], ENV)).toMatch(/^(cloze_hint|cloze|type|complete)$/);
  });

  it('Stufe 1 bleibt beim Erkennen (kein Produktions-Zwang für ganz neue Karten)', () => {
    const c = card({ stage: 1, modes: { recog: { c: 20, w: 0 } } });
    expect(chooseExercise(c, 'de', 12, [], ENV)).toMatch(/^(mc_en|ctx_mc)$/);
  });
});
