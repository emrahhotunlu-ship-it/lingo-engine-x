import { describe, expect, it } from 'vitest';
import { bank, lookupWord } from '../../src/bank/words';
import { distractors, gapIn, viewOf } from '../../src/coach/cardView';
import { dueIds, formatFor, introducedCard, newCandidates, Session } from '../../src/coach/session';
import { inputHours, stubborn } from '../../src/coach/derived';
import { placeholderForms } from '../../src/coach/phrases';
import { lessonKey, prepData, prepText, recentLessons, validMinutes, weekStats } from '../../src/coach/preply';
import { resetCoach } from '../../src/coach/store';
import {
  bankCard,
  defaultFilter,
  duplicateFinder,
  filterRows,
  hiddenCard,
  markedKnown,
  nextLabel,
  ownCard,
  parseWordLines,
  planOwnWords,
  sortRows,
  vocabRows,
  vocabStats,
  type VocabFilter,
} from '../../src/coach/vocab';
import { questions } from '../../src/screens/BlitzScreen';
import type { CardRec, InLog, Placement, ProfileDoc } from '../../src/coach/types';

const NOW = Date.parse('2026-10-04T10:00:00+02:00');
const DAY = 86_400_000;

/** Eine geübte Karte (Review-Zustand) mit frei wählbaren Werten. */
function card(extra: Partial<CardRec> & { due?: number; stability?: number; last?: number | null } = {}): CardRec {
  const { due = NOW + 3 * DAY, stability = 5, last = NOW - 2 * DAY, ...rest } = extra;
  const f = { v: 1, due, stability, difficulty: 5, state: 2, reps: 3, lapses: 0, last, scheduledDays: 3, learningSteps: 0, src: 'lx' };
  return { src: 'bank', f, lv: 2, add: NOW - 20 * DAY, ...rest };
}
const user = (w: string, de: string, extra: Parameters<typeof card>[0] = {}): CardRec => ({ ...card(extra), src: 'user', w, de });

// Nach der Regel „sth/sb steht für beliebige Wörter" prüfen, ob die Wendung wörtlich im Satz steht.
function inSentence(phrase: string, sentence: string): boolean {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = phrase
    .split(/\s+/)
    .map((tok) => (tok === 'sth' || tok === 'sb' ? '\\S+(?:\\s+\\S+){0,4}?' : esc(tok)))
    .join('\\s+');
  return new RegExp(pattern, 'i').test(sentence);
}

