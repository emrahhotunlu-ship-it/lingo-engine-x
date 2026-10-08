import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chapterById, liveTopics, programChapters } from '../../src/domain/c1/chapters';
import { appendGate, saveGate } from '../../src/domain/c1/gate/save';
import { gateEntry, gateOutcome, nextTryAfter } from '../../src/domain/c1/gate/score';
import { correctSentence, gatePair, gatePoolOf, gateRound, isGateItem } from '../../src/domain/c1/gate/select';
import { attemptsOf, firstReadyGate, gateStatus, grammarThreshold, retryFrom, type GateStatus } from '../../src/domain/c1/gate/trigger';
import { chapterState } from '../../src/domain/c1/state';
import { emptyC1, type C1Gate } from '../../src/domain/c1/c1doc';
import { c1File } from '../../src/domain/c1x/schema';
import { isFull, scoreC1 } from '../../src/domain/c1x/score';
import { solutionsOf } from '../../src/domain/c1x/solutions';
import type { C1Item } from '../../src/domain/c1x/types';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { chapterWords, checkGateWord, maskedSentence } from '../../src/domain/c1/gate/words';
import type { TrainCard } from '../../src/domain/srs/types';

// Kapitelprüfung (Lernplattform 3.0 §4.4, P42/P43): Auslöser und Wertung sind reine Funktionen, der Vorrat ist vollständig und mischt die Arten.

const TODAY = '2026-10-08';
const NOW = Date.parse('2026-10-08T09:00:00+02:00');
const DAY = 86_400_000;

type Doc = Record<string, unknown>;

/** Dokument eines Themas: alle Muster sicher, Einführung am Tag `intro`, Beherrschung `p`. */
function topicDoc(topic: string, o: { intro?: string; p?: number; started?: boolean } = {}): Doc {
  const pats: Record<string, unknown> = {};
  for (const p of patternsOf(topic)?.patterns ?? []) {
    pats[p.id] = { n: 3, c: 3, last: NOW - DAY, h: 0, r: 3, k: 2, dd: ['2026-10-05', '2026-10-06'], i: o.intro ?? '2026-08-01', s: '2026-10-06' };
  }
  return { n: 9, c: 8, p: o.p ?? 0.8, last: NOW - DAY, hist: [{ d: o.intro ?? '2026-08-01' }], pats };
}

function docsFor(ch: number, o: { intro?: string; p?: number; skip?: string[] } = {}): Map<string, Doc> {
  const chp = programChapters()[ch - 1];
  const m = new Map<string, Doc>();
  for (const t of liveTopics(chp!)) if (!(o.skip ?? []).includes(t)) m.set(t, topicDoc(t, o));
  return m;
}

const statusOf = (ch: number, docs: Map<string, Doc>, gates: C1Gate[] = [], today = TODAY): GateStatus => {
  const chapter = chapterState({ docs, today, nowMs: NOW }).chapters[ch - 1];
  if (!chapter) throw new Error('Kapitel fehlt');
  return gateStatus({ chapter, docs, gates, today, nowMs: NOW });
};

const gate = (d: string, ch: number, ok: boolean, g: [number, number] = [10, 14], w: [number, number] = [5, 8]): C1Gate => ({ d, ch, g, w, ok });

