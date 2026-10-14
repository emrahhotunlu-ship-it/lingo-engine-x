/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten {code, message, text?} ab, nicht mit Error. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUOTE_RULE, resetAiGate } from '../../../src/ai/gate';
import { AiFailure } from '../../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../../src/platform/capabilities';
import type { SampleFn, SampleOptions } from '../../../src/platform/types';
import { generateArticle } from '../../../src/modules/read/domain/generate';
import type { GenerateInput } from '../../../src/modules/read/domain/generate';
import { readArticle } from '../../../src/modules/read/prompt';
import { goodRaw } from './fixtures';

// Erzeugen eines Artikels über das echte KI-Tor (window.claude → capabilities → getSample), mit festen Antworten.
// Belegt A6 Nr. 3: ein Neuversuch nur bei lesbarem JSON mit Schemaverstoß; nie bei invalid_json oder rate_limited.

type Reply = { text: string; truncated?: boolean } | { reject: { code: string; message: string } };
let replies: Reply[] = [];
let inputs: string[] = [];
let options: SampleOptions[] = [];

const text = (input: Claude.sample.SampleInput, opts?: SampleOptions): Promise<Claude.sample.SampleResult> => {
  inputs.push(typeof input === 'string' ? input : JSON.stringify(input));
  options.push(opts ?? {});
  const r = replies.shift();
  if (!r) return Promise.reject({ code: 'unavailable', message: 'no canned reply' });
  if ('reject' in r) return Promise.reject(r.reject);
  return Promise.resolve({ text: r.text, truncated: r.truncated ?? false } as Claude.sample.SampleResult);
};
const proxy = Object.assign(((input: Claude.sample.SampleInput, opts?: SampleOptions) => text(input, opts)) as SampleFn, {
  json: (() => Promise.reject({ code: 'invalid_request', message: 'json not used here' })),
  limits: () => Promise.resolve({ maxPromptBytes: 65536 }),
});

const base = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  topic: 'saas',
  date: '2026-10-13',
  recent: [],
  n: 1,
  signal: new AbortController().signal,
  now: 1_790_000_000_000,
  ...over,
});

const goodText = (): string => JSON.stringify(goodRaw());

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = { claude: { use: (name: string) => Promise.resolve(name === 'sample' ? proxy : null) } };
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

