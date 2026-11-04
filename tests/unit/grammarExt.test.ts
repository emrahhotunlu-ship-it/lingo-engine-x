// M0 (docs/umbau/module/plan.md, Nachträge architect Nr. 1 und learning-scientist Nr. 1–3): Herkunftsmarke `ext` für Tempo und c1x-Runden aus Praxis.
// Höchstens EINE BKT-Wirkung je Thema und Lerntag aus `ext` (Tempo und c1x gemeinsam, gemerkt in `grammar/<t>.xd`), nur bei freier Produktion;
// alles andere (Zähler, `recent`, `pats`, `seen`, Fehlersätze) wie bisher. Ein Fehler bucht nie Wort UND Grammatik.
import { describe, expect, it } from 'vitest';
import pilotErr from '../../src/content/c1x/src/pilot/err.json';
import pilotKwt from '../../src/content/c1x/src/pilot/kwt.json';
import examples from '../fixtures/c1x/examples.json';
import { bookAnswer, type C1Run } from '../../src/domain/c1x/book';
import { c1Account, C1_CUED, lexBookings, type LexCard } from '../../src/domain/c1x/lexBook';
import { toTask } from '../../src/domain/c1x/runtime';
import { c1Item } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, C1Response } from '../../src/domain/c1x/types';
import { bktStep, displayP, p0Of, topicP } from '../../src/domain/grammar/bkt';
import { extBkt, grammarWrite } from '../../src/domain/grammar/write';
import type { GrammarAnswer } from '../../src/domain/learn/types';
import { patsOf } from '../../src/domain/metrics/pattern';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { validateDoc } from '../../src/data/validate';
import { berlin } from './helpers';
import { answer } from './learnHelpers';

type Doc = Record<string, unknown>;
const parse = (raw: unknown): C1Item => c1Item.parse(raw);
const items = [...pilotKwt.items, ...pilotErr.items, ...(examples.items as unknown[])].map(parse);
const byId = (id: string): C1Item => items.find((i) => i.id === id) as C1Item;
const kwt = byId('kwt-9001'); // passive-plus, „is said to be“
const err = byId('err-9001'); // gerund-inf, „hear“ → „hearing“
const wf = byId('wf-0001');

const D1 = '2026-10-05';
const D2 = '2026-10-06';
const T1 = berlin(D1, 10);
const T2 = berlin(D2, 10);

