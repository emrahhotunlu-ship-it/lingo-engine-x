import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../src/domain/answer/check';
import { answerDiff } from '../../src/domain/answer/diff';
import { formKind } from '../../src/domain/answer/form';
import { maskOf, slotCount } from '../../src/domain/answer/mask';
import { toUS } from '../../src/domain/answer/spelling';
import { cacheEntry, cachePatch, LOOKUP_MAX, lookupKey, readEntry } from '../../src/domain/lookup/cache';
import { posHint, resolveWord } from '../../src/domain/lookup/resolve';
import { toTrainCard } from '../../src/domain/srs/cards';
import { confidenceDots, confidenceOf } from '../../src/domain/srs/confidence';
import { acceptExamples, cardExamples, examplesPatch } from '../../src/domain/srs/examples';
import { autoGrade } from '../../src/domain/srs/grade';
import { bracketExample, displayWord, newVocabDoc, saveCardOp } from '../../src/domain/srs/newCard';
import { usSpelling } from '../../src/domain/text/lemma';
import { tokenize } from '../../src/domain/text/tokenize';
import { CARD_EXAMPLES_EXAMPLE, cardExamples as examplesTemplate } from '../../src/prompts/cardExamples';
import { cardExamplesReply } from '../../src/platform/dev/cannedReplies';
import { berlin } from './helpers';

// Trainer nach Emrahs Rückmeldung (CLAUDE.md A7): automatische Note, Sicherheit, Platzhalter,
// Formhinweis, Markierung, Beispiele, Wort-Antippen (Auflösung, Zwischenspeicher, neue Karte).

const NOW = berlin('2026-09-20', 21);
const DAY = 86_400_000;

describe('automatische Note', () => {
  it('falsch → Nochmal, Tippfehler und falsche Form → Schwer, richtig nach Zeit', () => {
    expect(autoGrade('cloze', { verdict: 'wrong' }, { submitMs: 500 })).toBe(1);
    expect(autoGrade('cloze', { verdict: 'near' }, { submitMs: 500, firstKeyMs: 200 })).toBe(2);
    expect(autoGrade('cloze', { verdict: 'correct' }, { submitMs: 2500, firstKeyMs: 1000, chars: 8 })).toBe(4);
    expect(autoGrade('cloze', { verdict: 'correct' }, { submitMs: 7000, firstKeyMs: 6000, chars: 8 })).toBe(3);
    expect(autoGrade('cloze', { verdict: 'correct' }, { submitMs: 20_000, firstKeyMs: 12_000, chars: 8 })).toBe(2);
    expect(autoGrade('mc_en', { verdict: 'correct' }, { submitMs: 2000 })).toBe(3);
  });
  it('genutzte Hilfe deckelt: Platzhalter → höchstens Gut, erster Buchstabe → höchstens Schwer', () => {
    const fast = { submitMs: 2500, firstKeyMs: 1000, chars: 8 };
    expect(autoGrade('type', { verdict: 'correct' }, { ...fast, hintLevel: 1 })).toBe(3);
    expect(autoGrade('type', { verdict: 'correct' }, { ...fast, hintLevel: 2 })).toBe(2);
    expect(autoGrade('type', { verdict: 'wrong' }, { ...fast, hintLevel: 2 })).toBe(1);
  });
});

describe('Sicherheit (fünf Punkte)', () => {
  const base = { v: 1, due: NOW, stability: 10, difficulty: 5, state: 2, reps: 5, lapses: 0, last: NOW - 10 * DAY, scheduledDays: 10, learningSteps: 0, src: 'lx' };
  it('neu, unsicher, wird fester, sicher, sehr sicher', () => {
    expect(confidenceOf({ isNew: true, stage: 0, fsrs: { ...base, state: 0 } }, NOW)).toBe(0);
    expect(confidenceOf({ isNew: false, stage: 1, fsrs: base }, NOW)).toBe(1);
    expect(confidenceOf({ isNew: false, stage: 3, fsrs: base }, NOW)).toBe(2);
    expect(confidenceOf({ isNew: false, stage: 4, fsrs: { ...base, stability: 3, last: NOW - 3 * DAY } }, NOW)).toBe(2);
    expect(confidenceOf({ isNew: false, stage: 4, fsrs: base }, NOW)).toBe(3);
    expect(confidenceOf({ isNew: false, stage: 5, fsrs: { ...base, stability: 40, last: NOW - 5 * DAY } }, NOW)).toBe(4);
    // Lange überfällig: Abrufwahrscheinlichkeit gering → unsicher, auch auf hoher Stufe.
    expect(confidenceOf({ isNew: false, stage: 5, fsrs: { ...base, stability: 2, last: NOW - 60 * DAY } }, NOW)).toBe(1);
    expect(confidenceDots(0)).toBe(1);
    expect(confidenceDots(4)).toBe(5);
  });
});

