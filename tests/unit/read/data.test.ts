import { describe, expect, it } from 'vitest';
import { COLLECTION_NAMES, collectionOf, isDocPath, schemaForPath } from '../../../src/data/paths';
import { loadSnapshot, totalDocuments } from '../../../src/data/snapshot';
import { countDocuments } from '../../../src/data/reads';
import { LIVE_COLLECTIONS, LIVE_DOCS } from '../../../src/data/live';
import { validateDoc } from '../../../src/data/validate';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { appendArticlePlan, indexEntryOf, mergeState, stateUpdatePlan, upsertIndexPlan } from '../../../src/modules/read/domain/day';
import { parseDayDoc, parseMonthDoc, parsePrefs, DEFAULT_VIEW, PER_DAY_DEFAULT } from '../../../src/modules/read/domain/docs';
import { articleId, dayOfArticleId, READ_PREFS_PATH, readDayPath, readDocKind, readMonthPath, readMonthPathOfDay, shortHash } from '../../../src/modules/read/domain/paths';
import { DAY_DOCS_BLOCK, DAY_DOCS_WARN, mayCreateDayDoc, planTidy, readDocGate, stripArticleText, tidyDayOp } from '../../../src/modules/read/domain/retention';
import { ARTICLE_MAX_BYTES, checkDayFits, checkMonthFits, DB_DOC_LIMIT_BYTES, jsonBytes, MAX_ARTICLES_PER_DAY, READ_DOC_MAX_BYTES } from '../../../src/modules/read/domain/size';
import { claimDay, saveArticle, saveReadState } from '../../../src/modules/read/store';
import { goodItem, itemNo } from './fixtures';

// Datenmodell des Lesen-Moduls (docs/umbau/lesen-plan.md §4) mit erfundenen Fixtures.

const DAY = '2026-10-13';
const dayDoc = (n: number, day = DAY) => ({ v: 1, day, items: Array.from({ length: n }, (_, i) => itemNo(i + 1, day)) });

describe('Pfade und Kennungen', () => {
  it('Pfade, Arten und Segmentzeichen', () => {
    expect(readDayPath(DAY)).toBe('read/d-2026-10-13');
    expect(readMonthPath('2026-10')).toBe('read/m-2026-10');
    expect(readMonthPathOfDay(DAY)).toBe('read/m-2026-10');
    expect(READ_PREFS_PATH).toBe('read/p');
    for (const p of [readDayPath(DAY), readMonthPath('2026-10'), READ_PREFS_PATH]) expect(isDocPath(p), p).toBe(true);
    expect(readDocKind('read/d-2026-10-13')).toBe('day');
    expect(readDocKind('read/m-2026-10')).toBe('month');
    expect(readDocKind('read/p')).toBe('prefs');
    expect(readDocKind('read/d-2026-13')).toBe('unknown');
    expect(readDocKind('read/x')).toBe('unknown');
    expect(collectionOf('read/p')).toBe('read');
  });

  it('Artikel-Kennung ist deterministisch und trägt Tag und laufende Nummer', () => {
    const id = articleId(DAY, 2, 'saas', 'Why Pricing');
    expect(id).toBe(articleId(DAY, 2, 'saas', 'Why Pricing'));
    expect(id).toMatch(/^a-2026-10-13-2-[0-9a-z]{6}$/);
    expect(articleId(DAY, 2, 'ai', 'Why Pricing')).not.toBe(id);
    expect(articleId(DAY, 3, 'saas', 'Why Pricing')).not.toBe(id);
    expect(dayOfArticleId(id)).toBe(DAY);
    expect(dayOfArticleId('x')).toBeNull();
    expect(shortHash('a')).toHaveLength(6);
  });
});

