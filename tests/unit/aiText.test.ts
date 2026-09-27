/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten {code, message, text?} ab, nicht mit Error. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { askJson, refreshCache, resetAiGate, SLOW_AFTER_MS } from '../../src/ai/gate';
import { useAiStatus } from '../../src/ai/status';
import { askText, inputProblem } from '../../src/ai/stream';
import { AiFailure, type AiPhase } from '../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import type { SampleFn, SampleOptions } from '../../src/platform/types';
import type { PromptTemplate, TurnInput } from '../../src/prompts/types';

// Text- und Streaming-Weg des KI-Tors (Phase 5 §4, §10.1 aiText.test.ts).

type Call = { input: Claude.sample.SampleInput; options: SampleOptions; resolve: (v: unknown) => void; reject: (e: unknown) => void };
let calls: Call[] = [];
let impl: SampleFn | null = null;

function manualSample(): SampleFn {
  const run = (input: Claude.sample.SampleInput, options?: SampleOptions) =>
    new Promise<Claude.sample.SampleResult>((resolve, reject) => {
      calls.push({ input, options: options ?? {}, resolve: (v) => resolve(v as Claude.sample.SampleResult), reject });
      options?.signal?.addEventListener('abort', () => reject({ code: 'cancelled', message: 'aborted', text: 'teil' }), { once: true });
    });
  const json = <T,>(input: Claude.sample.SampleInput, options?: SampleOptions): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      calls.push({ input, options: options ?? {}, resolve: (v) => resolve(v as T), reject });
    });
  return Object.assign(run as SampleFn, { json, limits: () => Promise.resolve({ maxPromptBytes: 65536 }) });
}

