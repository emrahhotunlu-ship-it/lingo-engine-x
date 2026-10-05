import { describe, expect, it } from 'vitest';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import {
  DECK_LIMITS,
  addIdsOp,
  builtinPrefOp,
  createDeckOp,
  deckCards,
  deckCounts,
  flaggedOp,
  inBuiltin,
  inboxReach,
  matchDeck,
  prefsOp,
  readDecks,
  updateDeckOp,
  visibleDecks,
} from '../../src/domain/srs/decks';
import { weekStartMs } from '../../src/domain/srs/flip';
import { forecast } from '../../src/domain/srs/forecast';
import { median, vocabStatistics } from '../../src/domain/srs/retention';
import type { TrainCard } from '../../src/domain/srs/types';
import { validateDoc } from '../../src/data/validate';
import { berlin } from './helpers';

type Doc = Record<string, unknown>;
const NOW = berlin('2026-09-28', 10);
const D = 86_400_000;
const mk = (id: string, over: Doc = {}): TrainCard =>
  toTrainCard(id, { word: id, de: `de-${id}`, def: `def ${id}`, ex: `The [${id}] matters.`, pos: 'noun', state: 'review', stage: 2, reps: 3, S: 5, D: 5, due: NOW + 3 * D, last: NOW - 2 * D, src: 'lookup', ...over }, true, NOW) as TrainCard;

/** Führt eine Op wie writer.transform aus (set = neu, update = verschmelzen). */
function run(cur: Doc | undefined, r: { op: { set: Doc } | { update: Doc } | null }): Doc | undefined {
  if (!r.op) return cur;
  return 'set' in r.op ? r.op.set : applyUpdate(cur ?? {}, r.op.update);
}

describe('matchDeck (rein)', () => {
  const now = NOW;
  it('Filter: Art, Quelle, Stufe, fällig, schwierig, Suche, IDs', () => {
    const a = mk('alpha', { src: 'preply', stage: 1 });
    const b = mk('beta', { stage: 4, due: NOW - 1000 });
    expect(matchDeck(a, { src: ['preply'] }, now)).toBe(true);
    expect(matchDeck(b, { src: ['preply'] }, now)).toBe(false);
    expect(matchDeck(b, { stage: { min: 3 } }, now)).toBe(true);
    expect(matchDeck(a, { stage: { min: 3 } }, now)).toBe(false);
    expect(matchDeck(b, { due: true }, now)).toBe(true);
    expect(matchDeck(a, { due: true }, now)).toBe(false);
    expect(matchDeck(a, { hard: true }, now)).toBe(true);
    expect(matchDeck(a, { query: 'ALP' }, now)).toBe(true);
    expect(matchDeck(a, { query: 'de-alpha' }, now)).toBe(true);
    expect(matchDeck(a, { ids: ['vocab/beta'] }, now)).toBe(false);
    expect(matchDeck(b, { ids: ['vocab/beta'] }, now)).toBe(true);
    expect(matchDeck(b, { kinds: ['chunk'] }, now)).toBe(false);
    expect(matchDeck(mk('gamma', { hidden: true }), {}, now)).toBe(false);
  });
  it('eingebaute Stapel', () => {
    const ctx = { nowMs: NOW, weekStartMs: weekStartMs(NOW) };
    expect(inBuiltin(mk('n', { state: 'new', reps: 0 }), 'inbox', ctx)).toBe(true);
    expect(inBuiltin(mk('l', { lapses: 7 }), 'leech', ctx)).toBe(true);
    expect(inBuiltin(mk('l2', { lapses: 2 }), 'leech', ctx)).toBe(false);
    expect(inBuiltin(mk('w', { hist: [{ t: NOW - 1000, g: 1, x: 'cloze' }] }), 'mistakes', ctx)).toBe(true);
    expect(inBuiltin(mk('w2', { hist: [{ t: NOW - 20 * D, g: 1, x: 'cloze' }] }), 'mistakes', ctx)).toBe(false);
    expect(inBuiltin(mk('t', { src: 'translate' }), 'src:translate', ctx)).toBe(true);
    expect(inBuiltin(mk('p', { word: 'take over' }), 'phrases', ctx)).toBe(true);
  });
  it('Zähler Neu · Lernen · Fällig', () => {
    const cards = [mk('n', { state: 'new', reps: 0 }), mk('d', { due: NOW - 1000 }), mk('f', { due: NOW + 5 * D }), mk('h', { hidden: true, state: 'new' })];
    const learning = mk('lr', { state: 'learning', due: NOW + 60_000, last: NOW - 60_000, S: 0.1 });
    const c = deckCounts([...cards, learning], NOW);
    expect(c.new).toBe(1);
    expect(c.due).toBe(1);
    expect(c.learning).toBe(learning.fsrs.state === 1 || learning.fsrs.state === 3 ? 1 : 0);
  });
  it('Reichweite Eingangskorb mit der Zahl, die wirklich kommt (Kontingent, im Alltag höchstens 5, bei Rückstand 2), Hinweis ab 30 Tagen', () => {
    expect(inboxReach(42, 5)).toEqual({ n: 42, days: 9, review: false });
    expect(inboxReach(42, 5, true)).toEqual({ n: 42, days: 21, review: false });
    expect(inboxReach(42, 2)).toEqual({ n: 42, days: 21, review: false });
    expect(inboxReach(42, 10).days).toBe(9);
    expect(inboxReach(150, 5).review).toBe(true);
    expect(inboxReach(60, 5, true).review).toBe(true);
    expect(inboxReach(10, 0).days).toBeNull();
    expect(inboxReach(0, 5).days).toBe(0);
  });
});