describe('Registrierung im Schema-Routing (src/data/paths.ts)', () => {
  it('die Sammlung `read` ist eingetragen; alle drei Dokumentarten laufen durch dasselbe Schema', () => {
    expect(COLLECTION_NAMES).toContain('read');
    const s = schemaForPath(readDayPath(DAY));
    expect(s).not.toBeNull();
    expect(schemaForPath(readMonthPath('2026-10'))).toBe(s);
    expect(schemaForPath(READ_PREFS_PATH)).toBe(s);
    expect(schemaForPath('read/a/b/c')).toBeNull(); // nur Dokumente der Sammlung (zwei Segmente)
  });

  it('Round-Trip: Tages-, Monats- und Einstellungsdokument bestehen, unbekannte Felder bleiben erhalten', () => {
    const day = { ...dayDoc(2), future: { a: 1 } };
    const r = validateDoc(readDayPath(DAY), day);
    expect(r.ok && (r.value as { future?: unknown }).future).toEqual({ a: 1 });
    const month = { v: 1, items: [indexEntryOf(goodItem(), DAY)] };
    expect(validateDoc(readMonthPath('2026-10'), month).ok).toBe(true);
    const prefs = { v: 1, topics: { ai: 3, saas: 0 }, custom: ['Pricing for dev tools'], perDay: 3, view: 'b', autoSpeak: false, gen: { d: DAY, n: 2 }, lastTopics: ['ai', 'saas'], later: true };
    expect(validateDoc(READ_PREFS_PATH, prefs).ok).toBe(true);
    expect(validateDoc(READ_PREFS_PATH, {}).ok).toBe(true);
    // lastTopics ist nicht belegt (tolerant): ein anderer Typ wird nicht abgelehnt
    expect(validateDoc(READ_PREFS_PATH, { lastTopics: [{ topic: 'ai' }] }).ok).toBe(true);
  });

  it('unbrauchbarer Aufbau wird gemeldet (nie überschrieben)', () => {
    expect(validateDoc(readDayPath(DAY), { items: 'x' }).ok).toBe(false);
    expect(validateDoc(readDayPath(DAY), { items: ['kein Objekt'] }).ok).toBe(false);
    // Ein Eintrag ohne Kennung macht das Dokument nicht ungültig; das Modul blendet ihn aus (parseDayDoc).
    expect(validateDoc(readDayPath(DAY), { items: [{ title: 'ohne id' }] }).ok).toBe(true);
    expect(validateDoc(READ_PREFS_PATH, { topics: { ai: 'viel' } }).ok).toBe(false);
  });

  it('träge Sammlung: Voll-Lesen (Sicherung/Umstellung) lädt `read` nie, die Zählung geht über `read/p` (L3, Plan §11)', async () => {
    const h = createMemoryDb({ seed: { [readDayPath(DAY)]: dayDoc(2), [readMonthPath('2026-10')]: { v: 1, items: [] }, [READ_PREFS_PATH]: { v: 1, days: [DAY] }, 'read/x': { items: 5 } } });
    const snap = await loadSnapshot(h.db);
    expect(snap.counts.read).toBeUndefined();
    expect([...snap.raw.keys()].some((p) => p.startsWith('read/'))).toBe(false);
    expect(totalDocuments(snap)).toBe(0);
    const counts = await countDocuments(h.db);
    // p + 1 Tagesdokument + 1 Monatsindex; `read/x` ist unbekannt und wird nicht geraten
    expect(counts.byCollection.read).toBe(3);
  });

  it('`read` wird nie als ganze Sammlung abonniert (kein Eintrag in LIVE_COLLECTIONS/LIVE_DOCS)', () => {
    expect(LIVE_COLLECTIONS as readonly string[]).not.toContain('read');
    expect(LIVE_DOCS.some((d) => d.startsWith('read/'))).toBe(false);
  });
});