describe('Buchstaben-Platzhalter', () => {
  it('ein Platz je Buchstabe, Leerzeichen und Bindestrich sichtbar, keine Buchstaben der Lösung', () => {
    const m = maskOf('persuaded');
    expect(m).toHaveLength(9);
    expect(slotCount(m)).toBe(9);
    expect(m.every((c) => c.kind === 'slot' && !('hint' in c))).toBe(true);
    const phrase = maskOf('carry out');
    expect(slotCount(phrase)).toBe(8);
    expect(phrase[5]).toEqual({ kind: 'fixed', ch: ' ' });
    expect(maskOf('well-known')[4]).toEqual({ kind: 'fixed', ch: '-' });
    expect(maskOf("don't")[3]).toEqual({ kind: 'fixed', ch: "'" });
  });
  it('erster Buchstabe nur, wenn verlangt', () => {
    expect(maskOf('avoid', { firstLetter: true })[0]).toEqual({ kind: 'slot', hint: 'a' });
    expect(maskOf('avoid', { firstLetter: true })[1]).toEqual({ kind: 'slot' });
    expect(maskOf('avoid')[0]).toEqual({ kind: 'slot' });
  });
});

describe('Ergebnis: Form, Markierung, US-Schreibweise', () => {
  it('Formhinweis „Vergangenheit: persuaded" und weitere Formen', () => {
    expect(formKind('persuaded', 'to persuade', 'verb')).toBe('past');
    expect(formKind('went', 'go', 'verb')).toBe('past');
    expect(formKind('gone', 'go', 'verb')).toBe('pastPart');
    expect(formKind('struggling', 'to struggle', 'verb')).toBe('ing');
    expect(formKind('struggles', 'to struggle', 'verb')).toBe('third');
    expect(formKind('companies', 'company', 'noun')).toBe('plural');
    expect(formKind('children', 'child', 'noun')).toBe('plural');
    expect(formKind('better', 'good', 'adj')).toBe('comparative');
    expect(formKind('carried out', 'to carry out', 'phrasal')).toBe('past');
    expect(formKind('persuade', 'to persuade', 'verb')).toBeNull();
  });
  it('andere Form desselben Worts zählt als fast richtig (nicht als Tippfehler)', () => {
    expect(checkTyped('persuade', ['persuaded'], { lemma: 'persuade' })).toMatchObject({ verdict: 'near', kind: 'form' });
    expect(checkTyped('persuades', ['persuaded'], { lemma: 'persuade' })).toMatchObject({ verdict: 'near', kind: 'form' });
    expect(checkTyped('persuadd', ['persuaded'], { lemma: 'persuade' })).toMatchObject({ verdict: 'near', kind: 'typo' });
  });
  it('Markierung: Buchstaben bei einem Wort, Wort für Wort bei mehreren', () => {
    expect(answerDiff('persuade', 'persuaded')).toEqual([{ text: 'persuade', ok: true }]);
    expect(answerDiff('persuadet', 'persuaded')).toEqual([
      { text: 'persuade', ok: true },
      { text: 't', ok: false },
    ]);
    expect(answerDiff('carry on', 'carry out')).toEqual([
      { text: 'carry', ok: true },
      { text: ' on', ok: false },
    ]);
    expect(answerDiff('', 'x')).toEqual([]);
  });
  it('eine US-Schreibweise für Wörterbuch und Antwortprüfung', () => {
    for (const w of ['colour', 'organised', 'travelled', 'centre', 'licence', 'catalogue', 'programme', 'advise', 'exercise']) expect(toUS(w)).toBe(usSpelling(w));
    expect(toUS('lorry')).toBe('truck');
    expect(toUS('mobile phone')).toBe('cell phone');
  });
});