beforeEach(() => {
  replies = [];
  inputs = [];
  options = [];
  resetAiGate();
  useCapabilities.setState({ sampleRevoked: false });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('generateArticle über das KI-Tor', () => {
  it('guter Artikel: ein Aufruf, Stufe default, nie zwischengespeichert, gespeicherte Form', async () => {
    replies = [{ text: goodText() }];
    const { item, retried } = await generateArticle(base());
    expect(retried).toBe(false);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toBe(`${readArticle.build({ topic: 'saas', date: '2026-10-13', recent: [] })}${QUOTE_RULE}`);
    expect(options[0]?.modelTier).toBe('default');
    expect(options[0]?.cache).toBe(false);
    expect(item.id).toMatch(/^a-2026-10-13-1-[0-9a-z]{6}$/);
    expect(item).toMatchObject({ t: 1_790_000_000_000, topic: 'saas', kind: 'explainer', level: 'c1', title: 'Why Pricing Pages Decide Growth', model: 'default', pv: 1 });
    expect(item.keyWords).toHaveLength(5);
    expect(item.paras.flat()).toHaveLength(21);
  });

  it('eigenes Thema: Text bleibt am Artikel, Kennung hängt am Thema', async () => {
    replies = [{ text: goodText() }];
    const { item } = await generateArticle(base({ topic: 'custom', custom: 'Pricing for dev tools' }));
    expect(item.topic).toBe('custom');
    expect(item.custom).toBe('Pricing for dev tools');
    expect(inputs[0]).toContain('<<<\nPricing for dev tools\n>>>');
  });

  it('Schemaverstoß (Sprache vertauscht): GENAU ein zweiter Versuch, mit angehängter Fehlerbeschreibung, andere Eingabe', async () => {
    const bad = goodRaw();
    bad.paras[0]![0] = { e: bad.paras[0]![0]!.d, d: bad.paras[0]![0]!.e };
    replies = [{ text: JSON.stringify(bad) }, { text: goodText() }];
    const { item, retried } = await generateArticle(base());
    expect(retried).toBe(true);
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toContain('Your previous reply did not match the required format:');
    expect(inputs[1]).toContain('[language]');
    // Der Neuversuch ist eine andere Eingabe (trifft nie den Zwischenspeicher); der Artikelaufruf speichert ohnehin nie (cache: false).
    expect(inputs[1]).not.toBe(inputs[0]);
    expect(options[1]?.cache).toBe(false);
    expect(item.title).toBe('Why Pricing Pages Decide Growth');
  });

  it('zweimal ungültig: Fehler invalid, kein dritter Aufruf, nie ein Teilartikel', async () => {
    const bad = goodRaw();
    bad.paras = bad.paras.slice(0, 2);
    replies = [{ text: JSON.stringify(bad) }, { text: JSON.stringify(bad) }, { text: goodText() }];
    const err = await generateArticle(base()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect((err as AiFailure).kind).toBe('invalid');
    expect(inputs).toHaveLength(2);
  });

  it('nachsichtig nur im Neuversuch: 3 gültige Schlüsselwörter genügen', async () => {
    const bad = goodRaw();
    bad.keyWords = bad.keyWords.slice(0, 4);
    const second = goodRaw();
    second.keyWords[3] = { w: 'headcount', de: 'Personalbestand', i: [0, 0] };
    second.keyWords[4] = { w: 'the', de: 'der', i: [0, 0] };
    replies = [{ text: JSON.stringify(bad) }, { text: JSON.stringify(second) }];
    const { item, retried } = await generateArticle(base());
    expect(retried).toBe(true);
    expect(item.keyWords).toHaveLength(3);
  });

  it('Dublette des Titels: abgelehnt (neun Tore laufen im Schema des Tors)', async () => {
    replies = [{ text: goodText() }, { text: goodText() }];
    const err = await generateArticle(base({ recent: [{ title: 'Why pricing pages quietly decide growth', topic: 'saas' }] })).catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('invalid');
    expect(inputs[1]).toContain('[duplicate]');
  });

  it('kein JSON lesbar (invalid_json): NIE automatisch wiederholt', async () => {
    replies = [{ text: 'Sorry, here is a long essay without any JSON.' }, { text: goodText() }];
    const err = await generateArticle(base()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect((err as AiFailure).kind).toBe('invalid');
    expect(inputs).toHaveLength(1);
  });

  it('abgeschnittene Antwort (truncated): kein Teilartikel, kein Neuversuch', async () => {
    replies = [{ text: goodText().slice(0, 2000), truncated: true }, { text: goodText() }];
    const err = await generateArticle(base()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect(inputs).toHaveLength(1);
  });

  it('rate_limited: NIE automatisch wiederholt; der Fehler kommt unverändert an', async () => {
    replies = [{ reject: { code: 'rate_limited', message: 'slow down' } }, { text: goodText() }];
    const err = await generateArticle(base()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect((err as AiFailure).kind).toBe('busy');
    expect(inputs).toHaveLength(1);
  });

  it('not_granted: Fehlerart unavailable/signin, kein Neuversuch', async () => {
    replies = [{ reject: { code: 'not_granted', message: 'no' } }, { text: goodText() }];
    const err = await generateArticle(base()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect(inputs).toHaveLength(1);
  });

  it('bereits abgebrochen: cancelled, kein Aufruf', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const err = await generateArticle(base({ signal: ctl.signal })).catch((e: unknown) => e);
    expect((err as AiFailure).kind).toBe('cancelled');
    expect(inputs).toHaveLength(0);
  });

  it('Austausch der Abhängigkeit: ohne Tor, mit eigener ask-Funktion', async () => {
    const ask = vi.fn().mockResolvedValue({ data: { title: 'T', topic: 'ai', kind: 'trend', level: 'c1', asOf: '', summary: '', paras: [[{ e: 'A b c d.', d: 'E f g h.' }]], keyWords: [] }, tierApplied: 'default', retried: false });
    const { item } = await generateArticle(base({ topic: 'ai' }), { ask: ask as never });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0]?.[0]).toMatchObject({ template: readArticle, priority: 'user' });
    expect(item.topic).toBe('ai');
  });
});
