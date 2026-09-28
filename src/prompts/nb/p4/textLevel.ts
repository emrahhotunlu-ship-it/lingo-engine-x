import { z } from 'zod';
import { block, header } from '../../common';
import { britishCount, englishText, words } from '../../inputCommon';
import type { PromptTemplate } from '../../types';

// text-level@1 (Neubau N59, LingQ „KI-Vereinfachen“): derselbe Text leichter (B1+/B2) oder näher an
// C1 umgeschrieben – gleicher Inhalt, gleiche Absätze, US-Englisch. Nur auf Knopfdruck im Leser.

export type TextLevelVars = { text: string; direction: 'easier' | 'harder' };
export type TextLevelOut = { text: string };

const ID = 'text-level';
const VERSION = 1;

export const textLevel: PromptTemplate<TextLevelVars, TextLevelOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 24 * 60 * 60 * 1000 },
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      'You rewrite a reading text for a German-speaking professional who is learning English (CEFR B2, aiming for C1).',
      vars.direction === 'easier'
        ? 'Make it easier (about CEFR B1+/B2): shorter sentences, common words, the same facts and the same order.'
        : 'Make it closer to CEFR C1: precise vocabulary, natural collocations, varied sentence structure (e.g. participle clauses, inversion, cleft sentences), the same facts and the same order.',
      'Keep the paragraph breaks. Use American English. No headings, no lists, no comments.',
      'Text:',
      block(vars.text, 6000),
      'Reply with only one JSON object, no other text: {"text": "<the rewritten text>"}',
    ].join('\n');
  },
  schema: (vars) =>
    z.object({ text: englishText(80, 8000) }).superRefine((v, ctx) => {
      const n = words(v.text);
      const src = words(vars.text);
      if (n < src * 0.5 || n > src * 1.6) ctx.addIssue({ code: 'custom', path: ['text'], message: `keep roughly the same length (${src} words)` });
      if (britishCount(v.text) > 2) ctx.addIssue({ code: 'custom', path: ['text'], message: 'use American spelling' });
    }),
};
