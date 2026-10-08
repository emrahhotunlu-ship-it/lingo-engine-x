/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten {code, message, text?} ab, nicht mit Error. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { askJson, PROMPT_BUDGET_BYTES, QUOTE_RULE, resetAiGate, retryPrompt, SAMPLE_LIMIT_BYTES, SLOW_AFTER_MS } from '../../src/ai/gate';
import { PROMPT_MAX_BYTES, SAMPLE_MAX_BYTES } from '../../src/prompts/common';
import { callsInWindow, LOCAL_MAX_CALLS, useAiStatus } from '../../src/ai/status';
import { AiFailure, type AiPhase } from '../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import { withCallLog, registerCannedReplies, type SampleCall } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import type { SampleFn, SampleOptions } from '../../src/platform/types';
import { produceCheck } from '../../src/prompts/produceCheck';
import type { PromptTemplate } from '../../src/prompts/types';
import { wordLookup } from '../../src/prompts/wordLookup';
import { z } from 'zod';

// Das KI-Tor läuft hier über den echten Weg: window.claude → runtime → capabilities → getSample().
// `impl` wird je Test ausgetauscht; so bleibt der einmal geladene Namensraum derselbe.

type Call = {
  input: Claude.sample.SampleInput;
  options: SampleOptions;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

let calls: Call[] = [];
const inputOf = (c: Call | undefined): string => (typeof c?.input === 'string' ? c.input : '');
let impl: SampleFn | null = null;

/** Nachbildung mit Hand-Steuerung: jeder Aufruf wartet, bis der Test ihn auflöst. */
function manualSample(): SampleFn {
  // Das Tor nutzt den Text-Weg (`sample()`) und liest JSON selbst; `resolve(v)` liefert v als Text.
  const text = (input: Claude.sample.SampleInput, options?: SampleOptions): Promise<Claude.sample.SampleResult> =>
    new Promise<Claude.sample.SampleResult>((resolve, reject) => {
      const call: Call = { input, options: options ?? {}, resolve: (v) => resolve({ text: typeof v === 'string' ? v : JSON.stringify(v), truncated: false } as Claude.sample.SampleResult), reject };
      calls.push(call);
      options?.signal?.addEventListener('abort', () => reject({ code: 'cancelled', message: 'aborted' }), { once: true });
    });
  const json = (() => Promise.reject({ code: 'invalid_request', message: 'json not used here' })) as SampleFn['json'];
  return Object.assign(text as unknown as SampleFn, { json, limits: () => Promise.resolve({ maxPromptBytes: 65536 }) });
}

const proxy = Object.assign(
  ((input: Claude.sample.SampleInput, options?: SampleOptions) => impl!(input, options)) as SampleFn,
  {
    json: <T,>(input: Claude.sample.SampleInput, options?: SampleOptions) => impl!.json<T>(input, options),
    limits: () => impl!.limits(),
  },
);

type V = { word: string };
type O = { ok: boolean; n: number };
const tpl: PromptTemplate<V, O> = {
  id: 'unit-test',
  version: 1,
  tier: 'quick',
  cache: true,
  build: (v) => `[unit-test@1]\nWord: ${v.word}`,
  schema: () => z.object({ ok: z.boolean(), n: z.number().int() }),
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const validReply = { ok: true, n: 1 };

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = {
    claude: { use: (name: string) => Promise.resolve(name === 'sample' ? proxy : null) },
  };
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

beforeEach(() => {
  calls = [];
  impl = manualSample();
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('askJson: Grundablauf', () => {
  it('liefert geprüfte Daten und übergibt Stufe, Zwischenspeicher, eigenes Signal und onText', async () => {
    const screen = new AbortController();
    const phases: AiPhase[] = [];
    const p = askJson({ template: tpl, vars: { word: 'x' }, signal: screen.signal, onPhase: (ph) => phases.push(ph) });
    await flush();
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.input).toBe(`[unit-test@1]\nWord: x${QUOTE_RULE}`);
    expect(c.options.modelTier).toBe('quick');
    expect(c.options.cache).toBe(true);
    expect(c.options.signal).toBeInstanceOf(AbortSignal);
    expect(c.options.signal).not.toBe(screen.signal);
    expect(typeof c.options.onText).toBe('function');
    c.options.onText?.({ text: '{', delta: '{' });
    c.resolve(validReply);
    await expect(p).resolves.toEqual({ data: validReply, tierApplied: 'quick', retried: false });
    expect(phases).toEqual(['thinking', 'streaming', 'done']);
  });

  it('ohne sample: unavailable, kein Aufruf', async () => {
    impl = manualSample();
    useCapabilities.setState({ sampleRevoked: true });
    const err = await askJson({ template: tpl, vars: { word: 'x' }, signal: new AbortController().signal }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect((err as AiFailure).kind).toBe('unavailable');
    expect((err as AiFailure).messageKey).toBe('aiUnavailable');
    expect(calls).toHaveLength(0);
  });

  it('bereits abgebrochenes Signal: cancelled, kein Aufruf', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const err = await askJson({ template: tpl, vars: { word: 'x' }, signal: ctl.signal }).catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('cancelled');
    expect((err as AiFailure).messageKey).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('Byte-Grenzen des Tors und der Vorlagen stimmen überein', () => {
    expect(PROMPT_BUDGET_BYTES).toBe(PROMPT_MAX_BYTES);
    expect(SAMPLE_LIMIT_BYTES).toBe(SAMPLE_MAX_BYTES);
  });

  it('zu großer Prompt: too_large vor dem Aufruf', async () => {
    const big: PromptTemplate<V, O> = { ...tpl, build: () => `[unit-test@1]\n${'x'.repeat(61_000)}` };
    const err = await askJson({ template: big, vars: { word: 'x' }, signal: new AbortController().signal }).catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('too_large');
    expect(calls).toHaveLength(0);
  });

  it('Abbruch während des Aufrufs: cancelled, keine Fehler-Phase', async () => {
    const screen = new AbortController();
    const phases: AiPhase[] = [];
    const p = askJson({ template: tpl, vars: { word: 'x' }, signal: screen.signal, onPhase: (ph) => phases.push(ph) });
    await flush();
    screen.abort();
    const err = await p.catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('cancelled');
    expect(calls[0]!.options.signal!.aborted).toBe(true);
    expect(phases).not.toContain('error');
  });
});

describe('Warteschlange', () => {
  it('höchstens 2 Aufrufe gleichzeitig; der dritte startet erst nach einem Abschluss', async () => {
    const phases: AiPhase[] = [];
    const s = new AbortController().signal;
    const p1 = askJson({ template: tpl, vars: { word: 'a' }, signal: s });
    const p2 = askJson({ template: tpl, vars: { word: 'b' }, signal: s });
    const p3 = askJson({ template: tpl, vars: { word: 'c' }, signal: s, onPhase: (ph) => phases.push(ph) });
    await flush();
    expect(calls).toHaveLength(2);
    expect(phases).toEqual(['queued']);
    calls[0]!.resolve(validReply);
    await p1;
    await flush();
    expect(calls).toHaveLength(3);
    expect(calls[2]!.input).toContain('Word: c');
    calls[1]!.resolve(validReply);
    calls[2]!.resolve(validReply);
    await Promise.all([p2, p3]);
    expect(phases).toEqual(['queued', 'thinking', 'done']);
  });

  it('Abbruch in der Warteschlange: cancelled, sample wird nie aufgerufen', async () => {
    const s = new AbortController().signal;
    const waiting = new AbortController();
    const p1 = askJson({ template: tpl, vars: { word: 'a' }, signal: s });
    const p2 = askJson({ template: tpl, vars: { word: 'b' }, signal: s });
    const p3 = askJson({ template: tpl, vars: { word: 'c' }, signal: waiting.signal });
    await flush();
    waiting.abort();
    const err = await p3.catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('cancelled');
    calls[0]!.resolve(validReply);
    calls[1]!.resolve(validReply);
    await Promise.all([p1, p2]);
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => inputOf(c).includes('Word: c'))).toBe(false);
  });
});

describe('Fehlercodes', () => {
  it('rate_limited: Pause; der nächste Aufruf innerhalb von 60 s erreicht sample nicht', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T10:00:00Z') });
    const s = new AbortController().signal;
    const p1 = askJson({ template: tpl, vars: { word: 'a' }, signal: s });
    await flush();
    calls[0]!.reject({ code: 'rate_limited', message: 'too many' });
    const e1 = (await p1.catch((e: unknown) => e)) as AiFailure;
    expect(e1.kind).toBe('busy');
    expect(e1.messageKey).toBe('aiBusy');
    expect(useAiStatus.getState().pausedUntil).toBe(Date.now() + 60_000);

    vi.advanceTimersByTime(59_000);
    const e2 = (await askJson({ template: tpl, vars: { word: 'b' }, signal: s }).catch((e: unknown) => e)) as AiFailure;
    expect(e2.kind).toBe('busy');
    expect(e2.code).toBe('paused');
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    const p3 = askJson({ template: tpl, vars: { word: 'c' }, signal: s });
    await flush();
    expect(calls).toHaveLength(2);
    calls[1]!.resolve(validReply);
    await expect(p3).resolves.toMatchObject({ data: validReply });
  });

  it('Schemafehler: genau ein zweiter Aufruf mit anderer Eingabe', async () => {
    const s = new AbortController().signal;
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: s });
    await flush();
    calls[0]!.resolve({ ok: 'yes' });
    await flush();
    expect(calls).toHaveLength(2);
    const first = inputOf(calls[0]);
    const second = inputOf(calls[1]);
    expect(second).not.toBe(first);
    expect(second.startsWith(first)).toBe(true);
    expect(second).toContain('did not match the required format');
    expect(second).toContain('- ok:');
    expect(second).toContain('Previous reply: {"ok":"yes"}');
    expect(calls[1]!.options.signal).not.toBe(calls[0]!.options.signal);
    calls[1]!.resolve(validReply);
    await expect(p).resolves.toEqual({ data: validReply, tierApplied: 'quick', retried: true });
  });

  it('Schemafehler zweimal: invalid, nicht mehr als 2 Aufrufe', async () => {
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: new AbortController().signal });
    await flush();
    calls[0]!.resolve({ ok: 1 });
    await flush();
    calls[1]!.resolve({ ok: 2 });
    const err = (await p.catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe('invalid');
    expect(err.code).toBe('schema');
    expect(err.messageKey).toBe('aiInvalid');
    await flush();
    expect(calls).toHaveLength(2);
  });

  it('P8: `lenient` greift erst nach dem einen Neuversuch, ohne weiteren Aufruf', async () => {
    type O2 = { ok: boolean; extra?: number };
    const strict = z.object({ ok: z.boolean(), extra: z.number().int().optional() });
    const tpl2: PromptTemplate<V, O2> = {
      ...tpl,
      id: 'unit-lenient',
      schema: () => strict,
      lenient: () => z.object({ ok: z.boolean(), extra: z.unknown().optional().transform((): undefined => undefined) }),
    };
    const p = askJson({ template: tpl2, vars: { word: 'l' }, signal: new AbortController().signal });
    await flush();
    calls[0]!.resolve({ ok: true, extra: 'x' });
    await flush();
    // Erste Antwort: trotz `lenient` ein Neuversuch (Claude soll den Zusatzteil richtig liefern).
    expect(calls).toHaveLength(2);
    calls[1]!.resolve({ ok: true, extra: 'still bad' });
    await expect(p).resolves.toEqual({ data: { ok: true }, tierApplied: 'quick', retried: true });
    await flush();
    expect(calls).toHaveLength(2);
    // Ist auch der Pflichtteil kaputt, hilft `lenient` nicht: invalid.
    const q = askJson({ template: tpl2, vars: { word: 'm' }, signal: new AbortController().signal });
    await flush();
    calls[2]!.resolve({ ok: 'no' });
    await flush();
    calls[3]!.resolve({ ok: 'no' });
    expect(((await q.catch((e: unknown) => e)) as AiFailure).kind).toBe('invalid');
  });

  it('B2: Neuversuch fragt frisch; nach Schemafehler holt „Erneut versuchen" mit refresh, danach wieder normal', async () => {
    const s = new AbortController().signal;
    const p = askJson({ template: tpl, vars: { word: 'b2' }, signal: s });
    await flush();
    expect(calls[0]!.options.cache).toBe(true);
    calls[0]!.resolve({ ok: 1 });
    await flush();
    // Der interne zweite Versuch (A6.3) trifft keine gespeicherte Antwort.
    expect(calls[1]!.options.cache).toEqual({ gcTime: 300_000, refresh: true });
    calls[1]!.resolve({ ok: 2 });
    await p.catch(() => undefined);
    expect(calls).toHaveLength(2);
    // Kein automatischer Neuversuch; erst der nächste Aufruf des Nutzers fragt frisch.
    const retry = askJson({ template: tpl, vars: { word: 'b2' }, signal: s });
    await flush();
    expect(calls).toHaveLength(3);
    expect(inputOf(calls[2])).toBe(inputOf(calls[0]));
    expect(calls[2]!.options.cache).toEqual({ gcTime: 300_000, refresh: true });
    calls[2]!.resolve(validReply);
    await expect(retry).resolves.toMatchObject({ data: validReply, retried: false });
    // Gültig beantwortet: der übernächste Aufruf nutzt wieder den Zwischenspeicher.
    const again = askJson({ template: tpl, vars: { word: 'b2' }, signal: s });
    await flush();
    expect(calls[3]!.options.cache).toBe(true);
    calls[3]!.resolve(validReply);
    await again;
    // Ein anderer Prompt ist nie betroffen.
    const other = askJson({ template: tpl, vars: { word: 'other' }, signal: s });
    await flush();
    expect(calls[4]!.options.cache).toBe(true);
    calls[4]!.resolve(validReply);
    await other;
  });

  it('B2: erfolgreicher Neuversuch – der nächste Aufruf mit demselben Prompt fragt trotzdem frisch', async () => {
    const s = new AbortController().signal;
    const p = askJson({ template: tpl, vars: { word: 'b2b' }, signal: s });
    await flush();
    calls[0]!.resolve({ ok: 'x' });
    await flush();
    calls[1]!.resolve(validReply);
    await expect(p).resolves.toMatchObject({ retried: true });
    const next = askJson({ template: tpl, vars: { word: 'b2b' }, signal: s });
    await flush();
    expect(calls[2]!.options.cache).toEqual({ gcTime: 300_000, refresh: true });
    calls[2]!.resolve(validReply);
    await next;
  });

  it('invalid_json: kein zweiter Aufruf, Rohtext bleibt als partial', async () => {
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: new AbortController().signal });
    await flush();
    calls[0]!.reject({ code: 'invalid_json', message: 'no json', text: 'Sorry.' });
    const err = (await p.catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe('invalid');
    expect(err.code).toBe('invalid_json');
    expect(err.partial).toBe('Sorry.');
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('not_granted: sampleRevoked, danach ohne Aufruf unavailable', async () => {
    const s = new AbortController().signal;
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: s });
    await flush();
    calls[0]!.reject({ code: 'not_granted', message: 'declined' });
    const err = (await p.catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe('unavailable');
    expect(useCapabilities.getState().sampleRevoked).toBe(true);
    const again = (await askJson({ template: tpl, vars: { word: 'b' }, signal: s }).catch((e: unknown) => e)) as AiFailure;
    expect(again.kind).toBe('unavailable');
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['refused', 'refused', 'aiRefused'],
    ['session_expired', 'signin', 'aiSignin'],
    ['empty_completion', 'empty', 'aiEmpty'],
    ['prompt_too_large', 'too_large', 'aiTooLarge'],
    ['invalid_request', 'bug', 'aiFailed'],
    ['upstream_error', 'failed', 'aiFailed'],
    ['something_new', 'failed', 'aiFailed'],
  ])('%s → %s', async (code, kind, key) => {
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: new AbortController().signal });
    await flush();
    calls[0]!.reject({ code, message: 'x', text: 'partial' });
    const err = (await p.catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe(kind);
    expect(err.messageKey).toBe(key);
    expect(err.partial).toBe(code === 'refused' ? undefined : 'partial');
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('lokale Obergrenze: der 21. Aufruf innerhalb von 60 s erreicht sample nicht', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-26T10:00:00Z') });
    const s = new AbortController().signal;
    for (let i = 0; i < LOCAL_MAX_CALLS; i++) {
      const p = askJson({ template: tpl, vars: { word: `w${i}` }, signal: s });
      await flush();
      calls[i]!.resolve(validReply);
      await p;
    }
    expect(callsInWindow()).toBe(LOCAL_MAX_CALLS);
    const err = (await askJson({ template: tpl, vars: { word: 'x' }, signal: s }).catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe('busy');
    expect(err.code).toBe('local_limit');
    expect(calls).toHaveLength(LOCAL_MAX_CALLS);
    vi.advanceTimersByTime(60_000);
    expect(callsInWindow()).toBe(0);
  });
});

