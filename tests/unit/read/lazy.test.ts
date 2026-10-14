import { describe, expect, it, vi } from 'vitest';
import { loadLazyBackup } from '../../../src/data/snapshot';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { docBytes, fitTextBudget, READ_BACKUP_TEXT_BUDGET_BYTES, readBackupPlan } from '../../../src/modules/read/domain/backup';
import { readDaysOf, readDocCountOf } from '../../../src/modules/read/domain/count';
import { afterSavePlan, DAYS_MAX, LAST_TOPICS_MAX, prefsPatchPlan } from '../../../src/modules/read/domain/prefsPlan';
import { loadHome, recordSaved, savePrefs } from '../../../src/modules/read/store';
import { itemNo } from './fixtures';

// L3 (Plan §11 Nachtrag): träge Sammlung `read`. Zählung über `read/p`, Sicherung in begrenzter Größe, Laden ohne Artikeltexte, Schreibpläne für `read/p`.

const dayDoc = (day: string, n = 1) => ({ v: 1, day, items: Array.from({ length: n }, (_, i) => itemNo(i + 1, day)) });

function recording(seed: Record<string, Record<string, unknown>>) {
  const h = createMemoryDb({ seed });
  const asked = { collections: [] as string[], docs: [] as string[] };
  const db = {
    ...h.db,
    collection: (name: string) => {
      asked.collections.push(name);
      return h.db.collection(name);
    },
    doc: (path: string) => {
      asked.docs.push(path);
      return h.db.doc(path);
    },
  };
  return { h, db, asked };
}

describe('Dokumentzählung ohne Texte', () => {
  it('p + ein Tagesdokument je Lerntag + ein Monatsindex je Monat', () => {
    expect(readDocCountOf(undefined)).toBe(0);
    expect(readDocCountOf({ v: 1 })).toBe(1);
    expect(readDocCountOf({ days: ['2026-09-17', '2026-09-19'] })).toBe(1 + 2 + 1);
    expect(readDocCountOf({ days: ['2026-09-30', '2026-10-01', '2026-10-02'] })).toBe(1 + 3 + 2);
  });

  it('ungültige und doppelte Einträge zählen nicht', () => {
    expect(readDaysOf({ days: ['2026-10-02', '2026-10-02', 'x', 5, '2026-1-1', '2026-10-01'] })).toEqual(['2026-10-01', '2026-10-02']);
    expect(readDocCountOf({ days: 'kein Feld' })).toBe(1);
  });
});

