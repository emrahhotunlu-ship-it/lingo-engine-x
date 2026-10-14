import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../../src/data/validate';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { routineBackupPaths } from '../../../src/modules/read/domain/backup';
import { stateUpdatePlan } from '../../../src/modules/read/domain/day';
import { articleDocPath, dayOfArticleId, isRoutineId, readDocKind, readRoutinePath, routineArticleId } from '../../../src/modules/read/domain/paths';
import { checkRoutineItem, isOwn, mergeRoutine, parseRoutineDoc, routineEntryOf, safeUrl } from '../../../src/modules/read/domain/routine';
import { countWords } from '../../../src/modules/read/domain/text';
import { entryState, entriesOfDay, fetchCountWithRoutine, nextToRead } from '../../../src/modules/read/domain/view';
import { runFetch } from '../../../src/modules/read/run';
import { parsePrefs } from '../../../src/modules/read/domain/docs';
import { articleItemSchema } from '../../../src/modules/read/schemas';
import type { ArticleItem, IndexItem } from '../../../src/modules/read/schemas';
import { loadHome, saveReadState } from '../../../src/modules/read/store';

// Routine „Lesen“ (docs/umbau/lesen-routine.md): Artikel der geplanten Claude-Routine in `read/r-<Tag>`.
// Das Beispiel-JSON der Anleitung läuft gegen den echten Prüfer der App, die Regeln (Ausblenden, Mischen, Lesestand) je mit eigenem Test.

const DOC_PATH = new URL('../../../docs/umbau/lesen-routine.md', import.meta.url);
const DAY = '2026-10-14';

type Doc = Record<string, unknown>;
type Raw = Record<string, unknown> & { paras: Array<Array<{ e: string; d: string }>> };

/** Das Beispiel-JSON aus der Anleitung (zwischen den Markierungen), unverändert. */
function exampleDoc(): { v: number; day: string; by: string; items: Raw[] } {
  const md = readFileSync(DOC_PATH, 'utf8');
  const a = md.indexOf('<!-- BEISPIEL-JSON-BEGINN -->');
  const b = md.indexOf('<!-- BEISPIEL-JSON-ENDE -->');
  expect(a).toBeGreaterThan(0);
  expect(b).toBeGreaterThan(a);
  const block = /```json\n([\s\S]*?)\n```/.exec(md.slice(a, b));
  expect(block, 'JSON-Block im Beispiel').not.toBeNull();
  return JSON.parse(block![1]!) as { v: number; day: string; by: string; items: Raw[] };
}
const example = (): Raw => structuredClone(exampleDoc().items[0]!);
const engWords = (it: Raw): number => it.paras.flat().reduce((n, s) => n + countWords(s.e), 0);

