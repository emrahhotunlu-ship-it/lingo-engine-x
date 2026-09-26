import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { createWriter, WriteError } from '../../src/data/writer';

describe('Der eine Schreibpfad', () => {
  it('schreibt nicht, wenn sich nichts ändert', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': { lang: 'de', theme: { m: 'dark', p: 'ocean' } } } });
    const w = createWriter(h.db);
    expect(await w.patch('app/profile', { lang: 'de' })).toBe('unchanged');
    expect(await w.patch('app/profile', { theme: { m: 'dark' } })).toBe('unchanged');
    expect(await w.set('app/course', { done: {} }, { done: {} })).toBe('unchanged');
    expect(h.writes()).toEqual([]);
    expect(await w.patch('app/profile', { theme: { m: 'light' } })).toBe('written');
    expect((await h.db.doc('app/profile').get()).data()).toEqual({ lang: 'de', theme: { m: 'light', p: 'ocean' } });
  });

  it('ersetzt nie ein bestehendes Dokument – auch nicht bei falschem Hinweis „fehlt"', async () => {
    const profile = { lang: 'de', rate: 'schnell', days: { '2026-09-20': 40 }, xpDays: { '2026-09-20': 120 } };
    const h = createMemoryDb({ seed: { 'app/profile': profile } });
    const w = createWriter(h.db);
    expect(await w.patch('app/profile', { lang: 'en' }, null)).toBe('written');
    expect((await h.db.doc('app/profile').get()).data()).toEqual({ ...profile, lang: 'en' });
    expect(h.writes()).toEqual([{ op: 'update', path: 'app/profile' }]);
  });

  it('transform liest, rechnet und schreibt in einem Schritt – und legt nie über Bestehendes an', async () => {
    const h = createMemoryDb({ seed: { 'app/course': { done: { l01: {} } } } });
    const w = createWriter(h.db);
    await expect(w.transform('app/course', () => ({ set: { done: {} } }))).rejects.toMatchObject({ code: 'exists' });
    expect(await w.transform('app/course', (cur) => ({ update: { done: { ...(cur?.done as object), l02: {} } } }))).toBe('updated');
    expect(await w.transform('app/course', () => ({ update: { done: { l01: {} } } }))).toBe('unchanged');
    expect(await w.transform('app/chat', (cur) => (cur ? null : { set: { msgs: [] } }))).toBe('created');
    expect(await w.createIfMissing('app/chat', { msgs: [1] })).toBe('exists');
    expect((await h.db.doc('app/chat').get()).data()).toEqual({ msgs: [] });
  });

  it('legt ein fehlendes Dokument per patch an, update verlangt ein bestehendes', async () => {
    const h = createMemoryDb();
    const w = createWriter(h.db);
    expect(await w.patch('app/profile', { lang: 'en' }, null)).toBe('written');
    await expect(w.update('vocab/fehlt', { fsrs: {} })).rejects.toBeInstanceOf(WriteError);
  });

  it('verweigert daily/* und feed/* (schreibt nur der Tagesauftrag)', () => {
    const h = createMemoryDb({ seed: { 'daily/2026-09-20': { newWords: [] } } });
    const w = createWriter(h.db);
    expect(() => w.set('daily/2026-09-20', { newWords: [1] })).toThrow(WriteError);
    expect(() => w.patch('feed/2026-09-20', { items: [] })).toThrow(WriteError);
    expect(h.writes()).toEqual([]);
  });

  it('kennt kein Löschen', () => {
    const w = createWriter(createMemoryDb().db) as unknown as Record<string, unknown>;
    expect(w.delete).toBeUndefined();
    expect(Object.keys(w).sort()).toEqual(['acquire', 'createIfMissing', 'patch', 'set', 'transform', 'update']);
  });

  it('acquire: kurze Sperre ohne data; belegt ist ein normales Ergebnis; daily/* verweigert', async () => {
    const h = createMemoryDb({ seed: { 'app/pool': { items: [] } } });
    const a = createWriter(h.db);
    expect(await a.acquire('app/pool', { holder: 'tab-a', ttlMs: 15000 })).toMatchObject({ acquired: true });
    expect(await a.acquire('app/pool', { holder: 'tab-b', ttlMs: 15000 })).toMatchObject({ acquired: false });
    // Verlängern mit derselben Kennung geht; das Dokument bleibt unverändert.
    expect(await a.acquire('app/pool', { holder: 'tab-a', ttlMs: 15000 })).toMatchObject({ acquired: true });
    expect(h.dump()['app/pool']).toEqual({ items: [] });
    await expect(a.acquire('daily/2026-09-27', { holder: 'tab-a' })).rejects.toMatchObject({ code: 'read_only' });
  });

  it('schreibt je Dokument nacheinander, in Aufruf-Reihenfolge', async () => {
    const h = createMemoryDb({ latencyMs: 3 });
    const w = createWriter(h.db);
    await Promise.all([w.set('app/chat', { n: 1 }), w.set('app/chat', { n: 2 }), w.set('app/chat', { n: 3 })]);
    expect((await h.db.doc('app/chat').get()).data()).toEqual({ n: 3 });
    expect(h.writes().filter((x) => x.path === 'app/chat')).toHaveLength(3);
  });

  it('wiederholt „unavailable" genau einmal, andere Fehler nie', async () => {
    const h = createMemoryDb();
    const w = createWriter(h.db);
    h.setFailWrites('unavailable');
    await expect(w.set('app/chat', { n: 1 })).rejects.toMatchObject({ code: 'unavailable' });
    h.setFailWrites('quota_exceeded');
    await expect(w.set('app/chat', { n: 1 })).rejects.toMatchObject({ code: 'quota_exceeded' });
    h.setFailWrites(undefined);
    expect(await w.set('app/chat', { n: 1 })).toBe('written');
  });
});

describe('replace nur für Zwischenspeicher', () => {
  it('ersetzt app/lookup, verweigert Lernstände', async () => {
    const h = createMemoryDb({ seed: { 'app/lookup': { items: { a: null } }, 'vocab/x': { word: 'x' } } });
    const w = createWriter(h.db);
    await expect(w.transform('app/lookup', () => ({ replace: { items: {} } }))).resolves.toBe('updated');
    await expect(w.transform('vocab/x', () => ({ replace: { word: 'y' } }))).rejects.toMatchObject({ code: 'invalid_argument' });
    expect(h.dump()['vocab/x']).toEqual({ word: 'x' });
  });
});
