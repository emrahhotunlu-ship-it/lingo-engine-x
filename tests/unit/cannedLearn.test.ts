import { beforeAll, describe, expect, it } from 'vitest';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { mnemonic, type MnemonicVars } from '../../src/prompts/mnemonic';
import type { PromptTemplate } from '../../src/prompts/types';
import { wordGen, type WordGenVars } from '../../src/prompts/wordGen';
import { normalizeTask } from '../../src/domain/grammar/tasks';

// Feste Testantworten des Entwicklungs-Adapters (Prüfbericht): Jede erfüllt das Schema ihrer
// Vorlage, damit die E2E-Tests den echten Weg (Prüfung mit zod) gehen.

const sample = createFakeSample(() => 'ok', () => ({}), 0);

async function answer<V, O>(tpl: PromptTemplate<V, O>, vars: V): Promise<O> {
  const raw = await sample.json<unknown>(tpl.build(vars));
  const res = tpl.schema(vars).safeParse(raw);
  if (!res.success) throw new Error(JSON.stringify(res.error.issues));
  return res.data;
}

beforeAll(() => registerCannedReplies());

describe('word-gen@1', () => {
  it('neue Wörter (allgemein, Beruf) ohne bekannte; Ergänzen genau des Worts', async () => {
    const g = await answer(wordGen, { mode: 'general', count: 8, known: ['bottleneck', 'to streamline'] } satisfies WordGenVars);
    expect(g.words.length).toBe(8);
    expect(g.words.map((w) => w.word)).not.toContain('bottleneck');
    const j = await answer(wordGen, { mode: 'job', count: 8, known: [] } satisfies WordGenVars);
    expect(j.words.length).toBe(8);
    const f = await answer(wordGen, { mode: 'fill', count: 1, known: [], word: 'benchmark' } satisfies WordGenVars);
    expect(f.words[0]).toMatchObject({ word: 'benchmark', de: 'Vergleichsmaßstab, Richtwert' });
    const u = await answer(wordGen, { mode: 'fill', count: 1, known: [], word: 'workaround' } satisfies WordGenVars);
    expect(u.words[0]?.ex).toContain('workaround');
  });
});

describe('grammar-items@1', () => {
  it('gültige Aufgaben zum Thema, jede neue Runde andere', async () => {
    const v: GrammarItemsVars = { topic: 'passive', nameEn: 'Passive voice', ruleEn: 'be + past participle', examples: [], p: 0.5, types: ['gap', 'transform'], seenText: [], errors: [], count: 6 };
    const a = await answer(grammarItems, v);
    const b = await answer(grammarItems, v);
    expect(a.items).toHaveLength(6);
    expect(a.items.every((it) => normalizeTask(it, 'ai') !== null)).toBe(true);
    expect(new Set([...a.items, ...b.items].map((it) => it.prompt)).size).toBe(12);
  });
});

describe('mnemonic@1', () => {
  it('Merkhilfe in der Oberflächensprache mit dem Wort', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const o = await answer(mnemonic, { word: 'to struggle', meaning: 'kämpfen', sentence: '', uiLang } satisfies MnemonicVars);
      expect(o.text).toContain('struggle');
    }
  });
});