function c1(item: C1Item, response: C1Response, run: Partial<C1Run> & { t: number; day: string }, typed = true): GrammarAnswer {
  const score = scoreC1(item, typed ? ({ ...response, typed: true } as C1Response) : response);
  return bookAnswer(toTask(item), score, response, { form: typed ? 'typed' : 'tap', inp: 'desk', timeMs: 6000, help: 0, lang: 'de', ctx: 'xtra', ...run });
}
const base = (topic: string): Doc => ({ id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-10-04', last: berlin('2026-10-04', 10), due: 0, n: 0, c: 0, hist: [], errors: [], seen: [], seenText: [], recent: [] });
function step(cur: Doc, a: GrammarAnswer): { doc: Doc; patch: Doc } {
  const w = grammarWrite(cur, a);
  if (w.kind !== 'update') throw new Error(`erwartet update, war ${w.kind}`);
  return { doc: applyUpdate(cur, w.patch), patch: w.patch };
}
const BKT = ['p', 'anchor', 'anchorD', 'due', 'hist', 'xd'];
const withoutBkt = (d: Doc): Doc => Object.fromEntries(Object.entries(d).filter(([k]) => !BKT.includes(k)));

describe('M0 Grammatik: eine BKT-Wirkung je Thema und Lerntag aus `ext`', () => {
  it('erste getippte c1x-Antwort bucht BKT wie bisher (dieselbe Dämpfung) und merkt den Lerntag in `xd`', () => {
    const plain = step(base('passive-plus'), c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }));
    const ext = step(base('passive-plus'), { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }), ext: 'c1x' });
    expect(ext.patch.p).toBe(plain.patch.p);
    expect(ext.patch.p as number).toBeGreaterThan(0.5);
    // Dämpfung aus bkt.ts unverändert: höchstens ±0,06 je Schritt.
    expect((ext.patch.p as number) - 0.5).toBeLessThanOrEqual(0.06 + 1e-9);
    expect(ext.patch.xd).toBe(D1);
    expect(plain.patch.xd).toBeUndefined();
    expect(withoutBkt(ext.patch)).toEqual(withoutBkt(plain.patch));
  });

  it('zweite `ext`-Antwort am selben Lerntag (Tempo nach c1x, gemeinsamer Deckel): kein BKT-Schritt, Zähler/pats/seen/Fehlersatz wie bisher', () => {
    const first = step(base('passive-plus'), { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }), ext: 'c1x' });
    const wrongA = c1(kwt, { kind: 'kwt', text: 'is said that it is' }, { t: T1 + 1000, day: D1 });
    const plain = step(first.doc, wrongA);
    const capped = step(first.doc, { ...wrongA, ext: 'tempo', tempo: true, late: true });
    // Kein BKT-Schritt: p, Anker, Fälligkeit, Verlauf bleiben.
    expect(capped.doc.p).toBe(first.doc.p);
    expect(capped.doc.due).toBe(first.doc.due);
    expect(capped.doc.hist).toEqual(first.doc.hist);
    expect(capped.doc.anchor).toBe(first.doc.anchor);
    expect(capped.doc.xd).toBe(D1);
    expect(plain.doc.p as number).toBeLessThan(first.doc.p as number);
    // Alles andere wie auf dem alten Weg.
    for (const k of ['n', 'c', 'last', 'recent', 'seen', 'seenText', 'errors']) expect(capped.doc[k], k).toEqual(plain.doc[k]);
    expect(patsOf(capped.doc)).toEqual(patsOf(plain.doc));
  });

  it('am nächsten Lerntag wieder eine Wirkung; Antworten ohne `ext` buchen immer (der Deckel gilt nur für `ext`)', () => {
    const d1 = step(base('passive-plus'), { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }), ext: 'c1x' });
    const duty = step(d1.doc, { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1 + 1000, day: D1, ctx: 'duty' }) });
    expect(duty.doc.p as number).toBeGreaterThan(d1.doc.p as number);
    expect(duty.doc.xd).toBe(D1);
    const d2 = step(duty.doc, { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T2, day: D2 }), ext: 'c1x' });
    expect(d2.patch.p).toBeDefined();
    expect(d2.doc.xd).toBe(D2);
    expect((d2.doc.hist as Array<{ d: string }>).map((h) => h.d)).toEqual([D1, D2]);
  });

  it('nur freie Produktion: angetipptes err (ohne getippte Korrektur) wie `alt` – kein BKT-Schritt, Deckel bleibt frei', () => {
    const tap = c1(err, { kind: 'err', tap: 5 }, { t: T1, day: D1 }, false);
    expect(tap.free).toBe(false);
    const r = step(base('gerund-inf'), { ...tap, ext: 'c1x' });
    expect(r.patch.p).toBeUndefined();
    expect(r.patch.due).toBeUndefined();
    expect(r.patch.xd).toBeUndefined();
    expect(r.patch.n).toBe(1);
    // Danach bucht die getippte Korrektur am selben Tag die eine Wirkung.
    const typed = c1(err, { kind: 'err', tap: 5, fix: 'hearing', typed: true }, { t: T1 + 1000, day: D1 });
    expect(typed.free).toBe(true);
    const r2 = step(r.doc, { ...typed, ext: 'c1x' });
    expect(r2.patch.p as number).toBeGreaterThan(0.5);
    expect(r2.patch.xd).toBe(D1);
  });

  it('Tempo ehrlich: falsch nach der Zielzeit wie `alt` (Fehlersatz bleibt); schneller Fehler bucht BKT, legt aber keinen Fehlersatz an', () => {
    const wrong = c1(kwt, { kind: 'kwt', text: 'is said that it is' }, { t: T1, day: D1 });
    const late = step(base('passive-plus'), { ...wrong, tempo: true, ext: 'tempo', late: true });
    expect(late.patch.p).toBeUndefined();
    expect(late.patch.xd).toBeUndefined();
    expect(late.patch.errors).toEqual([expect.objectContaining({ cid: 'kwt-9001' })]);
    const fast = step(base('passive-plus'), { ...wrong, tempo: true, ext: 'tempo' });
    expect(fast.patch.p as number).toBeLessThan(0.5);
    expect(fast.patch.xd).toBe(D1);
    expect(fast.patch.errors).toBeUndefined();
    // Ohne `ext` (Tempo-Runde als Pflicht, heute nicht gebaut) gilt der alte Weg: schneller Fehler legt einen Fehlersatz an.
    const old = step(base('passive-plus'), { ...wrong, tempo: true });
    expect(old.patch.errors).toEqual([expect.objectContaining({ cid: 'kwt-9001' })]);
  });

  it('ohne BKT-Schritt springt die Anzeige-Beherrschung nicht (Verfall wird nur übernommen, `last` bleibt Idempotenz-Schlüssel)', () => {
    const old = berlin('2026-08-01', 10);
    const cur: Doc = { ...base('passive-plus'), p: 0.8, last: old, xd: D1 };
    const a: GrammarAnswer = { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }), ext: 'c1x' };
    const before = topicP('passive-plus', cur, T1);
    const r = step(cur, a);
    expect(r.doc.last).toBe(T1);
    expect(topicP('passive-plus', r.doc, T1)).toBeCloseTo(before, 12);
    // … und auch später gleich (der Verfall ist gedächtnislos).
    const later = T1 + 20 * 86_400_000;
    expect(topicP('passive-plus', r.doc, later)).toBeCloseTo(displayP(0.8, p0Of('passive-plus'), old, later), 12);
    expect(grammarWrite(r.doc, a)).toEqual({ kind: 'skip', reason: 'already_applied' });
  });

  it('`xd` wird tolerant gelesen und das Dokument bleibt gültig', () => {
    const a: GrammarAnswer = { ...c1(kwt, { kind: 'kwt', text: 'is said to be' }, { t: T1, day: D1 }), ext: 'c1x' };
    expect(extBkt({ xd: 42 }, a, true)).toBe(true);
    expect(extBkt({ xd: D1 }, a, true)).toBe(false);
    expect(extBkt({ xd: D1 }, { ...a, ext: undefined }, true)).toBe(true);
    const r = step(base('passive-plus'), a);
    expect(validateDoc('grammar/passive-plus', r.doc).ok).toBe(true);
    expect(validateDoc('grammar/passive-plus', { ...r.doc, xd: { odd: 1 } }).ok).toBe(true);
  });

  it('bktStep selbst ist unverändert (Dämpfung ±0,06, Tagesband ±0,12)', () => {
    const s = bktStep({ p: 0.5, anchor: 0.5, anchorD: D1, day: D1, ok: true, type: 'gap', helpLevel: 0 });
    expect(s.delta).toBeCloseTo(0.06, 12);
    const band = bktStep({ p: 0.62, anchor: 0.5, anchorD: D1, day: D1, ok: true, type: 'gap', helpLevel: 0 });
    expect(band.p).toBeCloseTo(0.62, 12);
  });
});

