/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten ab. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { askJson, resetAiGate } from '../../src/ai/gate';
import { AiFailure } from '../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import type { SampleFn } from '../../src/platform/types';
import type { PromptTemplate } from '../../src/prompts/types';

// P25: Hintergrundaufrufe erst nach einem beantworteten Nutzeraufruf (`sampleConfirmed`), nie ein Zustimmungsdialog mitten im Satzbau;
// nach `not_granted` und `rate_limited` ruhen sie für den Rest der Ansicht.

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

let sent = 0;
let failWith: { code: string } | null = null;
const sample = Object.assign(
  (() => {
    sent++;
    if (failWith) return Promise.reject(failWith);
    return Promise.resolve({ text: JSON.stringify({ ok: true }), truncated: false } as Claude.sample.SampleResult);
  }) as unknown as SampleFn,
  { json: () => Promise.reject({ code: 'invalid_request' }), limits: () => Promise.resolve({ maxPromptBytes: 65536 }) },
);

const bg: PromptTemplate<{ n: number }, { ok: boolean }> = { id: 'order-gen-x', version: 1, tier: 'quick', cache: false, budget: { bgPerDay: 5 }, build: (v) => `[order-gen-x@1]\nn: ${v.n}`, schema: () => z.object({ ok: z.boolean() }) };
const user: PromptTemplate<{ n: number }, { ok: boolean }> = { ...bg, id: 'user-x', budget: undefined, build: (v) => `[user-x@1]\nn: ${v.n}` };
const ask = (t: typeof bg, priority: 'user' | 'background') => askJson({ template: t, vars: { n: sent }, signal: new AbortController().signal, priority });

beforeAll(async () => {
  vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), claude: { use: (n: string) => Promise.resolve(n === 'sample' ? sample : null) }, addEventListener: () => undefined, removeEventListener: () => undefined });
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});
beforeEach(() => {
  sent = 0;
  failWith = null;
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('Zustimmung bekannt (`sampleConfirmed`)', () => {
  it('ohne beantworteten Nutzeraufruf sendet ein Hintergrundaufruf nichts', async () => {
    const err = await ask(bg, 'background').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect(err).toMatchObject({ kind: 'busy', code: 'no_consent_yet' });
    expect(sent).toBe(0);
    expect(useCapabilities.getState().sampleConfirmed).toBe(false);
  });

  it('nach einem beantworteten Nutzeraufruf sind Hintergrundaufrufe erlaubt', async () => {
    await ask(user, 'user');
    expect(useCapabilities.getState().sampleConfirmed).toBe(true);
    await ask(bg, 'background');
    expect(sent).toBe(2);
  });

  it('ein Hintergrundaufruf bestätigt nie selbst', async () => {
    const t = { ...bg, budget: undefined } as typeof bg;
    await ask(t, 'background');
    expect(useCapabilities.getState().sampleConfirmed).toBe(false);
  });

  it('nach not_granted ruhen alle Hintergrundaufrufe', async () => {
    await ask(user, 'user');
    failWith = { code: 'not_granted' };
    await ask(user, 'user').catch(() => undefined);
    failWith = null;
    useCapabilities.setState({ sampleRevoked: false });
    const before = sent;
    await expect(ask(bg, 'background')).rejects.toMatchObject({ code: 'bg_paused' });
    expect(sent).toBe(before);
  });

  it('nach rate_limited ruhen alle Hintergrundaufrufe für den Rest der Ansicht', async () => {
    await ask(user, 'user');
    failWith = { code: 'rate_limited' };
    await ask(user, 'user').catch(() => undefined);
    failWith = null;
    expect(useCapabilities.getState().backgroundPaused).toBe(true);
    await expect(ask(bg, 'background')).rejects.toMatchObject({ kind: 'busy' });
  });
});