describe('Anleitung: das Beispiel-JSON besteht den Prüfer der App', () => {
  it('Aufbau des Dokuments und Wortzahl nach der Anleitung (300-450 Wörter, 3-5 Absätze, 16-28 Sätze, Sätze bis 35 Wörter)', () => {
    const d = exampleDoc();
    expect(d.v).toBe(1);
    expect(d.by).toBe('routine');
    expect(d.day).toBe(DAY);
    const it = d.items[0]!;
    expect(engWords(it)).toBeGreaterThanOrEqual(300);
    expect(engWords(it)).toBeLessThanOrEqual(450);
    expect(it.paras.length).toBeGreaterThanOrEqual(3);
    expect(it.paras.length).toBeLessThanOrEqual(5);
    const sentences = it.paras.flat();
    expect(sentences.length).toBeGreaterThanOrEqual(16);
    expect(sentences.length).toBeLessThanOrEqual(28);
    for (const s of sentences) expect(countWords(s.e), s.e).toBeLessThanOrEqual(35);
    expect((it.keyWords as unknown[]).length).toBeGreaterThanOrEqual(3);
    expect((it.keyWords as unknown[]).length).toBeLessThanOrEqual(5);
    expect((it.check as unknown[]).length).toBe(3);
  });

  it('das ganze Dokument ist für die Datenbank der App gültig (Schema der Sammlung `read`)', () => {
    const res = validateDoc(readRoutinePath(DAY), exampleDoc());
    expect(res.ok).toBe(true);
  });

  it('der Artikel besteht alle neun Prüftore ohne Verwerfen: nichts fällt weg, nichts wird repariert', () => {
    const doc = exampleDoc();
    const parsed = parseRoutineDoc(doc, DAY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.hidden).toEqual([]);
    expect(parsed.items).toHaveLength(1);
    const item = parsed.items[0]!;
    expect(item.id).toBe('r-2026-10-14-1');
    expect(item.by).toBe('routine');
    expect(item.topic).toBe('ai');
    expect(item.source).toBe('Fox News');
    expect(item.url).toMatch(/^https:\/\//);
    expect(item.keyWords).toHaveLength(5);
    expect(item.check).toHaveLength(3);
    // Der geprüfte Artikel ist ein gültiger Artikel des Lesers (Schema des Moduls).
    expect(articleItemSchema.safeParse(item).success).toBe(true);
    // Die Schlüsselwörter zeigen auf die Sätze, in denen sie stehen (keine stille Reparatur der Fundstelle nötig).
    const raw = doc.items[0]!;
    const rawKw = raw.keyWords as Array<{ w: string; i: [number, number] }>;
    expect(item.keyWords!.map((k) => k.i)).toEqual(rawKw.map((k) => k.i));
  });

  it('die Anleitung nennt die festen Themen-Schlüssel und die Grenzen, die der Prüfer wirklich hat', () => {
    const md = readFileSync(DOC_PATH, 'utf8');
    for (const k of ['ai', 'saas', 'bizdev', 'economy', 'architecture', 'management', 'claudecode']) expect(md).toContain(`\`${k}\``);
    expect(md).toContain('280');
    expect(md).toContain('700');
    expect(md).toContain('read/r-<heute>');
    // Die Routine schreibt nur ihren eigenen Pfad.
    expect(md).toMatch(/nie in `read\/m-…`/);
  });
});

describe('Prüftore für Routine-Artikel (jeder Mangel blendet nur diesen Artikel aus)', () => {
  const bad = (mutate: (a: Raw) => void): ReturnType<typeof checkRoutineItem> => {
    const a = example();
    mutate(a);
    return checkRoutineItem(a, DAY, 0);
  };

  it('ein vollständiger Artikel wird angenommen', () => {
    expect(checkRoutineItem(example(), DAY, 0).ok).toBe(true);
  });

  it('Quelle fehlt oder ist leer', () => {
    expect(bad((a) => delete a.source).ok).toBe(false);
    expect(bad((a) => (a.source = '   ')).ok).toBe(false);
  });

  it('Link muss https sein (kein http, kein javascript:, keine Zugangsdaten, kein Leerzeichen, ohne Rechnername)', () => {
    for (const url of ['http://example.com/a', 'javascript:alert(1)', 'https://user:pw@example.com/a', 'https://example.com/a b', 'https://localhost/a', 'foxnews.com/a', '', 42]) {
      expect(bad((a) => (a.url = url)).ok, String(url)).toBe(false);
    }
    expect(safeUrl('https://www.infoq.com/news/2026/10/spotify-ai-quality-controls/')).toBe('https://www.infoq.com/news/2026/10/spotify-ai-quality-controls/');
    expect(safeUrl(`https://example.com/${'a'.repeat(600)}`)).toBeNull();
  });

  it('Thema muss einer der festen Schlüssel sein (nicht `custom`, nicht frei)', () => {
    expect(bad((a) => (a.topic = 'custom')).ok).toBe(false);
    expect(bad((a) => (a.topic = 'cat')).ok).toBe(false);
    expect(bad((a) => delete a.topic).ok).toBe(false);
    expect(bad((a) => (a.topic = 'claudecode')).ok).toBe(true);
  });

  it('zu kurz: unter 280 englischen Wörtern wird abgelehnt', () => {
    const r = bad((a) => (a.paras = a.paras.map((p) => p.slice(0, 2))));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/length|form/);
  });

  it('Sprachen vertauscht oder ein Satz nicht übersetzt', () => {
    expect(bad((a) => (a.paras[0]![2]!.d = a.paras[0]![2]!.e)).ok).toBe(false);
    expect(bad((a) => ([a.paras[0]![2]!.e, a.paras[0]![2]!.d] = [a.paras[0]![2]!.d, a.paras[0]![2]!.e])).ok).toBe(false);
  });

  it('1:1 verletzt: Zahl fehlt im Deutschen', () => {
    const r = bad((a) => (a.paras[1]![0]!.d = 'In einem Experiment wurde ein Modell auf günstigen Android-TV-Boxen ausgeführt.'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('alignment');
  });

  it('verklebte Sätze und Markdown', () => {
    expect(bad((a) => (a.paras[0]![0]!.e = 'The report is out.Anthropic warns about it in a long and careful way today.')).ok).toBe(false);
    expect(bad((a) => (a.paras[0]![0]!.d = '**Das Frontier Red Team** von Anthropic hat einen Bericht veröffentlicht.')).ok).toBe(false);
  });

  it('britische Schreibweise und Floskeln', () => {
    expect(bad((a) => (a.paras[0]![0]!.e = 'Anthropic’s Frontier Red Team has published a report on the behaviour of small AI models.')).ok).toBe(false);
    expect(bad((a) => (a.paras[0]![0]!.e = 'Anthropic’s Frontier Red Team has published a game changer of a report on small AI models.')).ok).toBe(false);
  });

  it('schlechte Schlüsselwörter fallen weg, der Artikel bleibt (nachsichtig, mindestens 3 gültige)', () => {
    const r = bad((a) => {
      const kw = a.keyWords as Array<{ w: string; de: string; i: number[] }>;
      kw[0]!.w = 'word that is not in the text';
      kw[1]!.w = 'the';
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item.keyWords).toHaveLength(3);
    // Weniger als drei gültige: Artikel abgelehnt.
    const r2 = bad((a) => {
      const kw = a.keyWords as Array<{ w: string }>;
      kw[0]!.w = 'nothing';
      kw[1]!.w = 'nowhere';
      kw[2]!.w = 'never seen';
    });
    expect(r2.ok).toBe(false);
  });

  it('ungültige Prüffragen fallen still weg, der Artikel bleibt', () => {
    const r = bad((a) => ((a.check as Array<{ a: number }>)[0]!.a = 7));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item.check).toBeUndefined();
  });

  it('fremde Kennung wird durch `r-<Tag>-<Nr.>` ersetzt', () => {
    expect(bad((a) => (a.id = 'a-2026-10-14-1-abc123')).ok && checkRoutineItem({ ...example(), id: 'x' }, DAY, 2).ok).toBe(true);
    const r = checkRoutineItem({ ...example(), id: 'r-2026-10-13-4' }, DAY, 2);
    expect(r.ok && r.item.id).toBe('r-2026-10-14-3');
  });
});

describe('Dokument lesen: fehlerhafte Artikel ausblenden, nie löschen', () => {
  const second = (): Raw => ({ ...example(), id: 'r-2026-10-14-2', title: 'Another Headline About Cheap Devices And Security Updates In Offices', topic: 'architecture' });

  it('fehlendes Dokument ist normal; Dokument ohne `items`-Liste ist unbrauchbar', () => {
    expect(parseRoutineDoc(undefined, DAY)).toEqual({ ok: true, day: DAY, items: [], hidden: [] });
    expect(parseRoutineDoc({ v: 1, day: DAY, items: 'x' }, DAY)).toEqual({ ok: false, reason: 'invalid_doc' });
  });

  it('ein kaputter Artikel zwischen zwei guten: die guten bleiben, der kaputte steht in `hidden`', () => {
    const doc: Doc = { v: 1, day: DAY, by: 'routine', items: [example(), { id: 'r-2026-10-14-9', title: 'No text' }, second()] };
    const before = JSON.stringify(doc);
    const r = parseRoutineDoc(doc, DAY);
    expect(r.ok && r.items.map((i) => i.id)).toEqual(['r-2026-10-14-1', 'r-2026-10-14-2']);
    expect(r.ok && r.hidden.map((h) => h.id)).toEqual(['r-2026-10-14-9']);
    // Gelesen wird nur: das Dokument bleibt unverändert.
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('Eintrag, der gar kein Objekt ist, blendet nur sich selbst aus; doppelte Kennung wird nur einmal gezeigt', () => {
    const r = parseRoutineDoc({ v: 1, items: [example(), 'x', null, example()] }, DAY);
    expect(r.ok && r.items).toHaveLength(1);
    expect(r.ok && r.hidden).toHaveLength(3);
  });

  it('höchstens 8 Artikel je Dokument werden angezeigt', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ ...example(), id: `r-2026-10-14-${i + 1}` }));
    const r = parseRoutineDoc({ v: 1, items }, DAY);
    expect(r.ok && r.items).toHaveLength(8);
  });
});

