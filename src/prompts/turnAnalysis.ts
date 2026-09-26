import { clip, header } from './common';
import { threeLayersExample, threeLayersRules, threeLayersSchema, type ThreeLayersOut } from './threeLayers';
import type { PromptTemplate, UiLang } from './types';

// turn-analysis@1 (Plan §6.2): analysiert EINEN eigenen Satz im Rollenspiel in drei Schichten.
// `complex` (Kap. 10), im Hintergrund (Analysespur), zwischengespeichert (gleicher Satz im
// gleichen Zusammenhang kostet nichts doppelt). Stört den Gesprächsfluss nie.

export type TurnAnalysisVars = {
  goal: string;
  role: string;
  /** Letzte Zeile der Figur, auf die der Satz antwortet. */
  personaLine: string;
  /** Bis zu 2 frühere Wechsel (Figur → ich). */
  history: ReadonlyArray<{ persona: string; me: string }>;
  sentence: string;
  focusWords: readonly string[];
  uiLang: UiLang;
};

export const TA_LINE_MAX = 400;
export const TA_HISTORY_MAX = 1200;
export const TA_SENTENCE_MAX = 600;

const ID = 'turn-analysis';
const VERSION = 1;

export const turnAnalysis: PromptTemplate<TurnAnalysisVars, ThreeLayersOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: true,
  build(v) {
    const hist = clip(
      v.history
        .slice(-2)
        .map((h) => `Them: ${h.persona} / Learner: ${h.me}`)
        .join(' | '),
      TA_HISTORY_MAX,
    );
    return [
      header({ id: ID, version: VERSION }),
      'You coach a German-speaking business professional (B2, aiming for C1) during a spoken role-play.',
      'Analyze ONLY the learner sentence below. The other speaker never corrects; you do, afterwards.',
      `Learner goal: ${clip(v.goal, 300)}`,
      `Other speaker: ${clip(v.role, 200)}`,
      `Earlier exchanges: ${hist || '(none)'}`,
      `Other speaker just said: ${clip(v.personaLine, TA_LINE_MAX)}`,
      `Learner sentence: ${clip(v.sentence, TA_SENTENCE_MAX)}`,
      `Focus words: ${v.focusWords.slice(0, 8).map((w) => clip(w, 40)).join(', ') || '(none)'}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      threeLayersExample(v.uiLang),
      'Rules:',
      ...threeLayersRules(v.uiLang),
      '- Judge the sentence as spoken business English in this situation (register and tone count).',
      '- Never invent facts about the learner\'s company.',
    ].join('\n');
  },
  schema: (v) => threeLayersSchema({ sentence: clip(v.sentence, TA_SENTENCE_MAX), focusWords: v.focusWords, uiLang: v.uiLang }),
};