describe('Beispielsätze', () => {
  const doc = {
    word: 'to persuade',
    de: 'überzeugen',
    ex: 'I [persuaded] him to join the gym.',
    col: [{ p: 'persuade sb to do', de: 'jdn. überreden', gap: 'persuade', opts: [], ex: 'We tried to [persuade] the client to wait.' }],
  };
  const card = toTrainCard('persuade', doc, true, NOW);
  it('Ursprungssatz, Kollokation, KI – ohne den schon sichtbaren Satz, höchstens drei', () => {
    expect(card).not.toBeNull();
    if (!card) return;
    expect(cardExamples(card, null).map((x) => x.src)).toEqual(['origin', 'col']);
    expect(cardExamples(card, 'I persuaded him to join the gym.').map((x) => x.en)).toEqual(['We tried to persuade the client to wait.']);
    const extra = [
      { en: 'She persuaded her team to try again.', t: 1 },
      { en: 'Nobody could persuade him otherwise.', t: 1 },
    ];
    expect(cardExamples(card, null, extra)).toHaveLength(3);
  });
  it('KI-Beispiele: nur mit dem Wort, nur ergänzen, nie ersetzen', () => {
    const ok = acceptExamples('to persuade', ['She persuaded her boss.', 'This sentence lacks the word.', '[bad] persuade example here'], NOW);
    expect(ok.map((x) => x.en)).toEqual(['She persuaded her boss.', 'bad persuade example here']);
    expect(examplesPatch(doc, ok)).toEqual({ xEx: ok });
    expect(examplesPatch({ ...doc, xEx: [] }, ok)).toBeNull();
    expect(examplesPatch({ ...doc, xEx: 'kaputt' }, ok)).toBeNull();
    expect(examplesPatch(undefined, ok)).toBeNull();
  });
  it('Vorlage card-examples@1: quick, Beispiel und Adapter-Antwort bestehen das Schema', () => {
    expect(examplesTemplate.tier).toBe('quick');
    const vars = { word: 'to persuade', pos: 'verb', meaning: 'to make someone agree', sentence: 'I persuaded him.' };
    const p = examplesTemplate.build(vars);
    expect(p.split('\n')[0]).toBe('[card-examples@1]');
    expect(examplesTemplate.schema(vars).safeParse(JSON.parse(CARD_EXAMPLES_EXAMPLE)).success).toBe(true);
    expect(examplesTemplate.schema(vars).safeParse(JSON.parse(cardExamplesReply(p))).success).toBe(true);
    expect(examplesTemplate.schema(vars).safeParse({ examples: ['Wir haben ihn heute endlich überzeugt, mitzukommen.', 'Das ist ein deutscher Satz mit vielen Wörtern.'] }).success).toBe(false);
  });
});

describe('Wort-Antippen: Auflösung', () => {
  const deps = { cards: new Map(), cache: undefined, uiLang: 'de' as const };
  it('Grundform, Wörterbuch-Bedeutung und US-Lautschrift', () => {
    const r = resolveWord('persuaded', 'verb', deps);
    expect(r.headword).toBe('persuade');
    expect(r.source).toBe('dict');
    expect(r.de).toBeTruthy();
    expect(r.ipa).toMatch(/pɚ|pər/);
    expect(resolveWord('colours', null, deps).headword).toBe('color');
  });
  it('eigene Karte geht vor, Zwischenspeicher vor Wörterbuch', () => {
    const cards = new Map([['persuade', { id: 'persuade', word: 'to persuade', de: 'überreden (Karte)', def: null, pos: 'verb', stage: 3, hidden: false }]]);
    expect(resolveWord('persuaded', null, { ...deps, cards })).toMatchObject({ source: 'card', de: 'überreden (Karte)' });
    const cache = { items: { zzqx: { lemma: 'zzqx', pos: 'noun', de: 'Testwort', def: 'test', level: 'C2', note_de: 'Notiz', note_en: 'note' } } };
    expect(resolveWord('zzqx', null, { ...deps, cache })).toMatchObject({ source: 'cache', de: 'Testwort', note: 'Notiz' });
    expect(resolveWord('zzqx', null, { ...deps, cache, uiLang: 'en' }).note).toBe('note');
    expect(resolveWord('qqqzzz', null, deps).source).toBe('none');
  });
  it('Wortart aus dem Vorgänger', () => {
    const tokens = tokenize('We need the report and we report daily.');
    expect(posHint(tokens, tokens.findIndex((t) => t.text === 'report'))).toBe('noun');
    expect(posHint(tokens, tokens.findLastIndex((t) => t.text === 'report'))).toBe('verb');
  });
});