describe('Mischen in die Tagesliste', () => {
  const art = (n: number, day = DAY): ArticleItem => ({ ...(example() as unknown as ArticleItem), id: routineArticleId(day, n), title: `Headline ${n}`, topic: 'ai', by: 'routine', source: `Source ${n}` });
  const own = (id: string, day = DAY, st?: IndexItem['st']): IndexItem => ({ id, day, title: `Own ${id}`, topic: 'saas', mins: 3, words: 400, ...(st ? { st } : {}) });

  it('Routine-Artikel erscheinen ohne Indexeintrag mit leerem Lesestand und der Quelle, vor den eigenen Artikeln des Tages', () => {
    const merged = mergeRoutine([own('a-2026-10-14-1-abc')], [{ day: DAY, items: [art(1), art(2)] }]);
    expect(merged.map((e) => e.id)).toEqual(['r-2026-10-14-1', 'r-2026-10-14-2', 'a-2026-10-14-1-abc']);
    expect(merged[0]).toMatchObject({ src: 'routine', source: 'Source 1', topic: 'ai', day: DAY });
    expect(entryState(merged[0]!)).toBe('open');
    expect(entriesOfDay(merged, DAY)).toHaveLength(3);
    expect(nextToRead(entriesOfDay(merged, DAY))?.id).toBe('r-2026-10-14-1');
    expect(merged.filter(isOwn).map((e) => e.id)).toEqual(['a-2026-10-14-1-abc']);
  });

  it('der Lesestand aus dem Monatsindex gilt (gelesen / angefangen), Titel kommt aus dem aktuellen Artikel', () => {
    const st = { sec: 90, pos: 6, done: false, open: 3, saved: 1 };
    const persisted: IndexItem = { id: 'r-2026-10-14-1', day: DAY, title: 'Old title', topic: 'ai', src: 'routine', st };
    const done: IndexItem = { id: 'r-2026-10-14-2', day: DAY, title: 'x', src: 'routine', st: { done: true, sec: 300 } };
    const merged = mergeRoutine([persisted, done], [{ day: DAY, items: [art(1), art(2)] }]);
    expect(merged.map((e) => [e.id, entryState(e)])).toEqual([
      ['r-2026-10-14-1', 'started'],
      ['r-2026-10-14-2', 'done'],
    ]);
    expect(merged[0]!.title).toBe('Headline 1');
    expect(merged[0]!.st).toEqual(st);
    // Es entsteht kein doppelter Eintrag.
    expect(merged).toHaveLength(2);
  });

  it('ein gespeicherter Eintrag, dessen Artikel für einen geladenen Tag nicht mehr gültig ist, wird nicht angezeigt (aber nichts gelöscht)', () => {
    const persisted: IndexItem = { id: 'r-2026-10-14-3', day: DAY, title: 'Gone', src: 'routine', st: { done: true } };
    const index = [persisted];
    const merged = mergeRoutine(index, [{ day: DAY, items: [art(1)] }]);
    expect(merged.map((e) => e.id)).toEqual(['r-2026-10-14-1']);
    expect(index).toEqual([persisted]);
  });

  it('Routine-Einträge älterer, nicht geladener Tage bleiben in „Frühere Artikel“; sonst Reihenfolge nach Tag', () => {
    const oldOne: IndexItem = { id: 'r-2026-10-01-1', day: '2026-10-01', title: 'Old', src: 'routine', st: { done: true } };
    const merged = mergeRoutine([own('a-2026-10-14-1-abc'), oldOne], [{ day: DAY, items: [art(1)] }]);
    expect(merged.map((e) => e.id)).toEqual(['r-2026-10-01-1', 'r-2026-10-14-1', 'a-2026-10-14-1-abc']);
  });

  it('der Eintrag zu einem Artikel trägt Wörter und Minuten wie bei eigenen Artikeln', () => {
    const e = routineEntryOf(art(1), DAY);
    expect(e.words).toBe(engWords(example()));
    expect(e.mins).toBeGreaterThanOrEqual(2);
    expect(e.st).toMatchObject({ done: false, sec: 0, pos: 0 });
  });

  it('Knopf „Noch einen Artikel schreiben lassen“: mit Routine höchstens einer je Tipp, nie über dem Tageslimit', () => {
    expect(fetchCountWithRoutine(0, 8)).toBe(1);
    expect(fetchCountWithRoutine(7, 8)).toBe(1);
    expect(fetchCountWithRoutine(8, 8)).toBe(0);
  });
});

