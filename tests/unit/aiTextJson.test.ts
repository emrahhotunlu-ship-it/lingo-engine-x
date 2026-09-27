import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { askJson, resetAiGate } from '../../src/ai/gate';
import { AiFailure } from '../../src/ai/types';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import { createFakeSample, registerCannedReply } from '../../src/platform/dev/fakeSample';
import type { PromptTemplate } from '../../src/prompts/types';

// KI-Tor, Aufrufart `text-json` (Phase 6, Plan W4): `sample()` statt `sample.json`, eigenes
// tolerantes Lesen, die tatsächlich antwortende Stufe wird gemeldet.

const tpl: PromptTemplate<{ kind: string }, { ok: boolean }> = {
  id: 'unit-textjson',
  version: 1,
  tier: 'complex',
  cache: false,
  verb: 'text-json',
  build: (v) => `[unit-textjson@1]\nKind: ${v.kind}`,
  schema: () => z.object({ ok: z.boolean() }),
};

beforeAll(async () => {
  registerCannedReply('unit-textjson', (input) => (input.includes('Kind: fence') ? 'Here you go:\n```json\n{"ok":true}\n```' : input.includes('Kind: none') ? 'I cannot answer.' : '{"ok":true}'));
  const sample = createFakeSample(() => 'ok', () => ({}), 1, 'default');
  (globalThis as { window?: unknown }).window = { claude: { use: (n: string) => Promise.resolve(n === 'sample' ? sample : null) } };
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
});

describe('askJson mit verb text-json', () => {
  it('meldet die antwortende Stufe (einfacheres Modell)', async () => {
    resetAiGate();
    const r = await askJson({ template: tpl, vars: { kind: 'plain' }, signal: new AbortController().signal });
    expect(r).toEqual({ data: { ok: true }, tierApplied: 'default', retried: false });
  });
  it('liest einen Codeblock', async () => {
    resetAiGate();
    const r = await askJson({ template: tpl, vars: { kind: 'fence' }, signal: new AbortController().signal });
    expect(r.data).toEqual({ ok: true });
  });
  it('ohne JSON: invalid_json, kein Neuversuch', async () => {
    resetAiGate();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = await askJson({ template: tpl, vars: { kind: 'none' }, signal: new AbortController().signal }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect((err as AiFailure).code).toBe('invalid_json');
    expect((err as AiFailure).partial).toBe('I cannot answer.');
  });
});