describe('Größenrechnung (Plan §4.2)', () => {
  it('ein Artikel ≈ 10 KB, weit unter der Artikelgrenze', () => {
    const b = jsonBytes(goodItem());
    expect(b).toBeGreaterThan(6_000);
    expect(b).toBeLessThan(14_000);
    expect(b).toBeLessThan(ARTICLE_MAX_BYTES);
  });

  it('4 Artikel am Tag: ≈ 40 KB je Tagesdokument, weit unter 200 KiB und 256 KiB', () => {
    const bytes = jsonBytes(dayDoc(4));
    expect(bytes).toBeGreaterThan(24_000);
    expect(bytes).toBeLessThan(60_000);
    expect(bytes).toBeLessThan(READ_DOC_MAX_BYTES);
    expect(READ_DOC_MAX_BYTES).toBeLessThan(DB_DOC_LIMIT_BYTES);
  });

  it('10 Artikel bleiben unter 200 KiB; die Obergrenze je Tag ist 8', () => {
    expect(jsonBytes(dayDoc(10))).toBeLessThan(READ_DOC_MAX_BYTES);
    expect(MAX_ARTICLES_PER_DAY).toBe(8);
    const seven = dayDoc(7).items;
    expect(checkDayFits(seven, itemNo(8), DAY)).toMatchObject({ ok: true });
    expect(checkDayFits(dayDoc(8).items, itemNo(9), DAY)).toMatchObject({ ok: false, reason: 'day_full' });
    // mit angehobener Grenze (nur Rechnung): 10 Artikel passen noch ins Dokument
    expect(checkDayFits(dayDoc(9).items, itemNo(10), DAY, 10)).toMatchObject({ ok: true });
  });

  it('Wächter vor dem Schreiben: zu großer Artikel oder zu großes Dokument wird abgewiesen', () => {
    const huge = { ...goodItem(), paras: goodItem().paras.map((p) => p.map((s) => ({ e: s.e.repeat(8), d: s.d.repeat(8) }))) };
    expect(checkDayFits([], huge, DAY)).toMatchObject({ ok: false, reason: 'article_too_big' });
    const fat = Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, pad: 'x'.repeat(30_000) }));
    expect(checkDayFits(fat, goodItem(), DAY)).toMatchObject({ ok: false, reason: 'doc_too_big' });
  });

  it('Monatsindex: 4 Artikel/Tag × 31 Tage ≈ 45 KB, weit unter 200 KiB', () => {
    const items = Array.from({ length: 124 }, (_, i) => indexEntryOf(itemNo(i + 1), DAY));
    const b = jsonBytes({ v: 1, items });
    expect(b).toBeLessThan(60_000);
    expect(checkMonthFits(items, indexEntryOf(itemNo(200), DAY), '2026-10')).toMatchObject({ ok: true });
    expect(checkMonthFits(Array.from({ length: 400 }, (_, i) => ({ id: String(i) })), indexEntryOf(goodItem(), DAY))).toMatchObject({ ok: false });
  });
});