describe('Pfade und Kennungen der Routine', () => {
  it('Pfad, Art, Kennung und Tag', () => {
    expect(readRoutinePath(DAY)).toBe('read/r-2026-10-14');
    expect(readDocKind('read/r-2026-10-14')).toBe('routine');
    expect(readDocKind('read/r-nope')).toBe('unknown');
    expect(routineArticleId(DAY, 3)).toBe('r-2026-10-14-3');
    expect(isRoutineId('r-2026-10-14-3')).toBe(true);
    expect(isRoutineId('a-2026-10-14-3-abc123')).toBe(false);
    expect(isRoutineId('r-2026-10-14-')).toBe(false);
    expect(dayOfArticleId('r-2026-10-14-3')).toBe(DAY);
    expect(dayOfArticleId('a-2026-10-14-3-abc123')).toBe(DAY);
    expect(dayOfArticleId('r-2026-10-14')).toBeNull();
    expect(articleDocPath('r-2026-10-14-3', DAY)).toBe('read/r-2026-10-14');
    expect(articleDocPath('a-2026-10-14-3-abc123', DAY)).toBe('read/d-2026-10-14');
  });

  it('Sicherung: Routine-Dokumente der letzten 14 Tage, neueste zuerst', () => {
    const p = routineBackupPaths('2026-10-14');
    expect(p).toHaveLength(14);
    expect(p[0]).toBe('read/r-2026-10-14');
    expect(p[13]).toBe('read/r-2026-10-01');
    expect(routineBackupPaths('kaputt')).toEqual([]);
  });
});

