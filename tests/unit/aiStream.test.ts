/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten {code, message, text?} ab, nicht mit Error. */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAiGate } from '../../src/ai/gate';
import { useAiStatus } from '../../src/ai/status';
import { askStream, turnsBytes } from '../../src/ai/stream';
import { AiFailure, type AiPhase } from '../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import { getLog } from '../../src/platform/diagnostics';
import type { SampleFn, SampleOptions } from '../../src/platform/types';
import type { ChatTemplate } from '../../src/prompts/types';

// Streaming-Weg des KI-Tors (Plan §6.1, §9.1): bereinigtes onText, Budget, Stopp in der
// Warteschlange, rate_limited → Pause ohne Neuversuch, truncated, leerer Text, Teiltext.

type Call = { input: Claude.sample.SampleInput; options: SampleOptions; resolve: (v: Claude.sample.SampleResult) => void; reject: (e: unknown) => void };
let calls: Call[] = [];

function manual(): SampleFn {
  const fn = ((input: Claude.sample.SampleInput, options?: SampleOptions) =>
    new Promise<Claude.sample.SampleResult>((resolve, reject) => {
      calls.push({ input, options: options ?? {}, resolve, reject });
      options?.signal?.addEventListener('abort', () => reject({ code: 'cancelled', message: 'aborted', text: 'Well, I' }), { once: true });
    })) as unknown as SampleFn;
  return Object.assign(fn, { json: () => Promise.reject({ code: 'invalid_request', message: 'json not used' }), limits: () => Promise.resolve({ maxPromptBytes: 65536 }) });
}

let impl: SampleFn = manual();
const proxy = Object.assign(((input: Claude.sample.SampleInput, options?: SampleOptions) => impl(input, options)) as SampleFn, {
  json: <T,>(input: Claude.sample.SampleInput, options?: SampleOptions) => impl.json<T>(input, options),
  limits: () => impl.limits(),
});

type V = { turns: string[]; big?: boolean };
const tpl: ChatTemplate<V> = {
  id: 'chat-test',
  version: 1,
  tier: 'quick',
  cache: false,
  build: (v) => [{ role: 'user', content: `[chat-test@1]\nRules${v.big ? 'x'.repeat(61_000) : ''}` }, ...v.turns.map((c, i) => ({ role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), content: c }))],
  clean: (t) => t.replace(/^Reinhard Vogt:\s*/, '').replace(/\*[^*]+\*/g, '').replace(/\s+/g, ' ').trim(),
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = { claude: { use: (name: string) => Promise.resolve(name === 'sample' ? proxy : null) } };
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