describe('app/decks: Schreiben mit Grenzen (data-guard 00:35)', () => {
  it('anlegen, umbenennen, Modus, Richtung, ausblenden (hidden statt löschen)', () => {
    let doc = run(undefined, createDeckOp(undefined, { id: 'u1', name: '  Beruf  ', filter: { src: ['job'] }, mode: 'flip', dir: 'en-de' }, '2026-09-28'));
    expect(doc).toBeDefined();
    expect(validateDoc('app/decks', doc).ok).toBe(true);
    doc = run(doc, updateDeckOp(doc, 'u1', { name: 'Job', mode: 'type', dir: 'mix', size: 20 }));
    doc = run(doc, updateDeckOp(doc, 'u1', { hidden: true }));
    const r = readDecks(doc);
    expect(r.decks.u1).toMatchObject({ name: 'Job', mode: 'type', dir: 'mix', size: 20, hidden: true, filter: { src: ['job'] } });
    expect(visibleDecks(r)).toHaveLength(0);
    expect(Object.keys(r.decks)).toContain('u1');
  });
  it('höchstens 40 Stapel – versteckte zählen mit', () => {
    let doc: Doc | undefined;
    for (let i = 0; i < DECK_LIMITS.decks; i++) {
      doc = run(doc, createDeckOp(doc, { id: `u${i}`, name: `S${i}`, filter: {} }, '2026-09-28'));
      if (i % 2) doc = run(doc, updateDeckOp(doc, `u${i}`, { hidden: true }));
    }
    const over = createDeckOp(doc, { id: 'u99', name: 'zu viel', filter: {} }, '2026-09-28');
    expect(over).toEqual({ op: null, error: 'limit_decks' });
  });
  it('≤ 500 IDs je Stapel, ≤ 2.000 gesamt, flagged ≤ 200', () => {
    let doc = run(undefined, createDeckOp(undefined, { id: 'u1', name: 'A', filter: {} }, '2026-09-28'));
    const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `vocab/${p}${i}`);
    expect(addIdsOp(doc, 'u1', ids(501, 'a')).error).toBe('limit_ids');
    doc = run(doc, addIdsOp(doc, 'u1', ids(500, 'a')));
    for (let k = 2; k <= 4; k++) {
      doc = run(doc, createDeckOp(doc, { id: `u${k}`, name: `S${k}`, filter: {} }, '2026-09-28'));
      doc = run(doc, addIdsOp(doc, `u${k}`, ids(500, `k${k}`)));
    }
    doc = run(doc, createDeckOp(doc, { id: 'u5', name: 'S5', filter: {} }, '2026-09-28'));
    expect(addIdsOp(doc, 'u5', ['vocab/one']).error).toBe('limit_ids');
    let f: Doc | undefined = { v: 1 };
    for (let i = 0; i < DECK_LIMITS.flagged; i++) f = run(f, flaggedOp(f, `vocab/f${i}`, true));
    expect(flaggedOp(f, 'vocab/zz', true).error).toBe('limit_flagged');
    expect(run(f, flaggedOp(f, 'vocab/f0', false))?.flagged).toHaveLength(DECK_LIMITS.flagged - 1);
  });
  it('> 64 KiB → Hinweis statt Schreiben', () => {
    const cur: Doc = { v: 1, decks: { u1: { name: 'A', order: 1, created: 'x', filter: { query: 'x'.repeat(66_000) } } } };
    expect(updateDeckOp(cur, 'u1', { name: 'B' }).error).toBe('too_big');
  });
  it('ungültiges Dokument wird nie angefasst', () => {
    expect(prefsOp({ v: 1, decks: 'kaputt' }, { dir: 'de-en' }).error).toBe('invalid');
  });
  it('Einstellungen und eingebaute Stapel: Patch nur der Felder', () => {
    let doc = run(undefined, prefsOp(undefined, { mode: 'flip', dir: 'de-en', grades: 2 }));
    doc = run(doc, builtinPrefOp(doc, 'job', { mode: 'type', dir: 'en-de' }));
    const r = readDecks(doc);
    expect(r.prefs).toEqual({ mode: 'flip', dir: 'de-en', grades: 2 });
    expect(r.builtin.job).toEqual({ mode: 'type', dir: 'en-de' });
    const same = prefsOp(doc, { mode: 'flip' });
    expect(same.op).toBeNull();
  });
  it('deckCards: eigen per Filter, eingebaut per Regel', () => {
    const cards = [mk('a', { src: 'preply' }), mk('b')];
    const doc = readDecks(run(undefined, createDeckOp(undefined, { id: 'u1', name: 'P', filter: { src: ['preply'] } }, 'x')));
    const ctx = { nowMs: NOW, weekStartMs: weekStartMs(NOW) };
    expect(deckCards(cards, 'u1', doc, ctx).map((c) => c.id)).toEqual(['a']);
    expect(deckCards(cards, 'src:preply', doc, ctx).map((c) => c.id)).toEqual(['a']);
    expect(deckCards(cards, 'all', doc, ctx)).toHaveLength(2);
    expect(deckCards(cards, 'nix', doc, ctx)).toHaveLength(0);
  });
});