// ---------------------------------------------------------------- Laden und Lesestand mit einer echten (Speicher-)Datenbank

function setup(seed: Record<string, Doc> = {}) {
  const h = createMemoryDb({ seed });
  const writer = createWriter(h.db);
  const reads: string[] = [];
  const read = async (path: string): Promise<Doc | undefined> => {
    reads.push(path);
    const s = await h.db.doc(path).get();
    return s.exists ? s.data() : undefined;
  };
  return { h, writer, read, reads };
}
const routineSeed = (n = 2): Doc => ({ v: 1, day: DAY, by: 'routine', items: Array.from({ length: n }, (_, i) => ({ ...example(), id: `r-2026-10-14-${i + 1}`, title: `Cheap Devices Need Updates Number ${i + 1}`, source: `Source ${i + 1}` })) });

describe('Laden der Liste mit Routine-Dokumenten', () => {
  it('liest nur `read/p`, zwei Monatsindizes und die Routine-Dokumente der drei Tage; nie ein Tagesdokument `read/d-…`', async () => {
    const { read, reads } = setup({ [readRoutinePath(DAY)]: routineSeed(2) });
    const home = await loadHome(read, DAY);
    expect(home.items.map((e) => e.id)).toEqual(['r-2026-10-14-1', 'r-2026-10-14-2']);
    expect(home.items[0]).toMatchObject({ src: 'routine', source: 'Source 1' });
    expect(home.routineHidden).toBe(0);
    expect(reads.filter((p) => p.startsWith('read/d-'))).toEqual([]);
    expect(new Set(reads)).toEqual(new Set(['read/p', 'read/m-2026-10', 'read/m-2026-09', 'read/r-2026-10-14', 'read/r-2026-10-13', 'read/r-2026-10-12']));
  });

  it('ein fehlerhafter Routine-Artikel wird ausgeblendet und gezählt, der Rest bleibt; das Dokument in der Datenbank bleibt unverändert', async () => {
    const doc = routineSeed(2);
    (doc.items as Raw[])[1]!.url = 'http://insecure.example.com/x';
    const { h, read } = setup({ [readRoutinePath(DAY)]: doc });
    const home = await loadHome(read, DAY);
    expect(home.items.map((e) => e.id)).toEqual(['r-2026-10-14-1']);
    expect(home.routineHidden).toBe(1);
    expect(h.dump()[readRoutinePath(DAY)]).toEqual(doc);
  });

  it('Lesefehler oder unbrauchbares Routine-Dokument brechen die Liste nicht ab', async () => {
    const { read } = setup({ [readRoutinePath(DAY)]: { v: 1, items: 'kaputt' } });
    const failing = async (path: string): Promise<Doc | undefined> => {
      if (path === readRoutinePath('2026-10-13')) throw new Error('boom');
      return read(path);
    };
    const own: Doc = { v: 1, items: [{ id: 'a-2026-10-14-1-abc123', day: DAY, title: 'Own', topic: 'ai', mins: 3, words: 400 }] };
    const home = await loadHome(async (p) => (p === 'read/m-2026-10' ? own : failing(p)), DAY);
    expect(home.items.map((e) => e.id)).toEqual(['a-2026-10-14-1-abc123']);
    expect(home.routineHidden).toBe(1);
  });

  it('Routine-Artikel von gestern erscheinen als frühere Artikel (nicht als heute)', async () => {
    const yesterday: Doc = { ...routineSeed(1), day: '2026-10-13', items: [{ ...example(), id: 'r-2026-10-13-1', title: 'Yesterday Cheap Devices Story' }] };
    const { read } = setup({ [readRoutinePath('2026-10-13')]: yesterday });
    const home = await loadHome(read, DAY);
    expect(home.items.map((e) => [e.id, e.day])).toEqual([['r-2026-10-13-1', '2026-10-13']]);
    expect(entriesOfDay(home.items, DAY)).toEqual([]);
  });
});