describe('Schreibpläne (rein)', () => {
  it('fehlendes Tagesdokument: set; vorhandenes: update aus dem frischen Stand; gleiche Kennung nie doppelt', () => {
    const a = appendArticlePlan(undefined, DAY, itemNo(1));
    expect(a.outcome).toBe('created');
    expect(a.op).toEqual({ set: { v: 1, day: DAY, items: [itemNo(1)] } });
    const cur = { v: 1, day: DAY, items: [itemNo(1)] };
    const b = appendArticlePlan(cur, DAY, itemNo(2));
    expect(b.outcome).toBe('appended');
    expect(b.op && 'update' in b.op && (b.op.update.items as unknown[])).toHaveLength(2);
    expect(appendArticlePlan(cur, DAY, itemNo(1))).toEqual({ op: null, outcome: 'exists' });
  });

  it('ein Dokument mit unerwartetem Aufbau wird nie angefasst; ein leeres (nach acquire) wird ergänzt', () => {
    expect(appendArticlePlan({ items: 'kaputt' }, DAY, itemNo(1))).toEqual({ op: null, outcome: 'invalid_doc' });
    expect(appendArticlePlan({ items: ['kein Objekt'] }, DAY, itemNo(1))).toEqual({ op: null, outcome: 'invalid_doc' });
    const empty = appendArticlePlan({}, DAY, itemNo(1));
    expect(empty.outcome).toBe('created');
    expect(empty.op).toEqual({ update: { items: [itemNo(1)], v: 1, day: DAY } });
  });

  it('ausgeblendete (ungültige) Einträge bleiben beim Anhängen unverändert erhalten', () => {
    const odd = { id: 'a-odd', title: 'kaputt', paras: 'kein Array' };
    const cur = { v: 1, day: DAY, items: [odd, itemNo(1)] };
    const parsed = parseDayDoc(cur);
    expect(parsed.ok && parsed.hidden).toEqual(['a-odd']);
    expect(parsed.ok && parsed.items.map((i) => i.id)).toEqual([itemNo(1).id]);
    const plan = appendArticlePlan(cur, DAY, itemNo(2));
    expect(plan.op && 'update' in plan.op && (plan.op.update.items as unknown[])[0]).toEqual(odd);
  });

  it('Monatsindex: Eintrag anlegen, nie doppelt, Lesezustand bleibt', () => {
    const e = indexEntryOf(goodItem(), DAY);
    expect(e).toMatchObject({ id: goodItem().id, day: DAY, topic: 'saas', title: goodItem().title, words: expect.any(Number) as number });
    expect(e.mins).toBeGreaterThanOrEqual(3);
    expect(upsertIndexPlan(undefined, '2026-10', e)).toEqual({ op: { set: { v: 1, items: [e] } }, outcome: 'created' });
    const read = { ...e, st: { ...e.st, done: true, sec: 300 } };
    expect(upsertIndexPlan({ v: 1, items: [read] }, '2026-10', e)).toEqual({ op: null, outcome: 'exists' });
    expect(upsertIndexPlan({ items: 5 }, '2026-10', e).outcome).toBe('invalid_doc');
  });

  it('Lesezustand: Maximum bei Zeit/Aufgedecktem/Gespeichertem, done nur aufwärts, Meldungen vereinigt, erster Beginn bleibt', () => {
    const old = { t0: 100, sec: 300, pos: 14, done: true, open: 10, saved: 2, rep: [3], q: { n: 2, ok: 1 } };
    const m = mergeState(old, { t0: 500, sec: 120, pos: 5, done: false, open: 12, saved: 1, rep: [3, 9], q: { n: 2, ok: 2 } });
    expect(m).toMatchObject({ t0: 100, sec: 300, pos: 5, done: true, open: 12, saved: 2, rep: [3, 9], q: { n: 2, ok: 2 } });
    expect(mergeState(undefined, { sec: 5 })).toMatchObject({ sec: 5, done: false, pos: 0 });
  });

  it('Lesezustand fortschreiben: nur der betroffene Eintrag ändert sich', () => {
    const a = indexEntryOf(itemNo(1), DAY);
    const b = indexEntryOf(itemNo(2), DAY);
    const cur = { v: 1, items: [a, b] };
    const p = stateUpdatePlan(cur, b.id, { sec: 60, pos: 7 });
    expect(p.outcome).toBe('updated');
    const items = (p.op && 'update' in p.op ? p.op.update.items : []) as Array<{ id: string; st: { sec: number; pos: number } }>;
    expect(items[0]).toEqual(a);
    expect(items[1]?.st).toMatchObject({ sec: 60, pos: 7 });
    expect(stateUpdatePlan(cur, 'nope', { sec: 1 }).outcome).toBe('missing');
    expect(stateUpdatePlan(undefined, b.id, { sec: 1 }).outcome).toBe('missing');
  });

  it('Lesen mit Voreinstellungen: Ansicht B, 3 Artikel, Vorlesen aus', () => {
    const p = parsePrefs(undefined);
    expect(p).toMatchObject({ view: DEFAULT_VIEW, perDay: PER_DAY_DEFAULT, autoSpeak: false, custom: [], gen: null });
    expect(DEFAULT_VIEW).toBe('b');
    const q = parsePrefs({ view: 'z', perDay: 99, topics: { ai: 9, saas: -1 }, custom: ['a', ' ', 'b', 'c', 'd', 'e', 'f'], lastTopics: ['ai', 7] });
    expect(q).toMatchObject({ view: 'b', perDay: 8, topics: { ai: 3, saas: 0 }, custom: ['a', 'b', 'c', 'd', 'e'], lastTopics: ['ai'] });
    expect(parseMonthDoc({ items: [{ id: 'a' }, { id: 5 }] })).toMatchObject({ ok: true, items: [{ id: 'a' }], hidden: ['?'] });
  });
});