describe('Zwischenspeicher app/lookup (Format der alten App, ≤ 400)', () => {
  const out = { lemma: 'leverage', pos: 'verb', ipa: 'ˈlɛvərɪdʒ', level: 'C1', de: 'nutzen', def: 'use to advantage', ex: 'We leverage data.', sense: 's', note: 'Notiz' };
  it('anlegen, ergänzen ohne zu ersetzen, Schlüssel', () => {
    const e = cacheEntry(out, 'de', 5);
    expect(e).toMatchObject({ lemma: 'leverage', de: 'nutzen', note_de: 'Notiz', t: 5, pv: 'word-lookup@1' });
    expect(e.note_en).toBeUndefined();
    expect(cachePatch(undefined, 'leverage', e)).toEqual({ set: { items: { leverage: e } } });
    const cur = { items: { leverage: { lemma: 'leverage', pos: 'verb', de: 'hebeln', def: 'x', level: 'C1', note_de: 'alt' } } };
    const en = cacheEntry(out, 'en', 6);
    expect(cachePatch(cur, 'leverage', en)).toEqual({ update: { items: { leverage: { note_en: 'Notiz', ipa: 'ˈlɛvərɪdʒ', ex: 'We leverage data.', t: 6, pv: 'word-lookup@1' } } } });
    expect(readEntry(cur, 'leverage')?.de).toBe('hebeln');
    expect(lookupKey('Leverage')).toBe('leverage');
    expect(lookupKey('2026')).toBeNull();
  });
  it('verdrängt die ältesten, sobald es mehr als 400 wären', () => {
    const items: Record<string, unknown> = {};
    for (let i = 0; i < LOOKUP_MAX; i++) items[`w${String.fromCharCode(97 + (i % 26))}${i}`] = { lemma: 'x', de: 'y', t: 1000 + i };
    items.old = { lemma: 'old', de: 'alt' };
    items.gone = null;
    const r = cachePatch({ items }, 'neu', cacheEntry(out, 'de', 9999));
    expect(r && 'update' in r).toBe(true);
    const patch = r && 'update' in r ? (r.update.items as Record<string, unknown>) : {};
    const nulls = Object.entries(patch).filter(([, v]) => v === null).map(([k]) => k);
    expect(nulls).toEqual(['old', 'wa0']);
    expect(patch.neu).toBeTruthy();
  });
});

describe('Als Karte speichern', () => {
  const origin = { v: 1 as const, kind: 'trainer' as const, ref: 'vocab/persuade', title: 'to persuade', t: NOW };
  it('Karte mit Ursprungssatz, Verben mit „to", keine Karte ohne Satz', () => {
    const made = newVocabDoc({ word: 'gym', de: 'Fitnessstudio', pos: 'noun', ex: 'I persuaded him to join the gym.', surface: 'gym', src: 'lookup', origin, today: '2026-09-20' });
    expect(made).toMatchObject({ id: 'gym', doc: { word: 'gym', ex: 'I persuaded him to join the [gym].', state: 'new', src: 'lookup', added: '2026-09-20', origin } });
    expect(made?.doc.fsrs).toBeUndefined();
    expect(displayWord('join', 'verb')).toBe('to join');
    expect(displayWord('carry out', 'phrasal')).toBe('carry out');
    expect(bracketExample('He joined us.', 'joined', 'to join')).toBe('He [joined] us.');
    expect(newVocabDoc({ word: 'gym', de: 'x', ex: 'No match here.', src: 'lookup', origin, today: '2026-09-20' })).toBeNull();
    expect(newVocabDoc({ word: 'gym', de: '', ex: 'the gym', src: 'lookup', origin, today: '2026-09-20' })).toBeNull();
  });
  it('bestehende Karte nie ersetzen, nur fehlenden Satz ergänzen', () => {
    const made = newVocabDoc({ word: 'gym', de: 'Fitnessstudio', pos: 'noun', ex: 'Join the gym.', src: 'lookup', origin, today: '2026-09-20' });
    if (!made) throw new Error('made');
    expect(saveCardOp(undefined, made)).toEqual({ set: made.doc });
    expect(saveCardOp({ word: 'gym', ex: 'Old [gym].' }, made)).toBeNull();
    expect(saveCardOp({ word: 'gym', ex: '' }, made)).toEqual({ update: { ex: made.doc.ex, origin: made.doc.origin } });
  });
});
