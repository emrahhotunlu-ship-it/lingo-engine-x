import { describe, expect, it, vi } from 'vitest';
import { AiFailure } from '../../src/ai/types';

// Vorab-Hörtext (Block 2): Nach einem Fehler startet derselbe Lerntag keinen zweiten KI-Aufruf
// (A6.3, sample.d.ts „do not retry from code“). Die Zwischenkarte löst prefetch nach jedem Block aus.

const askJson = vi.fn(() => Promise.reject(new AiFailure('invalid', 'invalid_json', 'aiInvalid')));
vi.mock('../../src/ai/gate', () => ({ askJson }));
vi.mock('../../src/ai/scope', () => ({ selectAiAvailable: () => true }));
vi.mock('../../src/features/discover/feedStore', () => ({ loadFeedOnce: () => Promise.resolve() }));
vi.mock('../../src/features/input/library', () => ({ ensureLibrary: () => Promise.resolve() }));
vi.mock('../../src/features/input/block/source', () => ({ unitListenFor: () => null }));
vi.mock('../../src/features/input/complete', () => ({ saveUnitListen: () => Promise.resolve() }));
vi.mock('../../src/domain/input/unitInput', () => ({
  inputBlockPlan: () => ({ kind: 'listen', src: 'theme-listen', summary: false, ladder: false }),
}));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => null }));

const { prefetchUnitInput, useUnitPrefetch } = await import('../../src/features/input/block/prefetch');

describe('prefetchUnitInput', () => {
  it('ruft askJson nach einem Fehler für denselben Schlüssel nicht erneut auf', async () => {
    await prefetchUnitInput();
    expect(askJson).toHaveBeenCalledTimes(1);
    expect(useUnitPrefetch.getState().status).toBe('error');
    await prefetchUnitInput();
    await prefetchUnitInput();
    expect(askJson).toHaveBeenCalledTimes(1);
    expect(useUnitPrefetch.getState().status).toBe('error');
  });
});