describe('Auslöser (reine Funktion)', () => {
  it('bereit: alle Themen eingeführt, letzte Einführung ≥ 14 Tage her, jedes Thema p ≥ 0,6', () => {
    expect(statusOf(1, docsFor(1)).state).toBe('ready');
  });
  it('gesperrt, solange nicht alle Themen eingeführt sind', () => {
    const s = statusOf(1, docsFor(1, { skip: ['past-perfect'] }));
    expect(s).toMatchObject({ state: 'locked', why: 'topics' });
  });
  it('gesperrt, wenn die letzte Einführung weniger als 14 Tage her ist; nennt den frühesten Tag', () => {
    const s = statusOf(1, docsFor(1, { intro: '2026-09-30' }));
    expect(s).toMatchObject({ state: 'locked', why: 'settle', from: '2026-10-14' });
    expect(statusOf(1, docsFor(1, { intro: '2026-09-24' })).state).toBe('ready'); // genau 14 Tage
    expect(statusOf(1, docsFor(1, { intro: '2026-09-25' })).state).toBe('locked'); // 13 Tage
  });
  it('gesperrt, wenn ein Thema unter p 0,6 liegt; nennt die schwachen Themen', () => {
    const docs = docsFor(1);
    docs.set('used-to', topicDoc('used-to', { p: 0.5 }));
    const s = statusOf(1, docs);
    expect(s).toMatchObject({ state: 'locked', why: 'strength', weak: ['used-to'] });
  });
  it('Kapitel ohne Inhalte ist nie bereit', () => {
    const s = statusOf(7, new Map());
    expect(s.state).toBe('locked');
  });
  it('bestanden bleibt bestanden; die Prüfung wird nicht noch einmal angeboten', () => {
    const s = statusOf(1, docsFor(1), [gate('2026-10-01', 1, false), gate('2026-10-08', 1, true)]);
    expect(s).toMatchObject({ state: 'passed', on: '2026-10-08', attempts: 2 });
  });
  it('nach einem Fehlversuch: Pause von 7 Tagen, nach dem dritten Versuch von 28', () => {
    expect(statusOf(1, docsFor(1), [gate('2026-10-05', 1, false)])).toMatchObject({ state: 'pause', from: '2026-10-12' });
    expect(statusOf(1, docsFor(1), [gate('2026-10-01', 1, false)]).state).toBe('ready');
    const three = [gate('2026-08-01', 1, false), gate('2026-08-10', 1, false), gate('2026-09-20', 1, false)];
    expect(statusOf(1, docsFor(1), three)).toMatchObject({ state: 'pause', from: '2026-10-18' });
    expect(retryFrom(three)).toBe('2026-10-18');
    expect(retryFrom([])).toBeNull();
  });
  it('höchstens 5 Versuche je Kapitel', () => {
    const five = ['2026-05-01', '2026-05-10', '2026-06-20', '2026-07-30', '2026-09-01'].map((d) => gate(d, 1, false));
    expect(statusOf(1, docsFor(1), five).state).toBe('spent');
    expect(attemptsOf([...five, gate('2026-09-02', 2, false)], 1)).toHaveLength(5);
  });
  it('dieselben Eingaben, dasselbe Ergebnis; höchstens eine Prüfung wird angeboten (die erste bereite)', () => {
    expect(statusOf(1, docsFor(1))).toEqual(statusOf(1, docsFor(1)));
    const a = statusOf(1, docsFor(1));
    const b: GateStatus = { state: 'ready', chapter: 2, attempts: 0 };
    expect(firstReadyGate([a, b])?.chapter).toBe(1);
    expect(firstReadyGate([{ state: 'passed', chapter: 1, on: TODAY, attempts: 1 }, b])?.chapter).toBe(2);
    expect(firstReadyGate([])).toBeNull();
  });
});