describe('Langsam-Hinweis (A6.2: kein Timer-Abbruch)', () => {
  it('meldet nach 8 s `slow` bei quick und bricht nicht ab', async () => {
    vi.useFakeTimers();
    const phases: AiPhase[] = [];
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: new AbortController().signal, onPhase: (ph) => phases.push(ph) });
    await flush();
    expect(phases).toEqual(['thinking']);
    await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS.quick - 1);
    expect(phases).toEqual(['thinking']);
    await vi.advanceTimersByTimeAsync(1);
    expect(phases).toEqual(['thinking', 'slow']);
    // Auch viel später: kein Abbruch, kein zweiter Aufruf.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(calls[0]!.options.signal!.aborted).toBe(false);
    expect(calls).toHaveLength(1);
    calls[0]!.options.onText?.({ text: '{', delta: '{' });
    calls[0]!.resolve(validReply);
    await p;
    expect(phases).toEqual(['thinking', 'slow', 'streaming', 'done']);
  });

  it('erster Text vor Ablauf: kein `slow`', async () => {
    vi.useFakeTimers();
    const phases: AiPhase[] = [];
    const p = askJson({ template: tpl, vars: { word: 'a' }, signal: new AbortController().signal, onPhase: (ph) => phases.push(ph) });
    await flush();
    await vi.advanceTimersByTimeAsync(1_000);
    calls[0]!.options.onText?.({ text: '{', delta: '{' });
    await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS.quick * 2);
    calls[0]!.resolve(validReply);
    await p;
    expect(phases).toEqual(['thinking', 'streaming', 'done']);
  });

  it('Stufen: default 45 s, complex 90 s', () => {
    expect(SLOW_AFTER_MS).toEqual({ quick: 8_000, default: 45_000, complex: 90_000 });
  });
});

