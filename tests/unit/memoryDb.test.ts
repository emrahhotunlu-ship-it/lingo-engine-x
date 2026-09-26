import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';

// Der Entwicklungs-Adapter muss sich wie der Vertrag in contract/db.d.ts verhalten,
// sonst prüfen die übrigen Tests das Falsche.

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('Entwicklungs-Datenbank nach contract/db.d.ts', () => {
  it('prüft die Pfadgrammatik synchron', () => {
    const { db } = createMemoryDb();
    expect(() => db.doc('vocab')).toThrow(TypeError);
    expect(() => db.collection('app/profile')).toThrow(TypeError);
    expect(() => db.doc('vocab/..')).toThrow(TypeError);
    expect(() => db.doc('vocab/a b')).toThrow(TypeError);
    expect(() => db.doc('vocab/ok-1')).not.toThrow();
  });

  it('update braucht ein bestehendes Dokument und verschmilzt nur Objekte', async () => {
    const { db } = createMemoryDb();
    await expect(db.doc('app/profile').update({ a: 1 })).rejects.toMatchObject({ code: 'invalid_argument' });
    await db.doc('app/profile').set({ theme: { m: 'dark', p: 'ocean' }, list: [1, 2] });
    await db.doc('app/profile').update({ theme: { m: 'light' }, list: [3] });
    const snap = await db.doc('app/profile').get();
    expect(snap.data()).toEqual({ theme: { m: 'light', p: 'ocean' }, list: [3] });
  });

  it('set ersetzt das ganze Dokument; Snapshots sind eingefroren', async () => {
    const { db } = createMemoryDb({ seed: { 'app/course': { done: {}, res: {} } } });
    await db.doc('app/course').set({ done: { l01: { n: 1 } } });
    const snap = await db.doc('app/course').get();
    expect(snap.data()).toEqual({ done: { l01: { n: 1 } } });
    expect(Object.isFrozen(snap.data())).toBe(true);
  });

  it('weist zu große Dokumente ab', async () => {
    const { db } = createMemoryDb();
    await expect(db.doc('app/chat').set({ big: 'x'.repeat(300 * 1024) })).rejects.toMatchObject({ code: 'invalid_argument' });
  });

  it('onSnapshot liefert den Stand und jede Änderung, bis abgemeldet wird', async () => {
    const h = createMemoryDb();
    const seen: unknown[] = [];
    const off = h.db.doc('app/schema').onSnapshot((s) => seen.push(s.exists ? s.data() : null));
    await tick();
    await h.db.doc('app/schema').set({ version: 1 });
    await tick();
    off();
    await h.db.doc('app/schema').set({ version: 2 });
    await tick();
    expect(seen).toEqual([null, { version: 1 }]);
    expect(h.activeSubscriptions()).toBe(0);
  });

  it('Abfragen: where, orderBy, limit und docChanges', async () => {
    const { db } = createMemoryDb({
      seed: { 'vocab/a': { word: 'a', stage: 2 }, 'vocab/b': { word: 'b', stage: 5 }, 'vocab/c': { word: 'c' }, 'grammar/x': { p: 1 } },
    });
    const q = await db.collection('vocab').where('stage', '>=', 2).orderBy('stage', 'desc').limit(1).get();
    expect(q.docs.map((d) => d.id)).toEqual(['b']);
    const all = await db.collection('vocab').orderBy('stage').get();
    expect(all.docs.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(all.docChanges().every((c) => c.type === 'added')).toBe(true);
  });

  it('höchstens 64 Abonnements je Ansicht', async () => {
    const { db } = createMemoryDb();
    const errors: string[] = [];
    const offs = Array.from({ length: 65 }, (_, i) => db.doc(`log/d${i}`).onSnapshot(() => undefined, (e) => errors.push(e.code)));
    await tick();
    expect(errors).toEqual(['resource_exhausted']);
    offs.forEach((o) => o());
  });

  it('acquire ist ein kooperatives Schloss', async () => {
    const { db } = createMemoryDb();
    expect((await db.doc('app/schema').acquire({ holder: 'a', ttlMs: 5000 })).acquired).toBe(true);
    expect((await db.doc('app/schema').acquire({ holder: 'b', ttlMs: 5000 })).acquired).toBe(false);
    expect((await db.doc('app/schema').acquire({ holder: 'a', ttlMs: 5000 })).acquired).toBe(true);
  });
});