describe('Lesestand: die App schreibt ihn selbst, die Routine nie', () => {
  const seedEntry = (): IndexItem => routineEntryOf(parseRoutineDocItems()[0]!, DAY);
  function parseRoutineDocItems(): ArticleItem[] {
    const r = parseRoutineDoc(routineSeed(2), DAY);
    return r.ok ? r.items : [];
  }

  it('Plan: ohne Monatsdokument entsteht es mit dem Eintrag und dem Lesestand; mit Dokument wird der Eintrag angehängt', () => {
    const patch = { sec: 80, pos: 5, open: 2 };
    const created = stateUpdatePlan(undefined, 'r-2026-10-14-1', patch, seedEntry(), '2026-10');
    expect(created.outcome).toBe('created');
    expect(created.op).toMatchObject({ set: { v: 1, items: [{ id: 'r-2026-10-14-1', src: 'routine', st: { sec: 80, pos: 5, open: 2 } }] } });
    const other = { v: 1, items: [{ id: 'a-2026-10-14-1-abc123', day: DAY, title: 'Own' }] };
    const appended = stateUpdatePlan(other, 'r-2026-10-14-1', patch, seedEntry(), '2026-10');
    expect(appended.outcome).toBe('created');
    expect((appended.op as { update: { items: Array<{ id: string }> } }).update.items.map((e) => e.id)).toEqual(['a-2026-10-14-1-abc123', 'r-2026-10-14-1']);
  });

  it('ohne Vorlage bleibt ein fehlender Eintrag „missing“ (eigene Artikel: unverändertes Verhalten)', () => {
    expect(stateUpdatePlan(undefined, 'r-2026-10-14-1', { sec: 1 }).outcome).toBe('missing');
    expect(stateUpdatePlan({ v: 1, items: [] }, 'r-2026-10-14-1', { sec: 1 }).outcome).toBe('missing');
  });

  it('angefangen und gelesen bleiben über das Neuladen erhalten; die Routine-Dokumente werden dabei nicht verändert', async () => {
    const { h, writer, read } = setup({ [readRoutinePath(DAY)]: routineSeed(2) });
    const routineBefore = JSON.stringify(h.dump()[readRoutinePath(DAY)]);
    // Artikel 1 angefangen (Satz 6), danach gelesen.
    expect(await saveReadState(writer, '2026-10', 'r-2026-10-14-1', { sec: 120, pos: 6, open: 3 }, seedEntry())).toBe('updated');
    let home = await loadHome(read, DAY);
    expect(home.items.map((e) => [e.id, entryState(e)])).toEqual([
      ['r-2026-10-14-1', 'started'],
      ['r-2026-10-14-2', 'open'],
    ]);
    expect(nextToRead(entriesOfDay(home.items, DAY))?.id).toBe('r-2026-10-14-1');
    await saveReadState(writer, '2026-10', 'r-2026-10-14-1', { sec: 400, pos: 24, open: 5, done: true }, seedEntry());
    home = await loadHome(read, DAY);
    expect(home.items.map((e) => [e.id, entryState(e)])).toEqual([
      ['r-2026-10-14-1', 'done'],
      ['r-2026-10-14-2', 'open'],
    ]);
    expect(nextToRead(entriesOfDay(home.items, DAY))?.id).toBe('r-2026-10-14-2');
    // Der Monatsindex hat genau einen Eintrag; Zeit nur nach oben, „gelesen“ nur aufwärts (Maximum / keine Rücknahme).
    const month = h.dump()['read/m-2026-10'] as { items: IndexItem[] };
    expect(month.items).toHaveLength(1);
    await saveReadState(writer, '2026-10', 'r-2026-10-14-1', { sec: 10, done: false }, seedEntry());
    const after = (h.dump()['read/m-2026-10'] as { items: IndexItem[] }).items[0]!;
    expect(after.st).toMatchObject({ done: true, sec: 400 });
    expect(JSON.stringify(h.dump()[readRoutinePath(DAY)])).toBe(routineBefore);
    // Es wurde nur in Dokumente der App geschrieben: das Routine-Dokument ist nie Ziel eines App-Schreibens.
    expect(Object.keys(h.dump()).sort()).toEqual(['read/m-2026-10', readRoutinePath(DAY)].sort());
  });
});

