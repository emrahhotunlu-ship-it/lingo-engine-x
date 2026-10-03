import { beforeAll, describe, expect, it } from 'vitest';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { goalCheck } from '../../src/prompts/nb/p5/goalCheck';
import { claudeDrill } from '../../src/prompts/nb/p6/claudeDrill';
import { unitListen } from '../../src/prompts/nb/p4/unitListen';
import { textLevel } from '../../src/prompts/nb/p4/textLevel';
import { alternatives } from '../../src/prompts/nb/p4/alternatives';
import { textCards } from '../../src/prompts/nb/p3/textCards';
import type { PromptTemplate } from '../../src/prompts/types';

// Feste Testantworten der Neubau-Vorlagen: Jede erfüllt das Schema ihrer Vorlage (echter Weg über zod).

const sample = createFakeSample(() => 'ok', () => ({}), 0);

async function answer<V, O>(tpl: PromptTemplate<V, O>, vars: V): Promise<O> {
  const raw = await sample.json<unknown>(tpl.build(vars));
  const res = tpl.schema(vars).safeParse(raw);
  if (!res.success) throw new Error(JSON.stringify(res.error.issues));
  return res.data;
}

const TEXT =
  'Our team wants to streamline the onboarding process for every new customer. The main bottleneck is the manual data import, which takes about two weeks. We plan to roll out a new tool next quarter and keep the budget stable. All stakeholders will get a short update before the deadline.';

beforeAll(() => registerCannedReplies());

describe('Neubau-Vorlagen: feste Antworten erfüllen das Schema', () => {
  it('goal-check (laufend und am Ende, beide Sprachen)', async () => {
    const turns = [
      { role: 'persona' as const, text: 'So, why should we switch?' },
      { role: 'me' as const, text: 'We can cut your onboarding time in half.' },
      { role: 'me' as const, text: 'Shall we schedule a demo next week?' },
    ];
    const run = await answer(goalCheck, { goals: ['Name one benefit', 'Ask for a next step', 'Handle a concern'], criteria: [], turns, final: false, uiLang: 'de' });
    expect(run.goals).toHaveLength(3);
    expect(run.criteria).toEqual([]);
    const end = await answer(goalCheck, { goals: ['Name one benefit'], criteria: ['Polite', 'Concrete', 'Clear ask'], turns, final: true, uiLang: 'en' });
    expect(end.criteria).toHaveLength(3);
  });
  it('claude-drill', async () => {
    for (const uiLang of ['de', 'en'] as const) expect((await answer(claudeDrill, { context: 'since vs. for', uiLang })).items).toHaveLength(5);
  });
  it('unit-listen', async () => {
    const out = await answer(unitListen, { level: 'B2', kind: 'theme', domain: 'work', themeTitle: 'Proposals', themeTask: 'Follow up', phrases: ['move forward'], context: '' });
    expect(out.notice.length).toBeGreaterThanOrEqual(2);
    expect(out.shadow.length).toBeGreaterThanOrEqual(2);
  });
  it('text-level (leichter und schwerer)', async () => {
    for (const direction of ['easier', 'harder'] as const) expect((await answer(textLevel, { text: TEXT, direction })).text.length).toBeGreaterThan(80);
  });
  it('alternatives', async () => {
    for (const uiLang of ['de', 'en'] as const) expect((await answer(alternatives, { sentence: 'I want to follow up our talk.', context: '', uiLang })).alts).toHaveLength(3);
  });
  it('text-cards', async () => {
    expect((await answer(textCards, { text: TEXT, known: [] })).cards.length).toBeGreaterThanOrEqual(5);
  });
});
