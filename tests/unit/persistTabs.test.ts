import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import type { AnswerEvent } from '../../src/domain/srs/types';
import type * as PersistModule from '../../src/features/progress/persist';

// W3: Zwei Tabs (bzw. Geräte) mit je eigener Sammel-Warteschlange schreiben gleichzeitig in
// `app/profile` und `log/<tag>`. Kein Zähler und kein Protokolleintrag darf verloren gehen.

type Persist = typeof PersistModule;

async function openTab(writer: Writer): Promise<Persist> {
  vi.resetModules();
  vi.doMock('../../src/data', () => ({ getWriter: () => writer }));
  return import('../../src/features/progress/persist');
}

const day = '2026-10-06';
const a = (t: number, id: string): AnswerEvent => ({ t, day, kind: 'v', id, ex: 'type', grade: 3, given: 'x', ans: 'x', ms: 1000, lang: 'de', ctx: 'rev' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../../src/data');
});

describe('W3: zwei Tabs verlieren keine Zählerstände', () => {
  it('gleichzeitige Sammel-Schreibvorgänge: belegt → vorgemerkt → später gesendet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = createMemoryDb({ seed: { 'app/profile': { days: { [day]: 10 }, xpDays: {}, act: {}, answers: 10, vAnswers: 10, gAnswers: 0, xp: 0 } }, latencyMs: 2 });
    const tabA = await openTab(createWriter(h.db));
    const tabB = await openTab(createWriter(h.db));
    expect(tabA.tabId()).not.toBe(tabB.tabId());
    tabA.recordAnswer(a(1, 'alpha'), false);
    tabA.recordAnswer(a(2, 'beta'), false);
    tabB.recordAnswer(a(3, 'gamma'), false);
    await Promise.all([tabA.flush(), tabB.flush()]);
    // Kein Fehlerhinweis: belegt ist ein normales Ergebnis.
    expect(tabA.usePending.getState().failed).toBe(false);
    expect(tabB.usePending.getState().failed).toBe(false);
    // Nach Ablauf der kurzen Sperre schreiben beide ihren Rest.
    const later = Date.now() + 6000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    await tabA.flush();
    await tabB.flush();
    const p = h.dump()['app/profile'] as Record<string, unknown>;
    expect(p.answers).toBe(13);
    expect((p.days as Record<string, number>)[day]).toBe(13);
    const log = h.dump()[`log/${day}`] as { entries: Array<{ id: string }> };
    expect(log.entries.map((e) => e.id).sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('beim Verlassen der Seite wird trotz belegter Sperre geschrieben (Puffer liegt nur im Speicher)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = createMemoryDb({ seed: { 'app/profile': { days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 } } });
    const tabA = await openTab(createWriter(h.db));
    const tabB = await openTab(createWriter(h.db));
    tabA.recordAnswer(a(1, 'alpha'), false);
    await tabA.flush();
    tabB.recordAnswer(a(2, 'beta'), false);
    await tabB.flush();
    expect((h.dump()['app/profile'] as Record<string, unknown>).answers).toBe(1);
    await tabB.flushOnHide();
    expect((h.dump()['app/profile'] as Record<string, unknown>).answers).toBe(2);
    expect((h.dump()[`log/${day}`] as { entries: unknown[] }).entries).toHaveLength(2);
  });
});