describe('Wertung', () => {
  const tally = (ch: number, g: [number, number], w: [number, number]) => ({ chapter: ch, g, w, topics: [] });
  it('Kapitel 1–2: Grammatik ≥ 85 %, ab Kapitel 3: ≥ 80 %, Wörter ≥ 80 %', () => {
    expect(grammarThreshold(1)).toBe(0.85);
    expect(grammarThreshold(2)).toBe(0.85);
    expect(grammarThreshold(3)).toBe(0.8);
    expect(gateOutcome(tally(1, [12, 14], [7, 8])).ok).toBe(true); // 85,7 %
    expect(gateOutcome(tally(1, [11, 14], [7, 8])).ok).toBe(false); // 78,6 %
    expect(gateOutcome(tally(3, [8, 10], [7, 8])).ok).toBe(true); // genau 80 %
    expect(gateOutcome(tally(3, [8, 10], [6, 8])).ok).toBe(false); // Wörter 75 %
    expect(gateOutcome(tally(3, [7, 10], [8, 8])).ok).toBe(false); // Grammatik 70 %
  });
  it('ohne Wörterteil entscheidet allein die Grammatik', () => {
    const o = gateOutcome(tally(2, [9, 10], [0, 0]));
    expect(o).toMatchObject({ ok: true, noWords: true, wRate: null });
    expect(gateOutcome(tally(2, [0, 0], [0, 0])).ok).toBe(false);
  });
  it('schwächste Themen: die zwei mit den meisten Fehlern', () => {
    const o = gateOutcome({ chapter: 1, g: [10, 14], w: [8, 8], topics: [{ topic: 'a', right: 2, total: 2 }, { topic: 'b', right: 0, total: 2 }, { topic: 'c', right: 1, total: 2 }, { topic: 'd', right: 1, total: 2 }] });
    expect(o.weak).toEqual(['b', 'c']);
  });
  it('der Eintrag für app/c1.gates trägt Tag, Kapitel, Zahlen und Ergebnis; nach einem Fehlversuch steht der nächste Termin fest', () => {
    const t = tally(1, [10, 14], [5, 8]);
    const e = gateEntry(t, '2026-10-08');
    expect(e).toEqual({ d: '2026-10-08', ch: 1, g: [10, 14], w: [5, 8], ok: false });
    expect(nextTryAfter([], e)).toBe('2026-10-15');
  });
});

describe('Speichern (nur ergänzend)', () => {
  it('hängt einen Versuch an; ein bestandenes Kapitel, verbrauchte Versuche und derselbe Versuch zweimal (zwei Tabs) ändern nichts', () => {
    const doc = emptyC1();
    const first = appendGate(doc, gate('2026-10-08', 1, false));
    expect(first?.gates).toHaveLength(1);
    expect(appendGate(first!, gate('2026-10-08', 1, false))).toBeNull();
    const passed = appendGate(first!, gate('2026-10-20', 1, true));
    expect(passed?.gates).toHaveLength(2);
    expect(appendGate(passed!, gate('2026-11-20', 1, false))).toBeNull();
    const many = { ...doc, gates: Array.from({ length: 5 }, (_, i) => gate(`2026-0${i + 1}-01`, 2, false)) };
    expect(appendGate(many, gate('2026-10-08', 2, false))).toBeNull();
    expect(appendGate(many, gate('2026-10-08', 3, false))?.gates).toHaveLength(6);
  });
  it('ohne Schreiber meldet saveGate „unavailable“ und wirft nicht', async () => {
    await expect(saveGate(gate('2026-10-08', 1, false))).resolves.toBe('unavailable');
  });
});

// ------------------------------------------------------------------ Vorrat (P43)
const gateFile = c1File.parse(JSON.parse(readFileSync('src/content/c1x/src/gate/k1.json', 'utf8')));
const POOL = gateFile.items as C1Item[];
const KAP13 = programChapters().slice(0, 3);

