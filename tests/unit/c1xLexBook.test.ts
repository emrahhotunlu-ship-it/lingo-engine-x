// Buchung der betroffenen Wortkarten (Lernplattform 3.0 §3.4, Pflichtauflösung 5, P13).
import { describe, expect, it } from 'vitest';
import examples from '../fixtures/c1x/examples.json';
import { lexBookings, lexEvent, lexOut, type LexCard, type LexCtx } from '../../src/domain/c1x/lexBook';
import { c1Item } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, C1Response } from '../../src/domain/c1x/types';
import { dayKey } from '../../src/domain/date';
import { berlin } from './helpers';

const item = (id: string, over: Record<string, unknown> = {}): C1Item => c1Item.parse({ ...(examples.items as Array<Record<string, unknown>>).find((i) => i.id === id), ...over });
const TODAY = '2026-10-10';
const NOON = berlin(TODAY, 12);
const DAY_END = berlin('2026-10-11', 4);
const card = (word: string, over: Partial<LexCard> = {}): LexCard => ({ key: `vocab/${word}`, kind: 'v', id: word, due: berlin('2026-10-15', 10), last: berlin('2026-10-05', 10), ...over });
const ctx = (cards: Record<string, LexCard | null>, over: Partial<LexCtx> = {}): LexCtx => ({ cardOf: (w) => cards[w] ?? null, today: TODAY, dayOf: dayKey, dayEnd: DAY_END, ...over });
const sc = (it: C1Item, r: C1Response) => scoreC1(it, r);

describe('lexBookings', () => {
  const wf = item('wf-0001'); // overwhelming, getippt
  const mcc = item('mcc-0002'); // give up hope, Auswahl
  const wfRight = sc(wf, { kind: 'wf', text: 'overwhelmingly' });
  const mccRight = sc(mcc, { kind: 'mcc', pick: 1 });

  it('getippte Art: volle Wiederholung, Note wie berechnet, falsch = Nochmal, fast = Schwer', () => {
    const c = ctx({ overwhelming: card('overwhelming') });
    expect(lexBookings(wf, wfRight, 3, c)).toEqual([{ card: card('overwhelming'), ex: 'cloze', grade: 3 }]);
    expect(lexBookings(wf, wfRight, 4, c)[0]?.grade).toBe(4);
    expect(lexBookings(wf, sc(wf, { kind: 'wf', text: 'overwhelmed' }), 1, c)[0]?.grade).toBe(1);
    expect(lexBookings(wf, sc(wf, { kind: 'wf', text: 'overwhelmngly' }), 2, c)[0]?.grade).toBe(2);
  });

  it('Auswahlart: nur wenn die Karte heute nicht fällig ist, nie „Leicht“', () => {
    const notDue = ctx({ 'give up hope': card('hope') });
    expect(lexBookings(mcc, mccRight, 4, notDue)).toEqual([{ card: card('hope'), ex: 'ctx_mc', grade: 3 }]);
    expect(lexBookings(mcc, sc(mcc, { kind: 'mcc', pick: 0 }), 3, notDue)[0]?.grade).toBe(1);
    const due = ctx({ 'give up hope': card('hope', { due: berlin(TODAY, 9) }) });
    expect(lexBookings(mcc, mccRight, 3, due)).toEqual([]);
    const overdue = ctx({ 'give up hope': card('hope', { due: berlin('2026-10-01', 9) }) });
    expect(lexBookings(mcc, mccRight, 3, overdue)).toEqual([]);
  });

  it('höchstens eine Wiederholung je Karte und Lerntag über alle Quellen', () => {
    const doneToday = ctx({ overwhelming: card('overwhelming', { last: berlin(TODAY, 8) }) });
    expect(lexBookings(wf, wfRight, 3, doneToday)).toEqual([]);
    const sameDayBooked = ctx({ overwhelming: card('overwhelming') }, { booked: new Set(['vocab/overwhelming']) });
    expect(lexBookings(wf, wfRight, 3, sameDayBooked)).toEqual([]);
    // gestern zählt nicht als heute; nach Mitternacht vor 04:00 gilt noch der Vortag
    const yesterday = ctx({ overwhelming: card('overwhelming', { last: berlin('2026-10-09', 23) }) });
    expect(lexBookings(wf, wfRight, 3, yesterday)).toHaveLength(1);
    const lateNight = ctx({ overwhelming: card('overwhelming', { last: berlin('2026-10-11', 2) }) });
    // 02:00 am 11.10. gehört noch zum Lerntag 10.10. (Wechsel um 04:00): heute schon dran.
    expect(lexBookings(wf, wfRight, 3, lateNight)).toEqual([]);
    const nextMorning = ctx({ overwhelming: card('overwhelming', { last: berlin('2026-10-11', 5) }) });
    expect(lexBookings(wf, wfRight, 3, nextMorning)).toHaveLength(1);
  });

  it('nie neue Karten, nie Claude-Aufgaben, nie zweite Sicht, nie kwt/err/reg/para', () => {
    expect(lexBookings(wf, wfRight, 3, ctx({}))).toEqual([]);
    const ai = item('wf-0001', { id: 'wf-ai-1a2b3c4d', src: 'ai' });
    expect(lexBookings(ai, sc(ai, { kind: 'wf', text: 'overwhelmingly' }), 3, ctx({ overwhelming: card('overwhelming') }))).toEqual([]);
    expect(lexBookings(wf, wfRight, 3, ctx({ overwhelming: card('overwhelming') }), { again: true })).toEqual([]);
    const k = item('kwt-0001', { lex: ['company'] });
    expect(lexBookings(k, sc(k, { kind: 'kwt', text: 'is said to be' }), 3, ctx({ company: card('company') }))).toEqual([]);
  });

  it('mehrere Wörter: je Karte höchstens eine, doppelte Karte nur einmal', () => {
    const two = item('wf-0001', { lex: ['overwhelming', 'overwhelm'] });
    const same = card('overwhelming');
    const r = lexBookings(two, wfRight, 3, ctx({ overwhelming: same, overwhelm: same }));
    expect(r).toHaveLength(1);
  });
});

describe('lexEvent und lexOut', () => {
  it('AnswerEvent für den Schreibweg der Karten', () => {
    const e = lexEvent({ card: card('hope'), ex: 'ctx_mc', grade: 3 }, { t: NOON, day: TODAY, lang: 'de', ctx: 'xtra', ms: 4321.6, given: 'give', ans: 'give', dev: 't' });
    expect(e).toEqual({ t: NOON, day: TODAY, kind: 'v', id: 'hope', ex: 'ctx_mc', grade: 3, given: 'give', ans: 'give', ms: 4322, lang: 'de', ctx: 'xtra', dev: 't' });
  });

  it('Verlaufseintrag nur für Lexik (mcc, wf, cnet) mit lex-Bereich', () => {
    const w = item('wf-0001');
    const s = sc(w, { kind: 'wf', text: 'overwhelmingly' });
    expect(lexOut(w, s, { t: NOON, day: TODAY, ms: 3000 })).toMatchObject({ k: 'wf', d: TODAY, ok: true, text: 'overwhelming' });
    const gram = item('mcc-0001');
    expect(lexOut(gram, sc(gram, { kind: 'mcc', pick: 2 }), { t: NOON, day: TODAY, ms: 1 })).toBeNull();
    const k = item('kwt-0001');
    expect(lexOut(k, sc(k, { kind: 'kwt', text: 'is said to be' }), { t: NOON, day: TODAY, ms: 1 })).toBeNull();
  });
});