describe('Aufbewahrung: nichts wird automatisch gelöscht', () => {
  it('Wächter: Warnung ab 250, Sperre neuer Tagesdokumente bei 400 oder wenn der Gesamtwächter sperrt', () => {
    expect([DAY_DOCS_WARN, DAY_DOCS_BLOCK]).toEqual([250, 400]);
    expect(readDocGate(10, 0)).toBe('ok');
    expect(readDocGate(249, 0)).toBe('ok');
    expect(readDocGate(250, 0)).toBe('warn');
    expect(readDocGate(399, 0)).toBe('warn');
    expect(readDocGate(400, 0)).toBe('full');
    expect(readDocGate(10, 3_500)).toBe('warn');
    expect(readDocGate(10, 4_300)).toBe('full');
    expect(mayCreateDayDoc(399, 0)).toBe(true);
    expect(mayCreateDayDoc(400, 0)).toBe(false);
    expect(mayCreateDayDoc(10, 4_300)).toBe(false);
  });

  it('Aufräum-Plan liest nur: Tagesdokumente älter als 90 Tage kämen in Frage', () => {
    const old = { v: 1, day: '2026-06-01', items: [itemNo(1, '2026-06-01'), itemNo(2, '2026-06-01')] };
    const young = dayDoc(2, '2026-10-01');
    const plan = planTidy(
      [
        { day: '2026-06-01', doc: old },
        { day: '2026-10-01', doc: young },
        { day: '2026-05-01', doc: { items: 'kaputt' } },
      ],
      DAY,
    );
    expect(plan.cutoffDay).toBe('2026-07-15');
    expect(plan.candidates.map((c) => c.path)).toEqual(['read/d-2026-06-01']);
    expect(plan.articles).toBe(2);
    expect(plan.bytesSaved).toBeGreaterThan(10_000);
    expect(JSON.stringify(old)).toBe(JSON.stringify({ v: 1, day: '2026-06-01', items: [itemNo(1, '2026-06-01'), itemNo(2, '2026-06-01')] }));
  });

  it('ohne ausdrückliche Zustimmung liefert das Aufräumen nie einen Schreibvorgang', () => {
    const old = { v: 1, day: '2026-06-01', items: [itemNo(1, '2026-06-01')] };
    expect(tidyDayOp(old, '2026-06-01', DAY, { consent: false })).toBeNull();
    expect(tidyDayOp(old, '2026-06-01', DAY, { consent: undefined as unknown as boolean })).toBeNull();
    expect(tidyDayOp(undefined, '2026-06-01', DAY, { consent: true })).toBeNull();
    // zu jung: auch mit Zustimmung nicht
    expect(tidyDayOp(dayDoc(1, '2026-10-01'), '2026-10-01', DAY, { consent: true })).toBeNull();
    expect(tidyDayOp({ items: 'kaputt' }, '2026-06-01', DAY, { consent: true })).toBeNull();
  });

  it('mit Zustimmung: nur `update` (kein `replace`), Titel/Schlüsselwörter/Kennung bleiben, Texte und Fragen gehen; Wiederholung ändert nichts', async () => {
    const old = { v: 1, day: '2026-06-01', items: [itemNo(1, '2026-06-01'), itemNo(2, '2026-06-01')] };
    const h = createMemoryDb({ seed: { 'read/d-2026-06-01': old, [readMonthPath('2026-06')]: { v: 1, items: [indexEntryOf(itemNo(1, '2026-06-01'), '2026-06-01')] } } });
    const w = createWriter(h.db);
    const op = tidyDayOp(old, '2026-06-01', DAY, { consent: true });
    expect(op && 'update' in op).toBe(true);
    expect(await w.transform('read/d-2026-06-01', (cur) => tidyDayOp(cur, '2026-06-01', DAY, { consent: true }))).toBe('updated');
    const after = (await h.db.doc('read/d-2026-06-01').get()).data() as Record<string, unknown>;
    const parsed = parseDayDoc(after);
    expect(parsed.ok && parsed.hidden).toEqual([]);
    const items = parsed.ok ? parsed.items : [];
    expect(items.map((i) => i.id)).toEqual(old.items.map((i) => i.id));
    expect(items.every((i) => i.paras.length === 0 && !('check' in i) && (i.keyWords?.length ?? 0) === 5 && i.title.length > 0)).toBe(true);
    expect(jsonBytes(after)).toBeLessThan(jsonBytes(old) / 2);
    expect(await w.transform('read/d-2026-06-01', (cur) => tidyDayOp(cur, '2026-06-01', DAY, { consent: true }))).toBe('unchanged');
    // Lesezustand (Monatsindex) bleibt unberührt, es wurde nichts gelöscht
    expect(h.writes().filter((x) => x.op === 'delete')).toEqual([]);
    expect(((await h.db.doc(readMonthPath('2026-06')).get()).data() as { items: unknown[] }).items).toHaveLength(1);
    expect(stripArticleText(itemNo(1)).paras).toEqual([]);
  });
});

