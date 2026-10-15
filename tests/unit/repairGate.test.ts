import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';

// Auswertung 15.10.2026, Punkt 1d: Eine „bessere Fassung“, die die Selbstprüfung nicht besteht, wird nicht als Vorbild gespeichert.

const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));

const { saveRepairs } = await import('../../src/features/repair/store');

let h: MemoryDbHandle;
const items = () => ((h.dump()['app/repair'] as { items?: Array<{ wrong: string; right: string }> } | undefined)?.items ?? []);

beforeEach(() => {
  h = createMemoryDb({ seed: {} });
  holder.writer = createWriter(h.db);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  holder.writer = null;
});

describe('saveRepairs: Selbstprüfung der besseren Fassung', () => {
  it('speichert eine saubere Fassung', async () => {
    expect(await saveRepairs([{ wrong: 'The list are needed.', right: 'The list is needed.', src: 'write' }])).toBe(true);
    expect(items().map((e) => e.right)).toEqual(['The list is needed.']);
  });

  it('speichert eine Fassung mit eindeutigem Fehler nicht (falsches „are“, absolving, gut feeling)', async () => {
    await saveRepairs([
      { wrong: 'The list with the types are needed.', right: 'The list with the document types are needed by Friday.', src: 'write' },
      { wrong: 'I suggest to absolve it.', right: 'I suggest absolving it.', src: 'talk' },
      { wrong: 'you have gut feeling', right: 'you have gut feeling that it is secure', src: 'say' },
    ]);
    expect(items()).toEqual([]);
  });

  it('nimmt Lehrer-Sätze ungeprüft (sie stammen nicht von der KI)', async () => {
    await saveRepairs([{ wrong: 'A wrong thing.', right: 'We discussed about it.', src: 'teacher' }]);
    expect(items()).toHaveLength(1);
  });

  it('gemischt: nur der saubere Eintrag wird gespeichert', async () => {
    await saveRepairs([
      { wrong: 'We discuss about it.', right: 'We discuss about it again.', src: 'write' },
      { wrong: 'I look forward for it.', right: 'I look forward to it.', src: 'write' },
    ]);
    expect(items().map((e) => e.right)).toEqual(['I look forward to it.']);
  });
});