describe('Prüfungsvorrat Kapitel 1–3 (P43)', () => {
  it('mindestens 8 Aufgaben je Thema (Grundstock 8, dazu Ergänzungen ab 0829) für alle 16 Themen der Kapitel 1–3, alle mit pool „gate“, nur freie Arten', () => {
    const topics = KAP13.flatMap((c) => c.topics);
    expect(topics).toHaveLength(16);
    expect(POOL).toHaveLength(135);
    for (const t of topics) expect(gatePoolOf(POOL, t).length, t).toBeGreaterThanOrEqual(8);
    expect(POOL.every((i) => i.pool === 'gate' && isGateItem(i))).toBe(true);
    expect(new Set(POOL.map((i) => i.kind))).toEqual(new Set(['ocl', 'kwt', 'err']));
  });
  it('jedes Paar eines Versuchs mischt zwei Arten; vier Versuche ziehen nie dieselbe Aufgabe', () => {
    for (const t of KAP13.flatMap((c) => c.topics)) {
      const seen = new Set<string>();
      for (let a = 0; a < 4; a++) {
        const pair = gatePair(POOL, t, a);
        expect(pair, `${t} Versuch ${a}`).toHaveLength(2);
        expect(new Set(pair.map((i) => i.kind)).size, `${t} Versuch ${a} mischt die Arten`).toBe(2);
        for (const i of pair) {
          expect(seen.has(i.id), `${t}: ${i.id} zweimal`).toBe(false);
          seen.add(i.id);
        }
      }
      expect(seen.size).toBe(8);
    }
  });
  it('eine Runde hat 2 Aufgaben je vorhandenem Thema, kein Thema doppelt hintereinander, gleiche Eingabe = gleiche Runde', () => {
    for (const ch of KAP13) {
      const round = gateRound(POOL, ch, 0, liveTopics(ch));
      expect(round).toHaveLength(ch.topics.length * 2);
      for (let i = 1; i < round.length; i++) expect(round[i]?.topic).not.toBe(round[i - 1]?.topic);
      expect(gateRound(POOL, ch, 0, liveTopics(ch)).map((i) => i.id)).toEqual(round.map((i) => i.id));
      expect(gateRound(POOL, ch, 1, liveTopics(ch)).map((i) => i.id)).not.toEqual(round.map((i) => i.id));
    }
  });
  it('Kapitel ohne Vorrat (4–7) liefert eine leere Runde', () => {
    const k4 = chapterById(4)!;
    expect(gateRound(POOL, k4, 0, liveTopics(k4))).toEqual([]);
  });
  it('jede Lösung gibt die volle Punktzahl und jede Aufgabe lässt sich zu einem richtigen Satz als Beleg ausschreiben', () => {
    for (const i of POOL) {
      for (const s of solutionsOf(i)) expect(isFull(scoreC1(i, s)), i.id).toBe(true);
      const sentence = correctSentence(i);
      expect(sentence, i.id).toBeTruthy();
      expect(sentence).not.toMatch(/_{2,}/);
      expect(sentence).not.toMatch(/\s{2,}/);
    }
  });
  it('Gegenprobe Beleg: ocl, kwt und err', () => {
    const find = (kind: string): C1Item => POOL.find((i) => i.kind === kind && (kind !== 'err' || (i as { bad?: unknown }).bad)) as C1Item;
    expect(correctSentence(find('ocl'))).toMatch(/^[A-Z].*[.?]$/);
    expect(correctSentence(find('kwt'))).toMatch(/^[A-Z].*[.?]$/);
    const e = find('err');
    const fixed = correctSentence(e);
    expect(fixed).not.toBe(e.kind === 'err' ? e.text : '');
  });
  it('der Vorrat liegt im eigenen Bündel und in keinem Bündel des Trainings; jede Aufgabe trägt pool „gate“ und kein probe', () => {
    const roots = JSON.parse(readFileSync('scripts/content/roots.json', 'utf8')) as { bundles: Record<string, { dirs: string[] }> };
    for (const [name, b] of Object.entries(roots.bundles)) {
      const hasGate = b.dirs.some((d) => d.endsWith('/gate'));
      expect(hasGate, name).toBe(name === 'c1x-gate');
    }
    expect(roots.bundles['c1x-gate']?.dirs).toEqual(['src/content/c1x/src/gate']);
    for (const i of POOL) {
      expect(i.pool).toBe('gate');
      expect(i.probe).toBeUndefined();
    }
  });
});

describe('Programm: Einsatz im Job (program.json, use)', () => {
  it('jedes Kapitel hat Situation (DE/EN) und ein bis zwei englische Beispielsätze', () => {
    for (const c of programChapters()) {
      expect(c.use, c.id).toBeDefined();
      expect(c.use?.ex.length).toBeGreaterThanOrEqual(1);
      expect(c.use?.ex.length).toBeLessThanOrEqual(2);
      for (const s of c.use?.ex ?? []) {
        expect(s).toMatch(/[.]$/);
        expect(s).not.toMatch(/[äöüß]/);
      }
    }
  });
});

