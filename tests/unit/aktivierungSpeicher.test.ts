import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_NAMES, COLLECTIONS, schemaForPath } from '../../src/data/paths';
import { loadSnapshot } from '../../src/data/snapshot';
import { createWriter, type Writer } from '../../src/data/writer';
import { ACT_DOC_MAX_BYTES, actEntrySchema, actId, actPath, clipChars, deriveNa, entriesOf, normalizeEntry, planAct, type ActEntry } from '../../src/domain/activation/actDoc';
import { activationRates, isReady, qualifies, ratePct, readyCount, readyMaxAge } from '../../src/domain/activation/ready';
import { dayKey } from '../../src/domain/date';
import { applyUpdate, cardPatch, cardPatchSchema, chunkPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
import { colChargeOp } from '../../src/domain/srs/collocs';
import { cardExamples } from '../../src/domain/srs/examples';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import { validateDoc } from '../../src/data/validate';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { berlin, loadSeed } from './helpers';

// Wörter aktivieren, Stufe 2: Speicher laut „Datenregeln für Stufe 2“ (data-guard, docs/umbau/aktivierung.md).

const holder = vi.hoisted((): { writer: Writer | null; db: unknown } => ({ writer: null, db: null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', () => ({ getDb: () => holder.db }));

const store = await import('../../src/features/vocab/actStore');

const entry = (n: number, over: Partial<ActEntry> = {}): ActEntry => ({
  id: actId(1_790_000_000_000 + n * 1000, `vocab/w${n % 7}`),
  t: 1_790_000_000_000 + n * 1000,
  d: '2026-10-14',
  c: `vocab/w${n % 7}`,
  st: 2,
  f: 'sc',
  a: 'sc.e01.cfo.-.n.pr.s',
  s: `We need leverage number ${n} in the next price talk with our client.`,
  g: 3,
  v: 'c',
  k: 1,
  ...over,
});

let h: MemoryDbHandle;
beforeEach(() => {
  h = createMemoryDb();
  holder.writer = createWriter(h.db);
  holder.db = h.db;
  store.useActs.setState({ entries: [], loaded: null });
});
afterEach(() => {
  holder.writer = null;
  holder.db = null;
});

describe('Kennung, Pfad, Monat', () => {
  it('Kennung ist deterministisch, ohne Punkte, und unterscheidet Karten', () => {
    expect(actId(1_790_000_000_000, 'vocab/a')).toBe(actId(1_790_000_000_000, 'vocab/a'));
    expect(actId(1_790_000_000_000, 'vocab/a')).not.toBe(actId(1_790_000_000_000, 'vocab/b'));
    expect(actId(1_790_000_000_000, 'vocab/a')).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
  it('Pfad: Hauptdokument und Fortsetzungen -b, -c', () => {
    expect(actPath('2026-10-14')).toBe('act/2026-10');
    expect(actPath('2026-10-14', 1)).toBe('act/2026-10-b');
    expect(actPath('2026-10-14', 2)).toBe('act/2026-10-c');
  });
  it('Monatswechsel mit Lerntag-Grenze 04:00: 03:59 gehört noch zum alten Monat, 04:00 zum neuen', () => {
    // Winterzeit (UTC+1) ab 25.10.2026: der Zeitstempel wird mit dem richtigen Versatz gebaut.
    const at = (iso: string): number => Date.parse(iso);
    expect(actPath(dayKey(at('2026-11-01T03:59:00+01:00')))).toBe('act/2026-10');
    expect(actPath(dayKey(at('2026-11-01T04:00:00+01:00')))).toBe('act/2026-11');
    expect(actPath(dayKey(at('2026-12-31T23:59:00+01:00')))).toBe('act/2026-12');
    expect(actPath(dayKey(at('2027-01-01T03:59:00+01:00')))).toBe('act/2026-12');
    expect(actPath(dayKey(at('2027-01-01T04:00:00+01:00')))).toBe('act/2027-01');
    // Sommerzeit (UTC+2): 30.09. 03:59 → September, 04:00 → noch immer 30.09.; erst 01.10. 04:00 → Oktober.
    expect(actPath(dayKey(at('2026-10-01T03:59:00+02:00')))).toBe('act/2026-09');
    expect(actPath(dayKey(at('2026-10-01T04:00:00+02:00')))).toBe('act/2026-10');
    expect(store.recentMonths('2026-01-05')).toEqual(['2026-01', '2025-12', '2025-11']);
  });
  it('Felder werden gekürzt: Satz 300, C1-Fassung 400, Begründung 300 Zeichen', () => {
    const long = 'word '.repeat(200);
    const e = normalizeEntry(entry(1, { s: long, b: long, w: long }));
    expect(e.s.length).toBeLessThanOrEqual(300);
    expect(e.b!.length).toBeLessThanOrEqual(400);
    expect(e.w!.length).toBeLessThanOrEqual(300);
    expect(clipChars('kurz', 300)).toBe('kurz');
    expect(normalizeEntry(entry(1, { b: '  ', w: '' })).b).toBeUndefined();
  });
});

describe('Schema und Registrierung (Sicherung, Export)', () => {
  it('act steht in COLLECTIONS: Sicherung und Export lesen sie mit', () => {
    expect(COLLECTION_NAMES).toContain('act');
    expect(Object.keys(COLLECTIONS)).toContain('act');
    expect(schemaForPath('act/2026-10')).not.toBeNull();
    expect(schemaForPath('act/2026-10-b')).not.toBeNull();
  });
  it('Seed enthält ein Beispiel; es besteht das Schema, die Eintragsprüfung und bewahrt unbekannte Felder', () => {
    const seed = loadSeed();
    const doc = seed['act/2026-09']!;
    expect(doc).toBeTruthy();
    expect(validateDoc('act/2026-09', doc).ok).toBe(true);
    const r = schemaForPath('act/2026-09')!.safeParse({ ...doc, zukunft: 1 });
    expect((r.data as Record<string, unknown>).zukunft).toBe(1);
    const es = entriesOf('act/2026-09', doc);
    expect(es.length).toBe(2);
    for (const e of es) expect(actEntrySchema.safeParse(e).success).toBe(true);
  });
  it('Export/Sicherung (Voll-Lesen) enthält act/ samt Fortsetzung', async () => {
    const seed = loadSeed();
    h = createMemoryDb({ seed: { ...seed, 'act/2026-10': { v: 1, month: '2026-10', nx: 1, e: {} }, 'act/2026-10-b': { v: 1, month: '2026-10', e: {} } } });
    const snap = await loadSnapshot(h.db);
    expect(snap.raw.has('act/2026-09')).toBe(true);
    expect(snap.raw.has('act/2026-10')).toBe(true);
    expect(snap.raw.has('act/2026-10-b')).toBe(true);
  });
  it('ein ungültiger Eintrag wird ausgelassen, nie das ganze Dokument verworfen', () => {
    const good = entry(1);
    const doc = { v: 1, month: '2026-10', e: { [good.id]: good, kaputt: { id: 'kaputt', s: 5 }, falsch: { ...entry(2), id: 'andere' } } };
    expect(validateDoc('act/2026-10', doc).ok).toBe(true);
    expect(entriesOf('act/2026-10', doc).map((e) => e.id)).toEqual([good.id]);
    expect(entriesOf('act/2026-10', { e: [1, 2] })).toEqual([]);
    expect(entriesOf('act/2026-10', undefined)).toEqual([]);
  });
});

describe('Schreiben: transform, idempotent, Größenwächter', () => {
  it('legt das Dokument an und ergänzt als Objekt-Map; derselbe Eintrag zweimal schreibt nichts', async () => {
    const e = entry(1);
    expect(await store.saveActEntry(e)).toBe(true);
    const doc = h.dump()['act/2026-10']!;
    // Das Dokument entsteht als Gerüst (set), der Eintrag kommt als Ergänzung (update): zwei Geräte überschreiben sich so nie.
    expect(h.writes()).toEqual([{ op: 'set', path: 'act/2026-10' }, { op: 'update', path: 'act/2026-10' }]);
    expect(doc.v).toBe(1);
    expect(doc.month).toBe('2026-10');
    expect(Array.isArray(doc.e)).toBe(false);
    expect(Object.keys(doc.e as object)).toEqual([e.id]);
    const writes = h.writes().length;
    expect(await store.saveActEntry(e)).toBe(true);
    expect(h.writes().length).toBe(writes);
    expect(Object.keys(h.dump()['act/2026-10']!.e as object)).toHaveLength(1);
  });
  it('ein zweiter Eintrag ergänzt, ohne den ersten zu verlieren (update, nie ersetzen)', async () => {
    await store.saveActEntry(entry(1));
    await store.saveActEntry(entry(2));
    expect(Object.keys(h.dump()['act/2026-10']!.e as object)).toHaveLength(2);
    expect(h.writes().filter((w) => w.op === 'set')).toHaveLength(1);
    expect(h.writes().every((w) => w.op !== 'delete')).toBe(true);
  });
  it('zwei parallele Schreiber (zwei Geräte) verlieren nichts', async () => {
    await store.saveActEntry(entry(50));
    const w2 = createWriter(h.db);
    const a = Array.from({ length: 8 }, (_, i) => entry(i));
    const b = Array.from({ length: 8 }, (_, i) => entry(100 + i));
    await Promise.all([
      ...a.map((e) => w2.transform(actPath(e.d), (cur) => planAct(actPath(e.d), cur, e).op)),
      ...b.map((e) => store.saveActEntry(e)),
    ]);
    const ids = Object.keys(h.dump()['act/2026-10']!.e as object);
    expect(new Set(ids).size).toBe(17);
    for (const e of [...a, ...b]) expect(ids).toContain(e.id);
  });
  it('dieselbe Kennung gleichzeitig von zwei Schreibern: genau ein Eintrag', async () => {
    const w2 = createWriter(h.db);
    const e = entry(5);
    await Promise.all([store.saveActEntry(e), w2.transform(actPath(e.d), (cur) => planAct(actPath(e.d), cur, e).op)]);
    expect(Object.keys(h.dump()['act/2026-10']!.e as object)).toEqual([e.id]);
  });
  it('Überlauf: ein volles Dokument bekommt nx und der Eintrag geht nach -b; Wiederholung doppelt nichts', async () => {
    const big = 'x'.repeat(290);
    const seedEntries: Record<string, ActEntry> = {};
    // Dokument knapp unter der Grenze füllen (gemessen wie der Wächter: UTF-8-Bytes des ganzen Dokuments).
    let i = 0;
    const bytesOf = (): number => new TextEncoder().encode(JSON.stringify({ v: 1, month: '2026-10', e: seedEntries })).length;
    while (bytesOf() < ACT_DOC_MAX_BYTES - 1500) {
      const f = normalizeEntry(entry(1000 + i++, { s: big, b: big, w: big }));
      seedEntries[f.id] = f;
    }
    h = createMemoryDb({ seed: { 'act/2026-10': { v: 1, month: '2026-10', e: seedEntries } } });
    holder.writer = createWriter(h.db);
    holder.db = h.db;
    const fits = entry(1, { s: 'short sentence about leverage in a talk' });
    expect(await store.saveActEntry(fits)).toBe(true);
    expect(h.dump()['act/2026-10-b']).toBeUndefined();
    let n = 0;
    // Weiter schreiben, bis das Hauptdokument voll ist.
    while (!h.dump()['act/2026-10-b'] && n++ < 20) await store.saveActEntry(entry(2000 + n, { s: big, b: big, w: big }));
    const main = h.dump()['act/2026-10']!;
    const cont = h.dump()['act/2026-10-b']!;
    expect(main.nx).toBe(1);
    expect(cont).toBeTruthy();
    expect(new TextEncoder().encode(JSON.stringify(main)).length).toBeLessThanOrEqual(ACT_DOC_MAX_BYTES);
    // Wiederholung eines Eintrags aus der Fortsetzung und einen aus dem Hauptdokument: nichts doppelt, nichts neu.
    const inCont = Object.values(cont.e as Record<string, ActEntry>)[0]!;
    const before = h.writes().length;
    expect(await store.saveActEntry(inCont)).toBe(true);
    expect(await store.saveActEntry(fits)).toBe(true);
    expect(h.writes().length).toBe(before);
    // Ein später kleiner Eintrag geht trotzdem nach -b (das Hauptdokument ist als voll markiert).
    const late = entry(3000, { s: 'tiny' });
    await store.saveActEntry(late);
    expect(Object.keys((h.dump()['act/2026-10-b']!.e) as object)).toContain(late.id);
    expect(Object.keys((h.dump()['act/2026-10']!.e) as object)).not.toContain(late.id);
  });
  it('ein Dokument mit unerwartetem Aufbau wird nie angefasst', async () => {
    h = createMemoryDb({ seed: { 'act/2026-10': { v: 1, month: '2026-10', e: [1, 2, 3] } } });
    holder.writer = createWriter(h.db);
    const before = JSON.stringify(h.dump()['act/2026-10']);
    expect(await store.saveActEntry(entry(1))).toBe(false);
    expect(JSON.stringify(h.dump()['act/2026-10'])).toBe(before);
    expect(planAct('act/2026-10', { v: 'x' }, entry(1)).state).toBe('invalid');
  });
  it('Lesen: die letzten drei Monate samt Fortsetzung; was in der Sitzung geschrieben wurde, bleibt sichtbar', async () => {
    const e1 = entry(1);
    const e2 = entry(2, { d: '2026-09-30' });
    const e3 = entry(3);
    h = createMemoryDb({
      seed: {
        'act/2026-10': { v: 1, month: '2026-10', nx: 1, e: { [e1.id]: e1 } },
        'act/2026-10-b': { v: 1, month: '2026-10', e: { [e3.id]: e3 } },
        'act/2026-09': { v: 1, month: '2026-09', e: { [e2.id]: e2 } },
        'act/2026-05': { v: 1, month: '2026-05', e: { x: { ...entry(9), id: 'x' } } },
      },
    });
    holder.db = h.db;
    await store.loadActs('2026-10-14');
    expect(store.useActs.getState().entries.map((e) => e.id).sort()).toEqual([e1.id, e2.id, e3.id].sort());
    expect(store.ownTextsOf('vocab/w1').length).toBeGreaterThan(0);
  });
  it('wiederverwendbar sind nur von Claude geprüfte, richtige Sätze mit r', () => {
    const entries = [entry(1, { r: 1 }), entry(8, { r: 1, k: 0 }), entry(15, { r: 1, v: 'm' }), entry(22), entry(29, { r: 1, c: 'vocab/other' })];
    expect(store.reusableSentencesOf('vocab/w1', entries).map((o) => o.id)).toEqual([entries[0]!.id]);
    expect(store.ownTextsOf('vocab/w1', entries)).toHaveLength(4);
  });
});

describe('Kartenzähler na: nie ac, im selben Schritt wie die Antwort', () => {
  const NOW = berlin('2026-10-14', 9);
  const base: Record<string, unknown> = { word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'x', ex: 'We use [leverage] daily.', col: [], state: 'review', S: 10, D: 5, last: NOW - 86_400_000 * 3, due: NOW - 1000, reps: 4, lapses: 0, modes: {}, stage: 4, hist: [], intro: '2026-08-01', ac: 0.7, order: 900, added: '2026-08-01', src: 'ai' };
  const ans = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: '2026-10-14', kind: 'v', id: 'lev', ex: 'act_scene', grade: 3, given: 'x', ans: 'x', ms: 1000, lang: 'de', ctx: 'rev', act: 'sc.e01.cfo.-.n.pr.s', actStep: 2, ...over });
  it('na steigt bei Note ≥ 2 im Schreibpatch der Antwort; ac (Fähigkeit Anwenden) bleibt eine andere Größe', () => {
    const p = cardPatch(base, ans());
    expect(p.na).toBe(1);
    expect(p.hist).toEqual([expect.objectContaining({ x: 'act_scene', a: 'sc.e01.cfo.-.n.pr.s', g: 3 })]);
    expect('ac' in p ? p.ac : undefined).not.toBe(1);
    expect(cardPatchSchema.safeParse(p).success).toBe(true);
    // aus einem vorhandenen Zähler
    expect(cardPatch({ ...base, na: 2 }, ans({ t: NOW + 1 })).na).toBe(3);
  });
  it('Note 1 und normale Antworten lassen na unberührt; Wendungen haben nie na', () => {
    expect(cardPatch(base, ans({ grade: 1 })).na).toBeUndefined();
    expect(cardPatch(base, ans({ actStep: undefined, ex: 'cloze' })).na).toBeUndefined();
    const chunk = reviewWrite('chunk/c1', { en: 'at the end of the day', state: 'review', S: 10, D: 5, due: NOW - 1000, last: NOW - 86_400_000, reps: 3, lapses: 0, stage: 4, xs: {}, hist: [], fsrs: undefined }, ans({ kind: 'chunk', id: 'c1' }), null);
    if (chunk.kind === 'update') expect(chunk.patch.na).toBeUndefined();
    expect(chunkPatchSchema.safeParse({ na: 1 }).success).toBe(false);
  });
  it('Kollision ausgeschlossen: ac und na sind getrennte Felder, beide im Karten-Schema, ac bleibt 0–1', () => {
    expect(cardPatchSchema.safeParse({ ac: 1.5 }).success).toBe(false);
    const merged = applyUpdate(base, cardPatch(base, ans()));
    expect(merged.na).toBe(1);
    expect(merged.ac).toBeLessThanOrEqual(1);
    expect(validateDoc('vocab/lev', merged).ok).toBe(true);
    const t = toTrainCard('lev', merged, true, NOW) as TrainCard;
    expect(t.doc.na).toBe(1);
  });
  it('na ist aus act/ neu berechenbar', () => {
    const es = [entry(1, { c: 'vocab/a', g: 3 }), entry(2, { c: 'vocab/a', g: 1 }), entry(3, { c: 'vocab/a', g: 2 }), entry(4, { c: 'vocab/b', g: 3 })];
    expect(deriveNa(es, 'vocab/a')).toBe(2);
    expect(deriveNa(es, 'vocab/zzz')).toBe(0);
  });
});

describe('Beispielsatz „Dein Satz vom …“', () => {
  const c = { context: null, doc: { ex: 'We use [leverage] daily.' } } as never;
  it('kommt nach dem Ursprungssatz, mit Datum; ohne eigenen Satz wie bisher', () => {
    const ex = cardExamples(c, null, [], [{ en: 'Our leverage grew after the pilot.', day: '2026-10-01' }]);
    expect(ex.map((x) => x.src)).toEqual(['origin', 'own']);
    expect(ex[1]!.day).toBe('2026-10-01');
    expect(cardExamples(c, null, []).map((x) => x.src)).toEqual(['origin']);
  });
  it('der Satz der laufenden Aufgabe wird nicht wiederholt', () => {
    expect(cardExamples(c, 'Our leverage grew after the pilot.', [], [{ en: 'Our leverage grew after the pilot.', day: '2026-10-01' }]).map((x) => x.src)).toEqual(['origin']);
  });
});

describe('Messung „einsatzbereit“', () => {
  const card = { key: 'vocab/w1', stage: 4, hidden: false } as const;
  const ok = (day: string, code: string, over: Partial<ActEntry> = {}): ActEntry => entry(Date.parse(day) / 1000, { c: 'vocab/w1', d: day, a: code, ...over });
  const A = 'sc.e01.cfo.-.n.pr.s';
  const B = 'tw.e05.team.slack.c.-.-';
  const C = 'im.-.boss.-.c.pa.q';
  const TODAY = '2026-10-14';
  it('Stufe ≥ 4, zwei geprüfte richtige Aktivierungen mit ≥ 3 Merkmalen, eine ohne gezeigtes Wort, ≥ 14 Tage Abstand, letzte ≤ 60 Tage', () => {
    const good = [ok('2026-09-10', A), ok('2026-10-01', C, { ns: 1 })];
    expect(isReady(card, good, TODAY)).toBe(true);
    expect(readyCount([card, { ...card, key: 'vocab/zz' }], good, TODAY)).toBe(1);
  });
  it('jede Bedingung einzeln', () => {
    const good = [ok('2026-09-10', A), ok('2026-10-01', C, { ns: 1 })];
    expect(isReady({ ...card, stage: 3 }, good, TODAY)).toBe(false);
    expect(isReady({ ...card, hidden: true }, good, TODAY)).toBe(false);
    expect(isReady(card, [good[0]!], TODAY)).toBe(false);
    // keine ohne gezeigtes Wort
    expect(isReady(card, [ok('2026-09-10', A), ok('2026-10-01', B)], TODAY)).toBe(false);
    // Abstand 13 Tage
    expect(isReady(card, [ok('2026-09-18', A), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(false);
    // nur 2 Merkmale verschieden
    expect(isReady(card, [ok('2026-09-10', 'sc.e01.cfo.-.n.pr.s'), ok('2026-10-01', 'sc.e01.cfo.-.c.pa.s', { ns: 1 })], TODAY)).toBe(false);
    // letzte zu alt (61 Tage)
    expect(isReady(card, good, '2026-12-01')).toBe(false);
    // ungeprüft oder nicht richtig zählt nie
    expect(isReady(card, [ok('2026-09-10', A, { k: 0 }), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(false);
    expect(isReady(card, [ok('2026-09-10', A, { v: 'w' }), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(false);
    // ein kleiner Fehler (Zeitform) bei richtig benutztem Hauptwort zählt (Lernwissenschaft M5) – ein Fehler in Wortwahl, Kollokation oder falschem Freund nicht
    expect(isReady(card, [ok('2026-09-10', A, { v: 'm', et: 'tense' }), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(true);
    expect(isReady(card, [ok('2026-09-10', A, { v: 'm', et: 'collocation' }), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(false);
    expect(isReady(card, [ok('2026-09-10', A, { v: 'm', et: 'word_choice' }), ok('2026-10-01', C, { ns: 1 })], TODAY)).toBe(false);
  });
  it('M5: die Altersgrenze wächst mit dem Intervall der Karte (mindestens 60 Tage, sonst Intervall + 7)', () => {
    const good = [ok('2026-09-10', A), ok('2026-10-01', C, { ns: 1 })];
    const at = (due: number, last: number) => ({ ...card, fsrs: { due, last } as never });
    const day = 86_400_000;
    const t0 = Date.parse('2026-10-01T12:00:00+02:00');
    expect(readyMaxAge({})).toBe(60);
    expect(readyMaxAge(at(t0 + 30 * day, t0))).toBe(60);
    expect(readyMaxAge(at(t0 + 120 * day, t0))).toBe(127);
    // letzte Aktivierung vor 76 Tagen: bei 60 Tagen Grenze zu alt, bei einem Intervall von 120 Tagen noch gültig
    expect(isReady(card, good, '2026-12-16')).toBe(false);
    expect(isReady(at(t0 + 120 * day, t0), good, '2026-12-16')).toBe(true);
    expect(isReady(at(t0 + 120 * day, t0), good, '2027-03-01')).toBe(false);
  });
  it('M1: bei Wörtern, die sich nicht verdecken lassen (Compliance), entfällt die Bedingung „einmal ohne gezeigtes Wort“', () => {
    const noHide = { ...card, kind: 'vocab' as const, lemma: 'compliance', de: 'Compliance', def: 'compliance with the rules' };
    const two = [ok('2026-09-10', A), ok('2026-10-01', 'tw.e05.team.slack.c.-.-')];
    expect(isReady(card, two, TODAY)).toBe(false);
    expect(isReady(noHide, two, TODAY)).toBe(true);
  });
  it('das Partnerwort einer Kombi-Aufgabe zählt, wenn Claude es als richtig ausweist', () => {
    const combo = ok('2026-09-10', 'sc.e01.cfo.-.n.pr.s', { c: 'vocab/other', ts: [['vocab/other', 'c'], ['vocab/w1', 'c']] });
    expect(qualifies(combo, 'vocab/w1')).toBe(true);
    expect(qualifies({ ...combo, ts: [['vocab/other', 'c'], ['vocab/w1', 'w']] }, 'vocab/w1')).toBe(false);
  });
  it('Begleitwert: Trefferquote mit und ohne gezeigtes Wort, erst ab 5 geprüften', () => {
    const es = [...Array.from({ length: 5 }, (_, i) => entry(i, { v: i < 4 ? 'c' : 'w' })), ...Array.from({ length: 5 }, (_, i) => entry(10 + i, { ns: 1, v: i < 2 ? 'c' : 'w' })), entry(30, { k: 0 })];
    const r = activationRates(es);
    expect(r.shown).toEqual({ n: 5, ok: 4 });
    expect(r.hidden).toEqual({ n: 5, ok: 2 });
    expect(ratePct(r.shown)).toBe(80);
    expect(ratePct(r.hidden)).toBe(40);
    expect(ratePct({ n: 4, ok: 4 })).toBeNull();
  });
});

describe('Inhaltscharge col (nur Mechanik)', () => {
  const good = [{ p: 'drive growth', de: 'Wachstum antreiben', gap: 'growth', opts: ['sales', 'budget', 'team'], ex: 'We [drive growth] with better pricing every quarter.' }];
  it('ergänzt nur Karten ohne Wortpartner, ohne die Marke ai, höchstens zwei', () => {
    const op = colChargeOp({ word: 'drive', col: [] }, 'drive', good);
    expect(op?.update.col).toHaveLength(1);
    expect(op?.update.col[0]).not.toHaveProperty('ai');
    expect(colChargeOp({ word: 'drive' }, 'drive', good)).not.toBeNull();
  });
  it('nie ersetzen, nie bei fehlender oder ausgeblendeter Karte, nie mit ungültigem Inhalt', () => {
    expect(colChargeOp({ word: 'drive', col: [{ p: 'x' }] }, 'drive', good)).toBeNull();
    expect(colChargeOp(undefined, 'drive', good)).toBeNull();
    expect(colChargeOp({ word: 'drive', hidden: true }, 'drive', good)).toBeNull();
    expect(colChargeOp({ word: 'drive' }, 'drive', [{ p: 'drive', de: 'x', gap: 'y', opts: ['a'], ex: 'nope' }])).toBeNull();
    expect(colChargeOp({ word: 'drive' }, 'drive', 'kaputt')).toBeNull();
  });
});