const proxy = Object.assign(((input: Claude.sample.SampleInput, options?: SampleOptions) => impl!(input, options)) as SampleFn, {
  json: <T,>(input: Claude.sample.SampleInput, options?: SampleOptions) => impl!.json<T>(input, options),
  limits: () => impl!.limits(),
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const turns: TurnInput = [
  { role: 'user', content: '[companion-chat@1]\nRules' },
  { role: 'user', content: 'Was heißt leverage?' },
];

const req = (over: Partial<Parameters<typeof askText>[0]> = {}) => ({
  id: 'companion-chat',
  version: 1,
  tier: 'default' as const,
  input: turns,
  cache: false as const,
  signal: new AbortController().signal,
  ...over,
});

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = { claude: { use: (name: string) => Promise.resolve(name === 'sample' ? proxy : null) } };
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

beforeEach(() => {
  calls = [];
  impl = manualSample();
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('askText', () => {
  it('Phasen thinking → streaming → done, Text weitergereicht, genau ein Aufruf mit cache:false und Schritten', async () => {
    const phases: AiPhase[] = [];
    const texts: string[] = [];
    const p = askText(req({ onPhase: (x) => phases.push(x), onText: (u) => texts.push(u.text) }));
    await flush();
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(Array.isArray(c.input)).toBe(true);
    expect(c.options.cache).toBe(false);
    expect(c.options.modelTier).toBe('default');
    c.options.onText?.({ text: 'Hallo', delta: 'Hallo' });
    c.options.onText?.({ text: 'Hallo Welt', delta: ' Welt' });
    c.resolve({ text: 'Hallo Welt', truncated: false, modelTierApplied: 'quick' });
    const r = await p;
    expect(r).toEqual({ text: 'Hallo Welt', truncated: false, tierApplied: 'quick' });
    expect(phases).toEqual(['thinking', 'streaming', 'done']);
    expect(texts).toEqual(['Hallo', 'Hallo Welt']);
  });

  it('`slow` nach SLOW_AFTER_MS ohne Abbruch', async () => {
    vi.useFakeTimers();
    const phases: AiPhase[] = [];
    const ctl = new AbortController();
    const p = askText(req({ signal: ctl.signal, onPhase: (x) => phases.push(x) }));
    await flush();
    vi.advanceTimersByTime(SLOW_AFTER_MS.default + 10);
    expect(phases).toContain('slow');
    expect(ctl.signal.aborted).toBe(false);
    calls[0]!.resolve({ text: 'ok', truncated: false, modelTierApplied: 'default' });
    await expect(p).resolves.toMatchObject({ text: 'ok' });
  });

  it('Stopp → cancelled ohne Phase error', async () => {
    const phases: AiPhase[] = [];
    const ctl = new AbortController();
    const p = askText(req({ signal: ctl.signal, onPhase: (x) => phases.push(x) }));
    await flush();
    ctl.abort();
    await expect(p).rejects.toMatchObject({ kind: 'cancelled' });
    expect(phases).not.toContain('error');
  });

  it('refused ohne Teiltext, upstream_error mit Teiltext; nie ein Neuversuch', async () => {
    for (const [code, partial] of [
      ['refused', undefined],
      ['upstream_error', 'Anfang'],
      ['rate_limited', undefined],
      ['empty_completion', undefined],
    ] as const) {
      calls = [];
      resetAiGate();
      const p = askText(req());
      await flush();
      calls[0]!.reject({ code, message: code, text: code === 'refused' ? 'zurückgezogen' : partial });
      const err = await p.catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AiFailure);
      expect((err as AiFailure).partial).toBe(partial);
      await flush();
      expect(calls).toHaveLength(1);
    }
  });

  it('rate_limited → Pause; der nächste Aufruf erreicht sample nicht', async () => {
    const p = askText(req());
    await flush();
    calls[0]!.reject({ code: 'rate_limited', message: 'slow down' });
    await expect(p).rejects.toMatchObject({ kind: 'busy' });
    expect(useAiStatus.getState().pausedUntil).toBeGreaterThan(Date.now());
    await expect(askText(req())).rejects.toMatchObject({ kind: 'busy', code: 'paused' });
    expect(calls).toHaveLength(1);
  });

  it('falsche Schrittliste oder zu große Eingabe → 0 Aufrufe', async () => {
    await expect(askText(req({ input: [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'y' }] }))).rejects.toMatchObject({ kind: 'bug' });
    await expect(askText(req({ input: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] }))).rejects.toMatchObject({ kind: 'bug' });
    await expect(askText(req({ input: [{ role: 'user', content: '   ' }] }))).rejects.toMatchObject({ kind: 'bug' });
    await expect(askText(req({ input: 'ä'.repeat(31_000) }))).rejects.toMatchObject({ kind: 'too_large' });
    expect(calls).toHaveLength(0);
    expect(inputProblem(turns)).toBeNull();
  });
});

describe('askJson mit refresh (E5-21)', () => {
  const tpl: PromptTemplate<{ w: string }, { ok: boolean }> = {
    id: 'unit-refresh',
    version: 1,
    tier: 'quick',
    cache: { gcTime: 86_400_000 },
    build: (v) => `[unit-refresh@1]\n${v.w}`,
    schema: () => z.object({ ok: z.boolean() }),
  };

  it('ohne refresh: Zwischenspeicher der Vorlage; mit refresh: {gcTime, refresh:true}', async () => {
    const p1 = askJson({ template: tpl, vars: { w: 'a' }, signal: new AbortController().signal });
    await flush();
    expect(calls[0]!.options.cache).toEqual({ gcTime: 86_400_000 });
    calls[0]!.resolve({ text: '{"ok":true}', truncated: false });
    await p1;
    const p2 = askJson({ template: tpl, vars: { w: 'a' }, signal: new AbortController().signal, refresh: true });
    await flush();
    expect(calls[1]!.options.cache).toEqual({ gcTime: 86_400_000, refresh: true });
    calls[1]!.resolve({ text: '{"ok":true}', truncated: false });
    await p2;
  });

  it('refreshCache: true → 5 min, false bleibt false', () => {
    expect(refreshCache(true)).toEqual({ gcTime: 300_000, refresh: true });
    expect(refreshCache(false)).toBe(false);
  });
});