// ------------------------------------------------------------------ Kapitelwörter
const card = (id: string, o: Partial<TrainCard> = {}): TrainCard =>
  ({
    kind: 'vocab', key: `vocab/${id}`, id, path: `vocab/${id}`, inDb: true, word: id, lemma: id, pos: null, de: `Bedeutung ${id}`, def: null,
    context: { sentence: `We need to ${id} the report before Friday.`, start: 11, end: 11 + id.length, gap: id },
    col: [], src: null, fsrs: {} as TrainCard['fsrs'], stage: 2, isNew: false, hidden: false, xs: {}, modes: {}, lastMode: null, lastEx: null,
    chunk: null, intro: null, order: 0, added: '2026-09-01', doc: {}, ...o,
  });

describe('Kapitelwörter', () => {
  const many = Array.from({ length: 20 }, (_, i) => card(`word${String(i).padStart(2, '0')}`, { added: i < 6 ? '2026-08-01' : '2026-09-15' }));
  it('acht Wörter, bevorzugt die seit Kapitelbeginn dazugekommenen; gleicher Startwert, gleiche Auswahl', () => {
    const a = chapterWords({ cards: many, since: '2026-09-01', seed: 'k1:0' });
    expect(a).toHaveLength(8);
    expect(a.every((w) => many.find((c) => c.id === w.cardId)?.added === '2026-09-15')).toBe(true);
    expect(chapterWords({ cards: many, since: '2026-09-01', seed: 'k1:0' }).map((w) => w.key)).toEqual(a.map((w) => w.key));
  });
  it('füllt mit älteren Karten auf; ignoriert neue, versteckte Karten und Karten ohne Beispielsatz oder Bedeutung', () => {
    const cards = [
      ...Array.from({ length: 3 }, (_, i) => card(`neu${i}`, { added: '2026-09-20' })),
      ...Array.from({ length: 6 }, (_, i) => card(`alt${i}`, { added: '2026-01-01' })),
      card('frisch', { isNew: true }), card('weg', { hidden: true }), card('ohneSatz', { context: null }), card('ohneDe', { de: '' }),
    ];
    const w = chapterWords({ cards, since: '2026-09-01', seed: 'x' });
    expect(w).toHaveLength(8);
    expect(w.map((x) => x.cardId)).not.toContain('frisch');
    expect(w.map((x) => x.cardId)).not.toContain('weg');
    expect(w.map((x) => x.cardId)).not.toContain('ohneSatz');
    expect(w.map((x) => x.cardId)).not.toContain('ohneDe');
  });
  it('weniger als vier passende Karten: der Wörterteil entfällt', () => {
    expect(chapterWords({ cards: [card('aaa'), card('bbb'), card('ccc')], since: null, seed: 'x' })).toEqual([]);
    expect(chapterWords({ cards: [card('aaa'), card('bbb'), card('ccc'), card('ddd')], since: null, seed: 'x' })).toHaveLength(4);
  });
  it('Prüfen: genau (oder britisch) richtig zählt, Tippfehler und falsche Wörter nicht; der Satz zeigt eine Lücke', () => {
    const [w] = chapterWords({ cards: Array.from({ length: 5 }, (_, i) => card(`report${i}`)), since: null, seed: 'x' });
    expect(w).toBeDefined();
    if (!w) return;
    expect(checkGateWord(w, w.gap).right).toBe(true);
    expect(checkGateWord(w, w.gap.toUpperCase()).right).toBe(true);
    expect(checkGateWord(w, '').right).toBe(false);
    expect(checkGateWord(w, 'zzzzzz').right).toBe(false);
    expect(maskedSentence(w)).toContain('______');
    expect(maskedSentence(w)).not.toContain(w.gap);
  });
});