describe('Sicherung in begrenzter Größe', () => {
  it('Plan: Einstellungen und Monatsindizes immer, Tagesdokumente neueste zuerst', () => {
    const plan = readBackupPlan({ days: ['2026-09-17', '2026-09-19', '2026-10-01'] });
    expect(plan.index).toEqual(['read/p', 'read/m-2026-09', 'read/m-2026-10']);
    expect(plan.texts).toEqual(['read/d-2026-10-01', 'read/d-2026-09-19', 'read/d-2026-09-17']);
  });

  it('fitTextBudget: nimmt auf, solange das Budget reicht; ein Dokument, das nicht passt, beendet die Aufnahme', () => {
    const sizes = [
      { path: 'a', bytes: 3000 },
      { path: 'b', bytes: 3000 },
      { path: 'c', bytes: 3000 },
    ];
    expect(fitTextBudget(sizes, 7000)).toEqual({ included: ['a', 'b'], omitted: ['c'] });
    expect(fitTextBudget(sizes, 100)).toEqual({ included: [], omitted: ['a', 'b', 'c'] });
    expect(fitTextBudget(sizes, 100_000).omitted).toEqual([]);
    expect(READ_BACKUP_TEXT_BUDGET_BYTES).toBe(1_500_000);
  });

  it('loadLazyBackup: Index und Zustand immer, Texte nur im Budget, der Rest wird gemeldet (nie still weggelassen)', async () => {
    const days = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-10-01'];
    const seed: Record<string, Record<string, unknown>> = { 'read/p': { v: 1, days }, 'read/m-2026-09': { v: 1, items: [] }, 'read/m-2026-10': { v: 1, items: [] } };
    for (const d of days) seed[`read/d-${d}`] = dayDoc(d);
    const one = docBytes(dayDoc('2026-09-10'));
    const { db } = recording(seed);
    const res = await loadLazyBackup(db, one * 2 + 50);
    expect(Object.keys(res.docs).sort()).toEqual(['read/d-2026-09-14', 'read/d-2026-10-01', 'read/m-2026-09', 'read/m-2026-10', 'read/p']);
    expect(res.omitted).toEqual(['read/d-2026-09-13', 'read/d-2026-09-12', 'read/d-2026-09-11', 'read/d-2026-09-10']);
    expect(res.textBytes).toBeLessThanOrEqual(one * 2 + 50);
    // Die Datenbank bleibt unberührt.
    const all = await loadLazyBackup(db);
    expect(all.omitted).toEqual([]);
    expect(Object.keys(all.docs)).toHaveLength(1 + 2 + 6);
  });

  it('loadLazyBackup: ohne read/p gibt es nichts zu sichern; fehlende Tagesdokumente gelten nicht als ausgelassen', async () => {
    expect(await loadLazyBackup(recording({}).db)).toEqual({ docs: {}, omitted: [], textBytes: 0 });
    const { db } = recording({ 'read/p': { v: 1, days: ['2026-10-01'] } });
    const r = await loadLazyBackup(db);
    expect(r.omitted).toEqual([]);
    expect(Object.keys(r.docs)).toEqual(['read/p']);
  });

  it('loadLazyBackup: ein Tag, der nur im Monatsindex steht (fehlt in read/p.days), wird trotzdem gesichert', async () => {
    const seed: Record<string, Record<string, unknown>> = {
      'read/p': { v: 1, days: ['2026-09-17'] },
      'read/m-2026-09': { v: 1, items: [{ id: 'a-2026-09-17-1-aaaaaa', day: '2026-09-17', title: 'A' }, { id: 'a-2026-09-18-1-bbbbbb', day: '2026-09-18', title: 'B' }, { id: 'x', day: '2026-10-01', title: 'falscher Monat' }] },
      'read/d-2026-09-17': dayDoc('2026-09-17'),
      'read/d-2026-09-18': dayDoc('2026-09-18'),
    };
    const r = await loadLazyBackup(recording(seed).db);
    expect(Object.keys(r.docs).sort()).toEqual(['read/d-2026-09-17', 'read/d-2026-09-18', 'read/m-2026-09', 'read/p']);
    expect(r.omitted).toEqual([]);
  });

  it('loadLazyBackup: fehlt read/p ganz, werden die letzten Monate nach Indizes abgesucht (nie still nichts sichern)', async () => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const day = `${month}-03`;
    const seed: Record<string, Record<string, unknown>> = {
      [`read/m-${month}`]: { v: 1, items: [{ id: `a-${day}-1-aaaaaa`, day, title: 'A' }] },
      [`read/d-${day}`]: dayDoc(day),
    };
    const r = await loadLazyBackup(recording(seed).db);
    expect(Object.keys(r.docs).sort()).toEqual([`read/d-${day}`, `read/m-${month}`]);
  });
});