describe('Speichern über den einen Schreibpfad (writer.transform, acquire)', () => {
  it('Artikel anlegen, ergänzen, nie doppelt; Monatsindex wächst mit', async () => {
    const h = createMemoryDb();
    const w = createWriter(h.db);
    expect(await saveArticle(w, DAY, itemNo(1))).toBe('created');
    expect(await saveArticle(w, DAY, itemNo(2))).toBe('appended');
    expect(await saveArticle(w, DAY, itemNo(2))).toBe('exists');
    const day = parseDayDoc((await h.db.doc(readDayPath(DAY)).get()).data());
    expect(day.ok && day.items.map((i) => i.id)).toEqual([itemNo(1).id, itemNo(2).id]);
    const month = parseMonthDoc((await h.db.doc(readMonthPath('2026-10')).get()).data());
    expect(month.ok && month.items.map((i) => i.id)).toEqual([itemNo(1).id, itemNo(2).id]);
    expect(h.writes().map((x) => `${x.op}:${x.path}`)).toEqual(['set:read/d-2026-10-13', 'set:read/m-2026-10', 'update:read/d-2026-10-13', 'update:read/m-2026-10']);
  });

  it('neunter Artikel an einem Tag und kaputtes Tagesdokument: nicht gespeichert, nichts verändert', async () => {
    const h = createMemoryDb({ seed: { [readDayPath(DAY)]: dayDoc(8), 'read/d-2026-10-14': { items: 'kaputt' } } });
    const w = createWriter(h.db);
    expect(await saveArticle(w, DAY, itemNo(9))).toBe('day_full');
    expect(await saveArticle(w, '2026-10-14', itemNo(1, '2026-10-14'))).toBe('invalid_doc');
    expect(h.writes()).toEqual([]);
  });

  it('zwei Geräte: acquire gibt die Sperre nur einmal; dasselbe Gerät darf verlängern', async () => {
    const h = createMemoryDb();
    const w = createWriter(h.db);
    expect(await claimDay(w, DAY, 'phone')).toEqual({ acquired: true });
    expect(await claimDay(w, DAY, 'laptop')).toEqual({ acquired: false });
    expect(await claimDay(w, DAY, 'phone')).toEqual({ acquired: true });
    // acquire legt kein Dokument an
    expect((await h.db.doc(readDayPath(DAY)).get()).exists).toBe(false);
  });

  it('Lesezustand speichern: Maximum bei Zeit; ein fehlender Index-Eintrag wird gemeldet statt angelegt', async () => {
    const h = createMemoryDb();
    const w = createWriter(h.db);
    await saveArticle(w, DAY, itemNo(1));
    const id = itemNo(1).id;
    expect(await saveReadState(w, '2026-10', id, { sec: 90, pos: 4, open: 3 })).toBe('updated');
    expect(await saveReadState(w, '2026-10', id, { sec: 30, pos: 6, done: true })).toBe('updated');
    expect(await saveReadState(w, '2026-10', id, { sec: 30, pos: 6, done: true })).toBe('unchanged');
    const month = parseMonthDoc((await h.db.doc(readMonthPath('2026-10')).get()).data());
    expect(month.ok && month.items[0]?.st).toMatchObject({ sec: 90, pos: 6, done: true, open: 3 });
    expect(await saveReadState(w, '2026-10', 'nope', { sec: 1 })).toBe('unchanged');
  });

  it('Datenbank-Fehler beim Schreiben wird protokolliert und weitergereicht (kein stilles Verschlucken)', async () => {
    const h = createMemoryDb({ failWrites: 'invalid_argument' });
    const w = createWriter(h.db);
    await expect(saveArticle(w, DAY, itemNo(1))).rejects.toMatchObject({ code: 'invalid_argument' });
  });
});
