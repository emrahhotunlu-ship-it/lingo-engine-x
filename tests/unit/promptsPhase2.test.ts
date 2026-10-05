import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { promptBytes, PROMPT_MAX_BYTES } from '../../src/prompts/common';
import { GRAMMAR_ITEMS_EXAMPLE, grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { GRAMMAR_JUDGE_EXAMPLE, grammarJudge, type GrammarJudgeVars } from '../../src/prompts/grammarJudge';
import { TEMPLATES } from '../../src/prompts/registry';

const judgeVars: GrammarJudgeVars = {
  topic: 'Past Simple vs. Present Perfect',
  type: 'correct',
  prompt: 'I have seen that film yesterday.',
  answer: 'I saw that film yesterday.',
  accepted: [],
  given: 'Yesterday I saw that film.',
  uiLang: 'de',
};

const itemsVars: GrammarItemsVars = {
  topic: 'passive',
  nameEn: 'Passive',
  ruleEn: 'be + past participle',
  examples: ['The contract has been signed.'],
  p: 0.5,
  types: ['gap', 'transform'],
  seenText: ['The road ___ (repair) every year.'],
  errors: [{ q: 'My bike ___ (steal).', given: 'was stoled', ans: 'was stolen' }],
  count: 6,
};

describe('Phase-2-Vorlagen: Kopfzeile, Stufe, Zwischenspeicher', () => {
  it('im Verzeichnis, mit Kopfzeile', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of ['grammar-items', 'grammar-judge']) expect(ids).toContain(id);
    expect(grammarJudge.build(judgeVars).split('\n')[0]).toBe('[grammar-judge@1]');
    expect(grammarItems.build(itemsVars).split('\n')[0]).toBe('[grammar-items@2]');
    expect([grammarJudge.tier, grammarItems.tier]).toEqual(['quick', 'default']);
    expect(grammarJudge.cache).toEqual({ gcTime: 86_400_000 });
    expect(grammarItems.cache).toBe(false);
    expect(grammarItems.build(itemsVars)).toContain('Reject any item where a second option is also grammatical in some context.');
  });
});

describe('Beispiele bestehen das Schema, falsche Sprache nicht', () => {
  it('grammar-judge@1', () => {
    const s = grammarJudge.schema(judgeVars);
    expect(s.safeParse(JSON.parse(GRAMMAR_JUDGE_EXAMPLE)).success).toBe(true);
    // W5: „falsch, aber akzeptabel" wird zu „fast richtig" statt abgelehnt (Kap. 2.2, keine Widersprüche).
    expect(s.safeParse({ verdict: 'wrong', acceptable: true, corrected: 'x', why: 'y' }).data?.verdict).toBe('near');
    expect(s.safeParse({ verdict: 'correct', acceptable: true, corrected: 'x', why: 'The answer is correct because the time is finished.' }).success).toBe(false);
    expect(s.safeParse({ verdict: 'correct', acceptable: true, corrected: 'x', why: 'Die Antwort ist richtig, weil die Zeit abgeschlossen ist.' }).success).toBe(true);
  });

  it('grammar-items@1, U-06: answer ∉ options wird abgelehnt', () => {
    const s = grammarItems.schema(itemsVars);
    const ex = JSON.parse(GRAMMAR_ITEMS_EXAMPLE) as { items: Array<Record<string, unknown>> };
    const three = { items: [ex.items[0], ex.items[0], ex.items[0]] };
    expect(s.safeParse(three).success).toBe(true);
    const mc = { ...ex.items[0], type: 'mc', options: ['is signed', 'signed', 'has signed'], answer: 'was signed' };
    expect(s.safeParse({ items: [mc, ex.items[0], ex.items[0]] }).success).toBe(false);
    const wrongLang = { ...ex.items[0], explanation_de: 'Yesterday shows finished time, so we need the past passive here.' };
    expect(s.safeParse({ items: [wrongLang, ex.items[0], ex.items[0]] }).success).toBe(false);
    const otherTopic = { ...ex.items[0], topic: 'articles' };
    expect(s.safeParse({ items: [otherTopic, ex.items[0], ex.items[0]] }).success).toBe(false);
  });
});

describe('Größen und Prompt-Freiheit', () => {
  it('maximale Eingaben bleiben unter 60.000 Bytes', () => {
    const huge = 'x'.repeat(100_000);
    const big = [
      grammarJudge.build({ ...judgeVars, prompt: huge, answer: huge, given: huge, accepted: [huge, huge, huge] }),
      grammarItems.build({ ...itemsVars, ruleEn: huge, examples: Array(20).fill(huge), seenText: Array(40).fill(huge), errors: Array(10).fill({ q: huge, given: huge, ans: huge }) }),
    ];
    for (const p of big) expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('kein Prompt-Text in features/ (U-PROMPT-06 erweitert)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(new URL('../../src/features', import.meta.url).pathname);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Reply with only|You write|You judge|You give feedback/);
  });
});