describe('Prognose und Statistik (N27)', () => {
  it('7 Tage ab morgen, 04:00-Regel', () => {
    const cards = [mk('a', { due: berlin('2026-09-29', 12) }), mk('b', { due: berlin('2026-09-30', 3) }), mk('c', { due: NOW - D }), mk('n', { state: 'new', reps: 0 })];
    const f = forecast(cards, NOW);
    expect(f).toHaveLength(7);
    expect(f[0]).toEqual({ day: '2026-09-29', n: 2 });
    expect(f.reduce((a, x) => a + x.n, 0)).toBe(2);
  });
  it('Statistik: Quote, Zustände, Median, sichere', () => {
    const cards = [
      mk('a', { S: 30, stage: 5, hist: [{ t: NOW - 12 * D, g: 3, x: 'cloze' }, { t: NOW - 2 * D, g: 3, x: 'cloze' }, { t: NOW - 2 * D + 1000, g: 1, x: 'cloze' }] }),
      mk('b', { S: 3, hist: [{ t: NOW - 13 * D, g: 3, x: 'flip' }, { t: NOW - 3 * D, g: 1, x: 'flip' }] }),
      mk('c', { state: 'new', reps: 0 }),
      mk('d', { S: 10, hist: [{ t: NOW - 40 * D, g: 1, x: 'flip' }] }),
    ];
    const s = vocabStatistics(cards, NOW);
    // Behaltensquote 28 Tage (domain/metrics): erste Antwort je Karte und Tag nach mindestens 7 Tagen Pause.
    expect(s.answers).toBe(2);
    expect(s.retention).toBe(0.5);
    expect(s.byState.new).toBe(1);
    expect(s.byState.mature).toBe(1);
    expect(s.total).toBe(4);
    expect(s.medianStability).toBe(10);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