describe('Sicherung: Lesefehler in read/ bricht die Sicherung nicht ab', () => {
  it('exportAll sichert ohne Lesen-Dokumente und vermerkt readBackupFailed', async () => {
    const { exportAll } = await import('../../../src/features/settings/exportData');
    const { snapshotFromRecord } = await import('../../../src/data/snapshot');
    const saved: string[] = [];
    const caps = await import('../../../src/platform/capabilities');
    const h = createMemoryDb({ seed: { 'read/p': { v: 1, days: ['2026-10-01'] } } });
    const failing = { ...h.db, doc: (path: string) => (path.startsWith('read/') ? { ...h.db.doc(path), get: () => Promise.reject(new Error('boom')) } : h.db.doc(path)) };
    const dl = await import('../../../src/platform/downloads');
    const spyCaps = vi.spyOn(caps, 'getDb').mockReturnValue(failing);
    const spyDl = vi.spyOn(dl, 'saveFile').mockImplementation((_name: string, text: string) => {
      saved.push(text);
      return Promise.resolve('saved');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const out = await exportAll(snapshotFromRecord({ 'app/profile': { v: 1 } }));
    spyCaps.mockRestore();
    spyDl.mockRestore();
    expect(out).toBe('saved');
    const payload = JSON.parse(saved[0] ?? '{}') as { readBackupFailed?: boolean; documents: Record<string, unknown> };
    expect(payload.readBackupFailed).toBe(true);
    expect(Object.keys(payload.documents)).toEqual(['app/profile']);
  });
});

describe('Laden ohne Artikeltexte', () => {
  it('loadHome liest nur read/p, zwei Monatsindizes und drei Routine-Dokumente, nie ein Tagesdokument oder die Sammlung', async () => {
    const { db, asked } = recording({
      'read/p': { v: 1, perDay: 2, days: ['2026-09-30', '2026-10-01'] },
      'read/m-2026-09': { v: 1, items: [{ id: 'a-2026-09-30-1-aaaaaa', day: '2026-09-30', title: 'Alt', topic: 'ai', mins: 4, words: 520, st: { done: true } }] },
      'read/m-2026-10': { v: 1, items: [{ id: 'a-2026-10-01-1-bbbbbb', day: '2026-10-01', title: 'Neu', topic: 'saas', mins: 5, words: 600 }, { title: 'ohne Kennung' }] },
      'read/d-2026-10-01': dayDoc('2026-10-01'),
    });
    const h = await loadHome(async (path) => {
      const s = await db.doc(path).get();
      return s.exists ? s.data() : undefined;
    }, '2026-10-02');
    expect(asked.collections).toEqual([]);
    // Dazu je ein `get` für die Routine-Dokumente von heute und den zwei Tagen davor (fehlende sind normal); nie `read/d-…`.
    expect(asked.docs.sort()).toEqual(['read/m-2026-09', 'read/m-2026-10', 'read/p', 'read/r-2026-09-30', 'read/r-2026-10-01', 'read/r-2026-10-02']);
    expect(h.items.map((i) => i.title)).toEqual(['Alt', 'Neu']); // älteste zuerst
    expect(h.hidden).toBe(1);
    expect(h.prefs.perDay).toBe(2);
    expect(h.days).toEqual(['2026-09-30', '2026-10-01']);
  });

  it('ohne Dokumente: leere Ansicht mit Voreinstellungen', async () => {
    const h = await loadHome(() => Promise.resolve(undefined), '2026-10-02');
    expect(h.items).toEqual([]);
    expect(h.prefs.perDay).toBe(3);
    expect(h.prefs.view).toBe('b');
    expect(h.days).toEqual([]);
  });
});

describe('Schreibpläne für read/p', () => {
  it('afterSavePlan: legt p an, trägt den Lerntag ein (neu berechnet, kein Zähler), merkt Thema und „heute erzeugt“', () => {
    const op = afterSavePlan(undefined, { day: '2026-10-02', topicId: 'ai', countToday: 1 });
    expect(op).toEqual({ set: { v: 1, days: ['2026-10-02'], lastTopics: ['ai'], gen: { d: '2026-10-02', n: 1 } } });
    const cur = { v: 1, days: ['2026-10-02'], lastTopics: ['ai'], gen: { d: '2026-10-02', n: 1 }, topics: { ai: 1 } };
    const op2 = afterSavePlan(cur, { day: '2026-10-02', topicId: 'saas', countToday: 2 });
    expect(op2).toEqual({ update: { lastTopics: ['saas', 'ai'], gen: { d: '2026-10-02', n: 2 } } });
    const op3 = afterSavePlan(cur, { day: '2026-10-03', topicId: 'ai', countToday: 1 });
    expect(op3).toEqual({ update: { days: ['2026-10-02', '2026-10-03'], lastTopics: ['ai', 'ai'], gen: { d: '2026-10-03', n: 1 } } });
  });

  it('afterSavePlan: Themen-Merkliste und Tageliste sind begrenzt; `gen.n` fällt nie zurück; eine Änderung am Lerntag ist nicht nötig, wenn er schon steht', () => {
    const cur = { v: 1, days: ['2026-10-02'], lastTopics: ['ai'], gen: { d: '2026-10-02', n: 3 } };
    const same = afterSavePlan(cur, { day: '2026-10-02', topicId: 'ai', countToday: 2 }) as { update: Record<string, unknown> };
    expect(same.update.days).toBeUndefined();
    expect(same.update.gen).toBeUndefined(); // n bleibt 3, nicht 2
    const many = { v: 1, days: [], lastTopics: Array.from({ length: 20 }, (_, i) => `t${i}`) };
    const op = afterSavePlan(many, { day: '2026-10-02', topicId: 'x', countToday: 1 }) as { update: { lastTopics: string[] } };
    expect(op.update.lastTopics).toHaveLength(LAST_TOPICS_MAX);
    expect(op.update.lastTopics[0]).toBe('x');
    const days = Array.from({ length: DAYS_MAX }, (_, i) => `2024-${String(1 + Math.floor(i / 28) % 12).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`);
    const op2 = afterSavePlan({ v: 1, days: [...new Set(days)] }, { day: '2030-01-01', topicId: 'ai', countToday: 1 }) as { update: { days: string[] } };
    expect(op2.update.days.length).toBeLessThanOrEqual(DAYS_MAX);
    expect(op2.update.days.at(-1)).toBe('2030-01-01');
  });

  it('prefsPatchPlan: nur geänderte Felder; unverändert → null; ohne Dokument → set', () => {
    expect(prefsPatchPlan({ v: 1, perDay: 3 }, { perDay: 3 })).toBeNull();
    expect(prefsPatchPlan({ v: 1, perDay: 3 }, { perDay: 4 })).toEqual({ update: { perDay: 4 } });
    expect(prefsPatchPlan(undefined, { perDay: 2 })).toEqual({ set: { v: 1, perDay: 2 } });
    expect(prefsPatchPlan({ v: 1, topics: { ai: 1 } }, { topics: { ai: 1 } })).toBeNull();
  });

  it('recordSaved/savePrefs über den echten Schreibpfad: der Lerntag wird nur einmal eingetragen, die Zählung folgt', async () => {
    const h = createMemoryDb({ seed: {} });
    const w = createWriter(h.db);
    await recordSaved(w, { day: '2026-10-02', topicId: 'ai', countToday: 1 });
    await recordSaved(w, { day: '2026-10-02', topicId: 'saas', countToday: 2 });
    expect(h.writes().filter((x) => x.path === 'read/p').map((x) => x.op)).toEqual(['set', 'update']);
    const p = h.dump()['read/p'] as { days: string[]; lastTopics: string[]; gen: { n: number } };
    expect(p.days).toEqual(['2026-10-02']);
    expect(p.lastTopics).toEqual(['saas', 'ai']);
    expect(p.gen.n).toBe(2);
    expect(readDocCountOf(p)).toBe(1 + 1 + 1);
    await savePrefs(w, { perDay: 5, topics: { ai: 1 } });
    expect((h.dump()['read/p'] as { perDay: number }).perDay).toBe(5);
    expect((h.dump()['read/p'] as { days: string[] }).days).toEqual(['2026-10-02']);
  });
});