beforeEach(() => {
  calls = [];
  impl = manual();
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('askStream', () => {
  it('streamt bereinigten Text, ruft sample mit Zugliste, cache:false und Stufe auf', async () => {
    const texts: string[] = [];
    const phases: AiPhase[] = [];
    const p = askStream({ template: tpl, vars: { turns: ['Hi there'] }, signal: new AbortController().signal, onText: (t) => texts.push(t), onPhase: (ph) => phases.push(ph) });
    await flush();
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(Array.isArray(c.input)).toBe(true);
    expect(c.options.cache).toBe(false);
    expect(c.options.modelTier).toBe('quick');
    c.options.onText?.({ text: 'Reinhard Vogt: *leans back* Let me', delta: 'x' });
    c.options.onText?.({ text: 'Reinhard Vogt: *leans back* Let me be direct.', delta: 'x' });
    c.resolve({ text: 'Reinhard Vogt: *leans back* Let me be direct.', truncated: false, modelTierApplied: 'quick' });
    const r = await p;
    expect(texts).toEqual(['Let me', 'Let me be direct.']);
    expect(r).toEqual({ text: 'Let me be direct.', truncated: false, tierApplied: 'quick' });
    expect(phases).toEqual(['thinking', 'streaming', 'done']);
  });

  it('Budget > 60.000 Bytes: kein Aufruf, Fehler too_large', async () => {
    const vars = { turns: ['Hi'], big: true };
    expect(turnsBytes(tpl.build(vars))).toBeGreaterThan(60_000);
    await expect(askStream({ template: tpl, vars, signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'too_large' });
    expect(calls).toHaveLength(0);
  });

  it('Stopp in der Warteschlange: sample wird nie aufgerufen', async () => {
    const a = askStream({ template: tpl, vars: { turns: ['one'] }, signal: new AbortController().signal });
    const b = askStream({ template: tpl, vars: { turns: ['two'] }, signal: new AbortController().signal });
    const ctl = new AbortController();
    const c = askStream({ template: tpl, vars: { turns: ['three'] }, signal: ctl.signal });
    await flush();
    expect(calls).toHaveLength(2);
    ctl.abort();
    await expect(c).rejects.toMatchObject({ kind: 'cancelled' });
    calls[0]!.resolve({ text: 'A', truncated: false, modelTierApplied: 'quick' });
    calls[1]!.resolve({ text: 'B', truncated: false, modelTierApplied: 'quick' });
    await Promise.all([a, b]);
    expect(calls).toHaveLength(2);
  });

  it('rate_limited: Pause, kein Neuversuch; der nächste Aufruf wird zurückgehalten', async () => {
    const p = askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal });
    await flush();
    calls[0]!.reject({ code: 'rate_limited', message: 'slow down' });
    await expect(p).rejects.toMatchObject({ kind: 'busy', code: 'rate_limited' });
    expect(useAiStatus.getState().pausedUntil).toBeGreaterThan(Date.now());
    await expect(askStream({ template: tpl, vars: { turns: ['Again'] }, signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'busy', code: 'paused' });
    expect(calls).toHaveLength(1);
  });

  it('truncated wird weitergegeben und protokolliert', async () => {
    const p = askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal });
    await flush();
    calls[0]!.resolve({ text: 'Long answer', truncated: true, modelTierApplied: 'quick' });
    await expect(p).resolves.toMatchObject({ truncated: true });
    expect(getLog().some((e) => e.code === 'truncated')).toBe(true);
  });

  it('leerer Text nach dem Bereinigen → empty', async () => {
    const p = askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal });
    await flush();
    calls[0]!.resolve({ text: 'Reinhard Vogt: *nods*', truncated: false, modelTierApplied: 'quick' });
    await expect(p).rejects.toMatchObject({ kind: 'empty' });
  });

  it('Fehler nach Teiltext: bereinigter Teiltext steht in partial (nur Anzeige)', async () => {
    const p = askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal });
    await flush();
    calls[0]!.reject({ code: 'upstream_error', message: 'broken', text: 'Reinhard Vogt: Let me' });
    const err = (await p.catch((e: unknown) => e)) as AiFailure;
    expect(err).toBeInstanceOf(AiFailure);
    expect(err.kind).toBe('failed');
    expect(err.partial).toBe('Let me');
  });

  it('andere antwortende Stufe wird protokolliert (modelTierApplied)', async () => {
    const p = askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal });
    await flush();
    calls[0]!.resolve({ text: 'Fine.', truncated: false, modelTierApplied: 'default' });
    await expect(p).resolves.toMatchObject({ tierApplied: 'default' });
    expect(getLog().some((e) => e.code === 'tier_substituted')).toBe(true);
  });

  it('Zugliste, die nicht mit user endet, wird nie gesendet', async () => {
    await expect(askStream({ template: tpl, vars: { turns: ['Hi', 'Hello from Claude'] }, signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'bug' });
    expect(calls).toHaveLength(0);
  });

  it('ohne sample: unavailable, kein Aufruf', async () => {
    useCapabilities.setState({ sampleRevoked: true });
    await expect(askStream({ template: tpl, vars: { turns: ['Hi'] }, signal: new AbortController().signal })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(calls).toHaveLength(0);
  });
});
