import { describe, expect, it } from 'vitest';
import { beAdjHead, type Gap, infinitiveTo, looseOf, targetOf } from '../../../src/modules/vocab/domain/card';
import { type CheckDict, checkAnswer } from '../../../src/modules/vocab/domain/check';
import { cardOf, evaluate } from '../../../src/modules/vocab/domain/flow';
import { emptyLex } from '../../../src/modules/vocab/domain/planner';
import type { Task } from '../../../src/modules/vocab/domain/session';

// Live-Kommentar 23.11.2026 („to be aware of“: „das ‚to‘ ist hier blöd, weil sich damit kein Satz bilden lässt“):
// das Infinitiv-„to“ am Anfang ist nie Pflicht; ohne Satz zählt bei „to be + Adjektiv“ auch die Form ohne „be“. Lücken bleiben streng.

const dict: CheckDict = { isWord: (w) => ['aware', 'of', 'look', 'forward', 'be'].includes(w), misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const T0 = Date.parse('2026-11-23T18:00:00Z');
const task = (over: Partial<Task> = {}): Task => ({ path: 'vocab/aware', form: 'nosent', step: 0, intro: false, planned: true, why: 'due', sent: 'n', cue: false, ...over });
const lex = () => emptyLex('w', 'core', T0 - 10 * 86_400_000);
const gapOf = (answer: string, before?: string): Gap => ({ segs: [], answer, split: false, ...(before ? { before } : {}) });

describe('Infinitiv-„to“ und „to be …“ erkennen', () => {
  it('Verb-Stichwörter mit „to“, auch „to be …“; Satzadverbiale und feste Wendungen nicht', () => {
    for (const h of ['to be aware of', 'to adjust', 'to look forward to', 'to be keen on', 'to be liable for sth']) expect(infinitiveTo(h)).toBe(true);
    for (const h of ['to be honest', 'to be fair to them', 'to a certain extent', 'to date', 'look forward to', 'aware of']) expect(infinitiveTo(h)).toBe(false);
  });
  it('„be“ fällt nur bei Adjektiv/Partizip weg, nicht bei *due to*, *used to*, *on the fence*', () => {
    for (const h of ['to be aware of', 'to be keen on', 'to be liable for', 'to be reluctant to']) expect(beAdjHead(h)).toBe(true);
    for (const h of ['to be due to', 'to be used to', 'to be on the fence', 'to be up against', 'to be honest', 'to adjust']) expect(beAdjHead(h)).toBe(false);
  });
});

describe('Karte ohne Satz: „to be aware of“', () => {
  const m = cardOf({ task: task(), doc: { word: 'to be aware of', de: 'sich (einer Sache) bewusst sein', pos: 'adj' }, lex: lex(), teach: {}, nowMs: T0, sbGate: null })!;
  it('Lösung bleibt wie gespeichert', () => {
    expect(m.mode).toBe('nosent');
    expect(m.answer).toBe('to be aware of');
  });
  it('„be aware of“, „aware of“, „to be aware of“ → richtig', () => {
    for (const g of ['be aware of', 'aware of', 'to be aware of', 'To be aware of.', 'Aware of']) expect(evaluate(m, g, dict).outcome).toBe('ok');
  });
  it('Tippfehler im Rest bleibt Tippfehler, falsche Präposition bleibt Fehler', () => {
    expect(evaluate(m, 'aware off', dict).outcome).not.toBe('ok');
    expect(evaluate(m, 'aware about', dict).outcome).toBe('prep');
    expect(evaluate(m, 'aware', dict).outcome).toBe('prep');
  });
  it('„to be due to“: ohne „be“ eine andere Bedeutung → nicht richtig; ohne „to“ schon', () => {
    const d = cardOf({ task: task(), doc: { word: 'to be due to', de: 'sollen (planmäßig)', pos: 'verb' }, lex: lex(), teach: {}, nowMs: T0, sbGate: null })!;
    expect(evaluate(d, 'be due to', dict).outcome).toBe('ok');
    expect(evaluate(d, 'due to', dict).outcome).not.toBe('ok');
  });
});

describe('„to“ innerhalb bleibt Pflicht', () => {
  const m = cardOf({ task: task(), doc: { word: 'to look forward to sth', de: 'sich freuen auf', pos: 'verb' }, lex: lex(), teach: {}, nowMs: T0, sbGate: null })!;
  it('„look forward“ für „look forward to“ ist nicht richtig', () => {
    expect(m.answer).toBe('look forward to');
    expect(evaluate(m, 'look forward', dict).outcome).not.toBe('ok');
    expect(evaluate(m, 'to look forward', dict).outcome).not.toBe('ok');
  });
  it('„to look forward to“ und „look forward to“ → richtig (beidseitig, auch ohne Wortart)', () => {
    const noPos = cardOf({ task: task(), doc: { word: 'to look forward to sth', de: 'sich freuen auf' }, lex: lex(), teach: {}, nowMs: T0, sbGate: null })!;
    for (const c of [m, noPos]) {
      expect(evaluate(c, 'to look forward to', dict).outcome).toBe('ok');
      expect(evaluate(c, 'look forward to', dict).outcome).toBe('ok');
    }
  });
});

describe('Lücke mit Satz bleibt streng', () => {
  it('Lücke „am aware of“: „aware of“ und „be aware of“ zählen nicht', () => {
    const t = targetOf(lex(), 'am aware of', 'adj', {}, gapOf('am aware of', 'I'), 'to be aware of');
    expect(t.toFree).toBeUndefined();
    expect(t.beFree).toBeUndefined();
    expect(checkAnswer('aware of', t, dict).outcome).not.toBe('ok');
    expect(checkAnswer('be aware of', t, dict).outcome).not.toBe('ok');
    expect(checkAnswer('am aware of', t, dict).outcome).toBe('ok');
  });
  it('Lücke enthält das „to“: ohne „to“ passt es nicht in den Satz', () => {
    const t = targetOf(lex(), 'to be aware of', 'adj', {}, gapOf('to be aware of', 'need'), 'to be aware of');
    expect(checkAnswer('be aware of', t, dict).outcome).not.toBe('ok');
    expect(checkAnswer('to be aware of', t, dict).outcome).toBe('ok');
  });
  it('Lücke ohne „to“ vor der Grundform: mitgetipptes „to“ ist kein Fehler', () => {
    expect(looseOf('to be aware of', gapOf('be aware of', 'should'))).toEqual({ toFree: true });
    const t = targetOf(lex(), 'be aware of', 'adj', {}, gapOf('be aware of', 'should'), 'to be aware of');
    expect(checkAnswer('to be aware of', t, dict).outcome).toBe('ok');
    expect(checkAnswer('aware of', t, dict).outcome).not.toBe('ok');
    // gebeugt in der Lücke: kein „to“ davor möglich
    expect(looseOf('to adjust', gapOf('adjusted'))).toEqual({});
  });
});
