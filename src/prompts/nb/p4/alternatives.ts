import { z } from 'zod';
import { block, header, langName } from '../../common';
import { britishCount, englishText, germanText, uiText } from '../../inputCommon';
import { sliced } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// alternatives@1 (Neubau N60, DeepL Write): 2–3 natürliche Alternativen für EINEN Satz aus dem
// eigenen Text, je mit kurzer Wirkung (Oberflächensprache) und deutscher Bedeutung (für „+ Wortschatz“).
// Nur auf Tipp; der Satz und etwas Umfeld gehen mit, nie der ganze Verlauf.

export type AlternativesVars = { sentence: string; context: string; uiLang: UiLang };
export type AlternativesOut = { alts: Array<{ text: string; note: string; de: string }> };

const ID = 'alternatives';
const VERSION = 1;

export const alternatives: PromptTemplate<AlternativesVars, AlternativesOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 24 * 60 * 60 * 1000 },
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking professional (CEFR B2, aiming for C1) wrote this sentence in an English business text.',
      'Suggest 2 or 3 alternative versions that sound more natural or more precise (American English). Keep the meaning.',
      'Sentence:',
      block(vars.sentence, 600),
      'Surrounding text (for context only):',
      block(vars.context, 1500),
      `Reply with only one JSON object, no other text: {"alts": [{"text": "<alternative sentence>", "note": "<its effect in one short ${langName(vars.uiLang)} sentence>", "de": "<German meaning in a few words>"}]}`,
    ].join('\n');
  },
  schema: (vars) =>
    z.object({
      alts: sliced(z.object({ text: englishText(3, 400), note: uiText(vars.uiLang, 3, 200), de: germanText(1, 200) }), 1, 3),
    }).superRefine((v, ctx) => {
      v.alts.forEach((a, i) => {
        if (britishCount(a.text) > 1) ctx.addIssue({ code: 'custom', path: ['alts', i, 'text'], message: 'use American spelling' });
      });
    }),
};