describe('Business-Wendungen in der Bank', () => {
  const phrases = bank().phrasal.filter((p) => p.i.startsWith('ph-'));

  it('120 bis 160 Wendungen mit eindeutigen Kennungen, die nicht mit Wörtern kollidieren', () => {
    expect(phrases.length).toBeGreaterThanOrEqual(120);
    expect(phrases.length).toBeLessThanOrEqual(160);
    expect(new Set(phrases.map((p) => p.i)).size).toBe(phrases.length);
    const wordIds = new Set(bank().words.map((w) => w.i));
    for (const p of phrases) expect(wordIds.has(p.i), p.i).toBe(false);
    expect(new Set(phrases.map((p) => p.w.toLowerCase())).size).toBe(phrases.length);
  });

  it('jede Wendung hat Bedeutung, Erklärung, Rang 2.500–6.000, 2–7 Wörter und zwei Beispielsätze', () => {
    for (const p of phrases) {
      expect(p.p, p.i).toBe('phr');
      expect(p.l, p.i).toEqual(['business']);
      expect(p.r, p.i).toBeGreaterThanOrEqual(2500);
      expect(p.r, p.i).toBeLessThanOrEqual(6000);
      expect(p.w.split(/\s+/).length, p.w).toBeGreaterThanOrEqual(2);
      expect(p.w.split(/\s+/).length, p.w).toBeLessThanOrEqual(7);
      expect(p.de.trim(), p.i).not.toBe('');
      expect(p.en.trim(), p.i).not.toBe('');
      expect(p.ex?.length, p.i).toBe(2);
      for (const [en, de] of p.ex ?? []) {
        expect(en.trim(), p.i).not.toBe('');
        expect(de.trim(), p.i).not.toBe('');
      }
    }
  });

  it('die deutsche Bedeutung ist eindeutig: keine zwei Wendungen teilen sich die erste Bedeutung, kein Satzteil wird abgeschnitten', () => {
    const firsts = phrases.map((p) => (p.de.split(', ')[0] ?? '').toLowerCase());
    const dup = firsts.filter((f, i) => firsts.indexOf(f) !== i);
    expect(dup).toEqual([]);
    for (const p of phrases) expect(p.de.split(', ')[0], p.w).not.toMatch(/(\b(dass|ob|aber|und|das|der|die)|…)$/);
  });

  it('jede Wendung kommt wörtlich in mindestens einem Beispielsatz vor', () => {
    for (const p of phrases) expect(p.ex?.some(([en]) => inSentence(p.w, en)), `${p.w}: ${p.ex?.map((e) => e[0]).join(' | ')}`).toBe(true);
  });

  it('amerikanische Schreibweise in den Beispielen', () => {
    const british = /\b(whilst|colour|favour|organis|programme|realis|centre|licence|cheers|reckon)\w*/i;
    for (const p of phrases) for (const [en] of p.ex ?? []) expect(british.test(en), en).toBe(false);
  });

  it('sind normale Karten: Ansicht, keine Lücke, drei Ablenker aus der eigenen Gruppe', () => {
    const p = phrases.find((x) => x.w === 'take sth into account')!;
    const v = viewOf(p.i)!;
    expect(v.word).toBe('take sth into account');
    expect(v.pos).toBe('phr');
    expect(v.business).toBe(true);
    expect(gapIn(v)).toBeNull();
    const d = distractors(v);
    expect(d).toHaveLength(3);
    expect(d).not.toContain(v.de.split(', ')[0]);
    expect(distractors(v)).toEqual(d);
    // auch Phrasal Verben bekommen jetzt Ablenker (vorher gab es keine)
    const pv = bank().phrasal.find((x) => x.p === 'pv')!;
    expect(distractors(viewOf(pv.i)!)).toHaveLength(3);
  });

  it('die Abfrageart passt: ohne Lücke nur Auswahl, freies Abrufen und Hören', () => {
    const p = phrases[10]!;
    for (let reps = 0; reps < 30; reps++) {
      for (let lv = 0; lv <= 4; lv++) {
        const f = formatFor(p.i, { ...introducedCard(NOW), lv, f: { ...introducedCard(NOW).f, reps } });
        expect(['choose', 'recall', 'listen'], `${lv}/${reps}`).toContain(f);
      }
    }
  });

  it('tauchen als neue Karten zwischen den Wörtern auf', () => {
    const gen = newCandidates(new Map());
    let seen = 0;
    for (let i = 0; i < 4000; i++) {
      const r = gen.next();
      if (r.done) break;
      if (r.value.id.startsWith('ph-')) seen++;
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('sth und sb: ausgeschrieben getippt gilt auch als richtig', () => {
    expect(placeholderForms('take sth into account')).toEqual(['take sth into account', 'take something into account']);
    expect(placeholderForms('give sb an overview of sth')).toContain('give someone an overview of something');
    expect(placeholderForms('negotiate')).toEqual(['negotiate']);
  });

  it('das Wörterbuch findet Wendungen auch über den englischen Wortlaut', () => {
    expect(lookupWord('take sth into account')[0]?.i).toBe('ph-take-sth-into-account');
    expect(lookupWord('berücksichtigen').map((w) => w.i)).toContain('ph-take-sth-into-account');
  });
});

describe('Liste: Filter, Suche, Sortierung', () => {
  const cards = new Map<string, CardRec>([
    ['negotiate', card({ lv: 3, last: NOW - 1 * DAY })],
    ['reliable', card({ lv: 1, due: NOW - DAY, bad: 3, stability: 1, last: NOW - 5 * DAY })],
    ['executive', { ...card({ lv: 0 }), f: { ...card().f, state: 0, reps: 0, last: null, stability: 0 }, add: NOW - 40 * DAY }],
    ['zebra-x', user('Überlastung', 'overload', { lv: 4, last: NOW - 30 * DAY })],
    ['ch-touch', { ...card({ lv: 2, last: NOW - 10 * DAY }), src: 'legacy', w: 'to touch base', de: 'sich kurz abstimmen' }],
    ['have-on', card({ lv: 2, hide: 1 })],
  ]);
  const rows = vocabRows(cards);
  const f = (patch: Partial<VocabFilter>): VocabFilter => ({ ...defaultFilter(), ...patch });
  const ids = (patch: Partial<VocabFilter>) => sortRows(filterRows(rows, f(patch), NOW), patch.sort ?? 'recent').map((r) => r.id);

  it('zeigt Wort und Bedeutung aus Bank, alter App und eigenen Karten', () => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('negotiate')?.de).toMatch(/verhandeln/);
    expect(byId.get('zebra-x')).toMatchObject({ word: 'Überlastung', de: 'overload', src: 'user' });
    expect(byId.get('ch-touch')).toMatchObject({ word: 'to touch base', src: 'legacy' });
  });

  it('sucht Englisch und Deutsch, ohne Beachtung von Groß-/Kleinschreibung und Akzenten', () => {
    expect(ids({ query: 'NEGOTI' })).toEqual(['negotiate']);
    expect(ids({ query: 'verhandeln' })).toContain('negotiate');
    expect(ids({ query: 'uberlast' })).toEqual(['zebra-x']);
    expect(ids({ query: 'abstimmen' })).toEqual(['ch-touch']);
    expect(ids({ query: 'gibtesnicht' })).toEqual([]);
  });

  it('filtert nach Sicherheit, fällig, Herkunft und gesperrt', () => {
    expect(ids({ level: 3 })).toEqual(['negotiate']);
    expect(ids({ level: 0 })).toEqual(['executive']);
    expect(ids({ due: true })).toEqual(['reliable']); // die neue, nie geübte Karte ist nicht „fällig"
    expect(ids({ origin: 'user' })).toEqual(['zebra-x']);
    expect(ids({ origin: 'legacy' })).toEqual(['ch-touch']);
    expect(ids({ origin: 'bank' }).sort()).toEqual(['executive', 'negotiate', 'reliable']);
    expect(ids({ hidden: true })).toEqual(['have-on']);
    expect(ids({}).includes('have-on')).toBe(false);
  });

  it('sortiert: zuletzt gelernt, alphabetisch (ohne „to"), am unsichersten zuerst', () => {
    expect(ids({ sort: 'recent' })).toEqual(['negotiate', 'reliable', 'ch-touch', 'zebra-x', 'executive']);
    expect(ids({ sort: 'alpha' })).toEqual(['executive', 'negotiate', 'reliable', 'ch-touch', 'zebra-x']);
    expect(ids({ sort: 'weak' })).toEqual(['executive', 'reliable', 'ch-touch', 'negotiate', 'zebra-x']);
  });

  it('Zähler: gesperrte zählen nicht mit', () => {
    expect(vocabStats(rows, NOW)).toEqual({ total: 5, solid: 2, due: 1, hidden: 1 });
  });

  it('nächster Termin', () => {
    expect(nextLabel({ state: 0, due: NOW }, NOW)).toEqual({ kind: 'none' });
    expect(nextLabel({ state: 2, due: NOW - 1 }, NOW)).toEqual({ kind: 'due' });
    expect(nextLabel({ state: 2, due: NOW + 3 * 3_600_000 }, NOW)).toEqual({ kind: 'today' });
    expect(nextLabel({ state: 2, due: NOW + DAY }, NOW)).toEqual({ kind: 'tomorrow' });
    expect(nextLabel({ state: 2, due: NOW + 6 * DAY }, NOW)).toEqual({ kind: 'days', n: 6 });
  });

  it('sechstausend Karten werden gefiltert und sortiert, ohne dass es merklich dauert', () => {
    const many = new Map<string, CardRec>();
    for (let i = 0; i < 6000; i++) many.set(`w${i}`, user(`word${i}`, `Wort ${i}`, { lv: i % 5, last: NOW - (i % 90) * DAY }));
    const t0 = performance.now();
    const all = vocabRows(many);
    const out = sortRows(filterRows(all, f({ query: 'wort 12', level: 'all' }), NOW), 'weak');
    const ms = performance.now() - t0;
    expect(out.length).toBeGreaterThan(5);
    expect(ms).toBeLessThan(500);
  });
});

describe('„Nicht mehr üben": gesperrte Karten werden übersprungen', () => {
  const hidden = card({ due: NOW - DAY, hide: 1 });
  const open = card({ due: NOW - 2 * DAY });

  it('dueIds und Planung', () => {
    const cards = new Map([['a', hidden], ['b', open]]);
    expect(dueIds(cards, NOW)).toEqual(['b']);
  });

  it('neue Wörter: eine gesperrte, nie geübte Karte kommt nicht als Kandidat zurück', () => {
    const fresh = (hide?: 0 | 1): CardRec => ({ ...introducedCard(NOW), src: 'user', w: 'nixwort', de: 'x', ...(hide === undefined ? {} : { hide }) });
    const first = (cards: Map<string, CardRec>) => newCandidates(cards).next().value?.id;
    expect(first(new Map([['nixwort', fresh()]]))).toBe('nixwort');
    expect(first(new Map([['nixwort', fresh(1)]]))).not.toBe('nixwort');
  });

  it('Einheit: wird eine Karte mitten in der Einheit gesperrt, kommt sie nicht mehr dran', () => {
    const cards = new Map<string, CardRec>([
      ['a', card({ due: NOW - 3 * DAY })],
      ['b', card({ due: NOW - 2 * DAY })],
      ['c', card({ due: NOW - DAY })],
    ]);
    const s = new Session({ cards, nowMs: NOW, newPerDay: 0, today: { min: 0, ans: 0, ok: 0, nw: 0 } });
    expect(s.next(cards)).toMatchObject({ id: 'a' });
    const after = new Map(cards).set('b', hiddenCard(cards.get('b')!, true));
    const rest: string[] = [];
    for (let step = s.next(after); step; step = s.next(after)) rest.push(step.id);
    expect(rest).toEqual(['c']);
  });

  it('Blitzrunde nimmt keine gesperrten Karten', () => {
    const cards = new Map<string, CardRec>();
    const ids = bank().words.slice(0, 40).map((w) => w.i);
    for (const [i, id] of ids.entries()) cards.set(id, card({ lv: 3, ...(i < 20 ? { hide: 1 as const } : {}) }));
    resetCoach({ status: 'ready', cards });
    const asked = questions('2026-10-04').map((q) => q.view.id);
    expect(asked.length).toBeGreaterThan(5);
    for (const id of asked) expect(cards.get(id)?.hide).not.toBe(1);
    resetCoach();
  });

  it('hartnäckige Wörter lassen gesperrte aus', () => {
    const cards = new Map<string, CardRec>([['a', card({ lv: 0, bad: 5, hide: 1 })], ['b', card({ lv: 0, bad: 3 })]]);
    expect(stubborn(cards)).toEqual(['b']);
  });

  it('sperren und freigeben ändern nur `hide` (die Karte bleibt vollständig)', () => {
    const c = card({ lv: 2, ok: 4, bad: 1 });
    const h = hiddenCard(c, true);
    expect(h).toEqual({ ...c, hide: 1 });
    expect(hiddenCard(h, false)).toEqual({ ...c, hide: 0 });
  });
});

describe('Als bekannt markieren', () => {
  it('Stufe und Planung wie beim Sortieren', () => {
    const k = markedKnown(introducedCard(NOW), NOW);
    expect(k).toMatchObject({ lv: 3, known: 1 });
    expect(k.f.state).not.toBe(0);
    expect(k.f.due).toBeGreaterThan(NOW);
  });

  it('verschlechtert eine längere Planung nicht', () => {
    const strong = card({ lv: 2, stability: 120, due: NOW + 100 * DAY });
    const k = markedKnown(strong, NOW);
    expect(k.f).toEqual(strong.f);
    expect(k.lv).toBe(3);
  });

  it('neue Karte für ein Bank-Wort ohne Karte', () => {
    expect(bankCard(NOW, { known: true })).toMatchObject({ src: 'bank', lv: 3, known: 1 });
    expect(bankCard(NOW, { hide: true })).toMatchObject({ src: 'bank', lv: 0, hide: 1 });
    expect(bankCard(NOW).hide).toBeUndefined();
  });
});

describe('Eigene Wörter und Duplikate', () => {
  const cards = new Map<string, CardRec>([
    ['negotiate', card()],
    ['ch-touch', { ...card(), src: 'legacy', w: 'to touch base', de: 'sich kurz abstimmen' }],
    ['ph-take-sth-into-account', card()],
  ]);
  const find = duplicateFinder(cards);

  it('legt eine eigene Karte mit Kennung aus dem Wort an', () => {
    const [id, rec] = ownCard({ en: '  to  Roll  out ', de: ' einführen ', ex: 'We roll out in May.' }, NOW)!;
    expect(id).toBe('roll-out');
    expect(rec).toMatchObject({ src: 'user', w: 'to Roll out', de: 'einführen', ex: 'We roll out in May.', lv: 0 });
    expect(rec.f.state).toBe(0);
    expect(ownCard({ en: 'word', de: '' }, NOW)).toBeNull();
    expect(ownCard({ en: '', de: 'x' }, NOW)).toBeNull();
    expect(ownCard({ en: '###', de: 'x' }, NOW)).toBeNull();
  });

  it('erkennt Duplikate: Karte, alte Karte mit anderer Kennung, Bank-Wort, Bank-Wendung', () => {
    expect(find('negotiate')).toEqual({ kind: 'card', id: 'negotiate' });
    expect(find('To Negotiate')).toEqual({ kind: 'card', id: 'negotiate' });
    expect(find('touch base')).toEqual({ kind: 'card', id: 'ch-touch' });
    expect(find('executive')).toEqual({ kind: 'bank', id: 'executive' });
    expect(find('take sth into account')).toEqual({ kind: 'card', id: 'ph-take-sth-into-account' });
    expect(find('keep sb posted')).toEqual({ kind: 'bank', id: 'ph-keep-sb-posted' });
    expect(find('flibbertigibbet')).toBeNull();
  });

  it('mehrere Zeilen: Duplikate und Doppelte in der Eingabe werden gemeldet, nichts doppelt angelegt', () => {
    const plan = planOwnWords(
      [
        { en: 'flibbertigibbet', de: 'Plappermaul' },
        { en: 'Flibbertigibbet', de: 'nochmal' },
        { en: 'negotiate', de: 'verhandeln' },
        { en: 'executive', de: 'Führungskraft' },
        { en: 'zork', de: '' },
      ],
      cards,
      NOW,
    );
    expect(plan.create.map(([id]) => id)).toEqual(['flibbertigibbet']);
    expect(plan.duplicates.map((d) => `${d.word}:${d.dup.kind}`)).toEqual(['Flibbertigibbet:card', 'negotiate:card', 'executive:bank']);
    expect(plan.invalid).toEqual(['zork']);
  });
});

describe('Zeilen nach der Preply-Stunde', () => {
  it('liest „Wort – Bedeutung" mit verschiedenen Trennern und Aufzählungszeichen', () => {
    const r = parseWordLines(
      ['negotiate – verhandeln', '- take sth into account - etw. beachten', '• hedge: absichern', '3. leverage = Hebelwirkung', 'state-of-the-art – neuester Stand', 'run the numbers; durchrechnen'].join('\n'),
    );
    expect(r.bad).toEqual([]);
    expect(r.words).toEqual([
      { en: 'negotiate', de: 'verhandeln' },
      { en: 'take sth into account', de: 'etw. beachten' },
      { en: 'hedge', de: 'absichern' },
      { en: 'leverage', de: 'Hebelwirkung' },
      { en: 'state-of-the-art', de: 'neuester Stand' },
      { en: 'run the numbers', de: 'durchrechnen' },
    ]);
  });

  it('Zeilen ohne Bedeutung werden gemeldet, leere Zeilen übergangen', () => {
    const r = parseWordLines('\n  \nonlyword\nword –\n– nur Deutsch\nok – gut\r\n');
    expect(r.words).toEqual([{ en: 'ok', de: 'gut' }]);
    expect(r.bad).toEqual(['onlyword', 'word –', '– nur Deutsch']);
  });

  it('Dauer: 5 bis 240 Minuten', () => {
    expect(validMinutes(45)).toBe(45);
    expect(validMinutes(' 90 ')).toBe(90);
    for (const bad of [0, 4, 241, 12.5, '', 'abc', -30]) expect(validMinutes(bad), String(bad)).toBeNull();
  });
});

describe('Vorbereitungstext für den Lehrer', () => {
  const placement: Placement = { at: NOW - 40 * DAY, size: 4200, bands: [], falseAlarm: 0, grammar: { articles: 0.3, 'past-simple-perfect': 0.4, 'pres-simple-cont': 0.95 }, level: 'B2' };
  const profile: ProfileDoc = { v: 1, created: 0, newPerDay: 10, placement };
  const cards = new Map<string, CardRec>();
  for (const [id, bad] of [['negotiate', 6], ['reliable', 5], ['executive', 4]] as const) cards.set(id, card({ lv: 0, bad }));
  cards.set('zz-own', user('hedge', 'absichern', { lv: 1, bad: 3 }));
  const inlog: InLog = {
    it: {
      a: { d: '2026-10-03', m: 8, t: 'Why AI chips are so hard to make', s: 'The Verge' },
      b: { d: '2026-09-20', m: 8, t: 'Zu alt für die Liste', s: 'Old' },
      c: { d: '2026-10-01', m: 9, t: 'Football finance explained' },
    },
    own: {},
  };
  const data = prepData({ cards, profile, grammar: undefined, inlog, today: '2026-10-04' });

  it('sammelt hartnäckige Wörter, schwächste Themen und Input der letzten sieben Tage', () => {
    expect(data.level).toBe('B2');
    expect(data.words.map((w) => w.word)).toEqual(['negotiate', 'reliable', 'executive', 'hedge']);
    expect(data.grammar).toHaveLength(3);
    expect(data.read.map((r) => r.title)).toEqual(['Why AI chips are so hard to make', 'Football finance explained']);
  });

  it('höchstens acht Wörter', () => {
    const lots = new Map<string, CardRec>();
    for (let i = 0; i < 20; i++) lots.set(`w${i}`, user(`word${i}`, `Wort ${i}`, { lv: 0, bad: 2 + i }));
    expect(prepData({ cards: lots, profile, grammar: undefined, inlog, today: '2026-10-04' }).words).toHaveLength(8);
  });

  it('deutsche Oberfläche: deutscher Teil und englischer Teil für den Lehrer', () => {
    const text = prepText(data, 'de');
    expect(text).toContain('Vorbereitung auf meine Preply-Stunde, 4. Oktober 2026');
    expect(text).toContain('• negotiate – verhandeln');
    expect(text).toContain('Für meinen Lehrer, auf Englisch');
    expect(text).toContain('Preparation for my Preply lesson, October 4, 2026');
    expect(text).toContain('Words I keep getting wrong:');
    expect(text).toContain('• Why AI chips are so hard to make (The Verge)');
    expect(text).not.toMatch(/undefined|NaN|\{\w+\}/);
  });

  it('englische Oberfläche: nur der englische Brief', () => {
    const text = prepText(data, 'en');
    expect(text.startsWith('Preparation for my Preply lesson')).toBe(true);
    expect(text).not.toContain('Vorbereitung');
    expect(text).toContain('My level: B2');
  });

  it('ohne Daten bleibt ein brauchbarer kurzer Brief', () => {
    const empty = prepData({ cards: new Map(), profile: null, grammar: undefined, inlog: { it: {}, own: {} }, today: '2026-10-04' });
    expect(empty.words).toEqual([]);
    const text = prepText(empty, 'en');
    expect(text).toContain('Hi!');
    expect(text).not.toContain('Words I keep getting wrong');
  });
});

describe('Preply-Stunden zählen nur als Extra', () => {
  const preply = {
    'k1': { d: '2026-10-05', min: 60, n: 3 }, // Montag
    'k2': { d: '2026-10-07', min: 45, n: 0 }, // Mittwoch
    'k3': { d: '2026-09-30', min: 30, n: 2 }, // Vorwoche
  };
  const emptyLog = { it: {}, own: {} };

  it('Stunden in dieser Woche (Montag bis Sonntag)', () => {
    expect(weekStats(preply, '2026-10-08')).toEqual({ count: 2, min: 105 });
    expect(weekStats(preply, '2026-10-12')).toEqual({ count: 0, min: 0 });
  });

  it('erhöhen die Input-Stunden des Fahrplans', () => {
    expect(inputHours(emptyLog, '2026-10-08')).toBe(0);
    expect(inputHours(emptyLog, '2026-10-08', preply)).toBe(2.3);
    const withInput = { it: { a: { d: '2026-10-06', m: 30 } }, own: {} };
    expect(inputHours(withInput, '2026-10-08', preply)).toBe(2.8);
  });

  it('berühren Pflicht und Serie nicht: der Tageswert bleibt unangetastet', async () => {
    const { streakOf, isCore } = await import('../../src/coach/derived');
    const days = { '2026-10-08': { min: 0, ans: 0, ok: 0, nw: 0 } };
    expect(isCore(days['2026-10-08'], false)).toBe(false);
    expect(streakOf(days, [], '2026-10-08').todayDone).toBe(false);
  });

  it('Schlüssel je Stunde sind verschieden, die letzten Stunden stehen vorn', () => {
    expect(lessonKey('2026-10-05', 1)).not.toBe(lessonKey('2026-10-05', 2));
    expect(recentLessons(preply, 2).map(([k]) => k)).toEqual(['k2', 'k1']);
  });
});