describe('Holen von Hand neben der Routine', () => {
  it('Routine-Einträge zählen nicht als eigene Artikel: neuer Tag darf ein Tagesdokument anlegen, Nummerierung beginnt bei 1', async () => {
    const { h, writer, read } = setup({ [readRoutinePath(DAY)]: routineSeed(3) });
    const home = await loadHome(read, DAY);
    expect(home.items).toHaveLength(3);
    let n = 0;
    const result = await runFetch({
      writer,
      day: DAY,
      prefs: parsePrefs(undefined),
      items: home.items,
      count: 1,
      signal: new AbortController().signal,
      holder: 'test',
      // Platz für Tagesdokumente knapp unter der Sperre: ein NEUER Tag ist noch erlaubt, wenn nur Routine-Einträge da sind.
      dayDocs: 0,
      docTotal: 0,
      deps: {
        ask: ((req: { vars: { topic: string } }) => {
          n++;
          const raw = readFixtureReply(req.vars.topic);
          return Promise.resolve({ data: raw, tierApplied: 'default' as const, retried: false });
        }) as never,
      },
    });
    expect(n).toBe(1);
    expect(result.failure).toBeNull();
    expect(result.saved).toBe(1);
    const saved = Object.keys(h.dump()).filter((k) => k.startsWith('read/d-'));
    expect(saved).toEqual(['read/d-2026-10-14']);
    expect((h.dump()['read/d-2026-10-14'] as { items: Array<{ id: string }> }).items[0]!.id).toMatch(/^a-2026-10-14-1-/);
  });
});

function readFixtureReply(topic: string) {
  const e = example();
  return {
    title: 'A Fresh Take On Partnerships That Run Late', topic: topic as 'ai', kind: 'explainer' as const, level: 'c1', asOf: '2026', summary: 'Ein Artikel.',
    paras: e.paras, keyWords: e.keyWords as never, check: e.check as never,
  };
}