describe('M0: ein Fehler bucht nie beide Konten (kwt/err nur Grammatik, wf nur Wörter)', () => {
  const card: LexCard = { key: 'vocab/hear', kind: 'v', id: 'hear', due: 0, last: 0 };
  const ctx = { cardOf: () => card, today: D1, dayOf: () => '2026-01-01', dayEnd: T1 + 86_400_000 };

  it('Konten je Art', () => {
    expect(c1Account(kwt)).toBe('grammar');
    expect(c1Account(err)).toBe('grammar');
    expect(c1Account(wf)).toBe('word');
    expect(c1Account({ kind: 'kwt', area: 'lex' })).toBe('grammar');
    expect(c1Account({ kind: 'wf', area: 'gram' })).toBe('word');
    expect(c1Account({ kind: 'mcc', area: 'lex' })).toBe('word');
    expect(c1Account({ kind: 'ocl', area: 'gram' })).toBe('grammar');
    expect(C1_CUED.kwt && C1_CUED.wf).toBe(true);
  });

  it('kwt/err: falsch → nur ein Fehlersatz in grammar/<t>, keine Wortbuchung (auch mit `lex[]`)', () => {
    const wrongKwt = { ...kwt, lex: ['say'] } as C1Item;
    const s = scoreC1(wrongKwt, { kind: 'kwt', text: 'is said that it is', typed: true } as C1Response);
    expect(lexBookings(wrongKwt, s, 1, ctx)).toEqual([]);
    const errLex = { ...err, lex: ['hear'] } as C1Item;
    const se = scoreC1(errLex, { kind: 'err', tap: 5, fix: 'heard', typed: true } as C1Response);
    expect(lexBookings(errLex, se, 1, ctx)).toEqual([]);
    const r = step(base('gerund-inf'), { ...c1(err, { kind: 'err', tap: 5, fix: 'heard', typed: true }, { t: T1, day: D1 }), ext: 'c1x' });
    expect(r.patch.errors).toEqual([expect.objectContaining({ cid: 'err-9001' })]);
  });

  it('wf: falsch → nur die Wortkarte, nie grammar/<t> (auch wenn die Aufgabe einen Grammatik-Bereich trüge)', () => {
    const a = c1(wf, { kind: 'wf', text: 'x' }, { t: T1, day: D1 });
    expect(grammarWrite(base('gerund-inf'), { ...a, ext: 'c1x' })).toEqual({ kind: 'skip', reason: 'unknown_topic' });
    const odd = { ...wf, area: 'gram', topic: 'gerund-inf' } as C1Item;
    const a2 = bookAnswer(toTask(odd), scoreC1(odd, { kind: 'wf', text: 'x', typed: true } as C1Response), { kind: 'wf', text: 'x' }, { form: 'typed', inp: 'desk', timeMs: 6000, help: 0, lang: 'de', ctx: 'xtra', t: T1, day: D1 });
    expect(grammarWrite(base('gerund-inf'), a2)).toEqual({ kind: 'skip', reason: 'unknown_topic' });
    const s = scoreC1(wf, { kind: 'wf', text: 'x', typed: true } as C1Response);
    expect(lexBookings(wf, s, 1, ctx).length).toBeGreaterThan(0);
  });
});

describe('M0 Gleichheit im Kleinen: ohne `ext` schreibt grammarWrite wie zuvor', () => {
  it('alle Felder einer Pflicht-Antwort sind gleich, ob `xd` im Dokument steht oder nicht (außer `xd` selbst)', () => {
    const a = answer({ t: T1, day: D1, ctx: 'duty' });
    const plain = step({ p: 0.5, last: 1 }, a);
    const marked = step({ p: 0.5, last: 1, xd: D1 }, a);
    expect(marked.patch).toEqual(plain.patch);
  });
});
