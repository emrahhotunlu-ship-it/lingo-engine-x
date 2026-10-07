/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten ab. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { aiDay, BG_PER_DAY, bgTake, bgUsedToday, bgVerdict, resetAiBudget } from '../../src/ai/budget';
import { askJson, resetAiGate } from '../../src/ai/gate';
import { AiFailure } from '../../src/ai/types';
import { initCapabilities, markSampleConfirmed, useCapabilities } from '../../src/platform/capabilities';
import type { SampleFn } from '../../src/platform/types';
import type { PromptTemplate } from '../../src/prompts/types';
import { berlin } from './helpers';

// P25 (Lernplattform 3.0 §5.2): Ein Hintergrund-Budget für alle. Pure Zählregeln und der Weg durch das KI-Tor.

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
const sample = Object.assign(
  (() => {
    sent++;
    return Promise.resolve({ text: JSON.stringify({ ok: true }), truncated: false } as Claude.sample.SampleResult);
  }) as unknown as SampleFn,
  { json: () => Promise.reject({ code: 'invalid_request' }), limits: () => Promise.resolve({ maxPromptBytes: 65536 }) },
);

const tpl = (id: string, bgPerDay: number): PromptTemplate<{ n: number }, { ok: boolean }> => ({
  id,
  version: 1,
  tier: 'quick',
  cache: false,
  budget: { bgPerDay },
  build: (v) => `[${id}@1]\nn: ${v.n}`,
  schema: () => z.object({ ok: z.boolean() }),
});
const ask = (t: PromptTemplate<{ n: number }, { ok: boolean }>, priority: 'user' | 'background') => askJson({ template: t, vars: { n: sent }, signal: new AbortController().signal, priority });

const stubWindow = (): void => {
  vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), claude: { use: (n: string) => Promise.resolve(n === 'sample' ? sample : null) }, addEventListener: () => undefined, removeEventListener: () => undefined });
};

beforeAll(async () => {
  stubWindow();
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

beforeEach(() => {
  sent = 0;
  stubWindow();
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  markSampleConfirmed();
});
afterEach(() => vi.useRealTimers());

describe('Tagesbudget', () => {
  it('der 7. Hintergrundaufruf am Tag wird nicht gesendet; die Summe ist 6', async () => {
    const t = (id: string) => tpl(id, 5);
    // 5 Aufrufe für Vorlagen ohne die reservierte, danach ist Schluss für sie, `diagnose` darf noch (reservierter Platz).
    for (let i = 0; i < 5; i++) await ask(t(`gen-${i % 3}`), 'background').catch(() => undefined);
    expect(sent).toBe(5);
    const blocked = await ask(t('word-ctx'), 'background').catch((e: unknown) => e);
    expect(blocked).toBeInstanceOf(AiFailure);
    expect(blocked).toMatchObject({ kind: 'busy', code: 'budget' });
    expect(sent).toBe(5);
    await ask(tpl('diagnose', 1), 'background');
    expect(sent).toBe(6);
    expect(bgUsedToday()).toBe(BG_PER_DAY);
    const seventh = await ask(tpl('diagnose', 1), 'background').catch((e: unknown) => e);
    expect(seventh).toMatchObject({ code: 'budget' });
    expect(sent).toBe(6);
  });

  it('Deckel je Vorlage', async () => {
    const t = tpl('c1-gen', 2);
    await ask(t, 'background');
    await ask(t, 'background');
    await expect(ask(t, 'background')).rejects.toMatchObject({ code: 'budget' });
    expect(sent).toBe(2);
    expect(aiDay().n['c1-gen']).toBe(2);
  });

  it('Nutzeraufrufe sind nie gedeckelt und zählen nicht', async () => {
    const t = tpl('c1-gen', 1);
    for (let i = 0; i < 12; i++) await ask(t, 'user');
    expect(sent).toBe(12);
    expect(bgUsedToday()).toBe(0);
  });

  it('Tageswechsel um 04:00 setzt zurück', () => {
    const evening = berlin('2026-10-05', 22);
    bgTake('c1-gen', evening);
    bgTake('c1-gen', evening);
    expect(bgVerdict('c1-gen', 2, berlin('2026-10-06', 3, 59))).toBe('budget');
    expect(bgVerdict('c1-gen', 2, berlin('2026-10-06', 4, 1))).toBeNull();
    expect(bgUsedToday(berlin('2026-10-06', 5))).toBe(0);
  });

  it('ohne beschreibbaren Speicher gilt das Budget je Ansicht', () => {
    vi.stubGlobal('window', { localStorage: undefined, claude: undefined });
    resetAiBudget();
    const now = berlin('2026-10-05', 10);
    bgTake('word-ctx', now);
    expect(bgVerdict('word-ctx', 1, now)).toBe('budget');
    stubWindow();
  });

  it('Vorlagen ohne `budget` bleiben unberührt (bestehende Hintergrundaufrufe)', async () => {
    const t = { ...tpl('assess-x', 1), budget: undefined } as PromptTemplate<{ n: number }, { ok: boolean }>;
    for (let i = 0; i < 8; i++) await ask(t, 'background');
    expect(sent).toBe(8);
  });
});