describe('retryPrompt', () => {
  it('nennt höchstens 5 Mängel und kürzt die vorige Antwort auf 1500 Zeichen', () => {
    const issues = Array.from({ length: 8 }, (_, i) => ({ path: [`f${i}`], message: 'bad' }));
    const out = retryPrompt('P', issues, { long: 'x'.repeat(5000) });
    expect(out.match(/^- f\d: bad$/gm)).toHaveLength(5);
    const prev = /Previous reply: (.*)$/m.exec(out)?.[1] ?? '';
    expect(prev.length).toBe(1500);
  });
});

describe('mit den festen Antworten des Entwicklungs-Adapters', () => {
  let log: SampleCall[];
  beforeEach(() => {
    registerCannedReplies();
    log = [];
    impl = withCallLog(createFakeSample(() => 'ok'), log);
  });

  it('word-lookup „leverage" (DE): gültig, 1 Aufruf, deutsche Erklärung', async () => {
    const res = await askJson({
      template: wordLookup,
      vars: { word: 'leverage', sentence: 'We leverage our network.', uiLang: 'de' },
      signal: new AbortController().signal,
    });
    expect(res.retried).toBe(false);
    expect(res.data.lemma).toBe('leverage');
    expect(res.data.sense).toMatch(/bedeutet/);
    expect(log).toEqual([expect.objectContaining({ id: 'word-lookup', tier: 'quick' })]);
  });

  it('word-lookup „zzqx": genau 2 Aufrufe (Schema-Neuversuch), dann gültig', async () => {
    const res = await askJson({
      template: wordLookup,
      vars: { word: 'zzqx', sentence: 'Tap zzqx here.', uiLang: 'en' },
      signal: new AbortController().signal,
    });
    expect(res.retried).toBe(true);
    expect(res.data.lemma).toBe('zzqx');
    expect(log).toHaveLength(2);
    expect(log[1]!.input).not.toBe(log[0]!.input);
  });

  it('word-lookup „zzjson": invalid_json nach genau 1 Aufruf', async () => {
    const err = (await askJson({
      template: wordLookup,
      vars: { word: 'zzjson', sentence: '', uiLang: 'de' },
      signal: new AbortController().signal,
    }).catch((e: unknown) => e)) as AiFailure;
    expect(err.kind).toBe('invalid');
    expect(err.code).toBe('invalid_json');
    expect(log).toHaveLength(1);
  });

  it('produce-check: richtig, klein, falsch – in der Sprache der Oberfläche', async () => {
    const ask = (sentence: string, uiLang: 'de' | 'en') =>
      askJson({
        template: produceCheck,
        vars: { target: 'rely on', meaning: 'sich verlassen auf', sentence, uiLang, kind: 'phrase' },
        signal: new AbortController().signal,
      });
    await expect(ask('We can rely on the new supplier.', 'de')).resolves.toMatchObject({ data: { verdict: 'correct', usesTarget: true } });
    const minor = await ask('we relied on the data', 'en');
    expect(minor.data).toMatchObject({ verdict: 'minor', fixed: 'We relied on the data.' });
    const wrong = await ask('The meeting starts at nine.', 'de');
    expect(wrong.data).toMatchObject({ verdict: 'wrong', usesTarget: false });
    expect(wrong.data.why).toMatch(/Zielwort/);
  });
});
