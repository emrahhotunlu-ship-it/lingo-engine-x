import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';

// saveCtx2 (Lernplattform 3.0 P46, data-guard): nur die bekannten Felder werden überschrieben, unbekannte Unterfelder bleiben, `ctx` bleibt, kein Schreiben ohne Änderung.

const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
const { saveCtx2, cleanCtx2 } = await import('../../src/domain/tutor/ctx2');

let h: MemoryDbHandle;
beforeEach(() => {
  h = createMemoryDb({ seed: { 'app/profile': { name: 'E', ctx: 'Sales manager', ctx2: { v: 1, role: 'CTO', field: '', who: [], sit: [], terms: [], t: 1, extra: { keep: true } } } } });
  holder.writer = createWriter(h.db);
});

describe('saveCtx2', () => {
  it('speichert die bekannten Felder, behält das unbekannte Unterfeld und ctx', async () => {
    expect(await saveCtx2(cleanCtx2({ role: 'CFO', who: ['CFO'] }, 5))).toBe('saved');
    const p = h.dump()['app/profile'] as Record<string, unknown>;
    expect(p.ctx).toBe('Sales manager');
    expect(p.ctx2).toMatchObject({ role: 'CFO', who: ['CFO'], extra: { keep: true }, t: 5 });
  });
  it('gleicher Inhalt: kein Schreibvorgang', async () => {
    expect(await saveCtx2(cleanCtx2({ role: 'CTO' }, 9))).toBe('unchanged');
    expect((h.dump()['app/profile'] as { ctx2: { t: number } }).ctx2.t).toBe(1);
  });
});
