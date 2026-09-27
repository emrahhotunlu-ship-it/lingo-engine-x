import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, lenientArray, normalizeTaskRaw } from './common';
import type { PromptTemplate } from './types';

// grammar-items@2 (phase2-plan §7): neue Aufgaben zu EINEM Thema, nur auf Knopfdruck
// („Neue Aufgaben zu {Thema}"). Ausgabe im Pool-Format der alten App, damit sie per
// `poolIntake` gespeichert werden können. Erklärungen fest zweisprachig (de + en): Welche
// angezeigt wird, entscheidet die Oberflächensprache, gemischt wird nie.

export type GrammarItemsVars = {
  topic: string;
  nameEn: string;
  ruleEn: string;
  examples: readonly string[];
  /** Anzeige-Beherrschung 0–1. */
  p: number;
  types: ReadonlyArray<'mc' | 'gap' | 'transform' | 'correct'>;
  seenText: readonly string[];
  /** Echte Fehler Emrahs zum Thema (≤ 5). */
  errors: ReadonlyArray<{ q: string; given: string; ans: string }>;
  count: number;
};

export type GrammarItem = {
  topic: string;
  type: 'mc' | 'gap' | 'transform' | 'correct';
  prompt: string;
  answer: string;
  accepted: string[];
  options: string[] | null;
  hint_de: string;
  explanation_de: string;
  explanation_en: string;
  src: 'ai';
};
export type GrammarItemsOut = { items: GrammarItem[] };

export const ITEMS_RULE_MAX = 600;
export const ITEMS_SEEN_MAX = 20;
export const ITEMS_ERRORS_MAX = 5;

export const GRAMMAR_ITEMS_EXAMPLE =
  '{"items":[{"topic":"passive","type":"gap","prompt":"The new contract ___ (sign) yesterday.","answer":"was signed","accepted":[],"options":null,"hint_de":"(sign)","explanation_de":"„yesterday“ zeigt eine abgeschlossene Zeit, und der Vertrag handelt nicht selbst → was + 3. Form.","explanation_en":"“yesterday” shows finished time, and the contract does not act itself → was + past participle.","src":"ai"}]}';

const ID = 'grammar-items';
const VERSION = 2;

const blanks = (s: string) => (s.match(/_{3,}/g) ?? []).length;

const itemSchema = (topic: string) =>
  z
    .object({
      topic: z.literal(topic),
      type: z.enum(['mc', 'gap', 'transform', 'correct']),
      prompt: z.string().trim().min(8).max(300),
      answer: z.string().trim().min(1).max(200),
      accepted: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
      options: z.array(z.string().trim().min(1).max(80)).min(3).max(4).nullable().default(null),
      hint_de: z.string().trim().max(60).default(''),
      explanation_de: z.string().trim().min(8).max(400),
      explanation_en: z.string().trim().min(8).max(400),
      src: z.literal('ai').default('ai'),
    })
    .superRefine((it, ctx) => {
      if (it.type === 'mc') {
        if (!it.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'mc needs 3–4 options' });
        else if (!it.options.includes(it.answer)) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'answer must be one of the options' });
      } else if (it.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be null unless type is mc' });
      if ((it.type === 'mc' || it.type === 'gap' || it.type === 'transform') && blanks(it.prompt) !== 1) {
        ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'prompt must contain exactly one ___' });
      }
      if (isWrongLang(it.explanation_de, 'de')) ctx.addIssue({ code: 'custom', path: ['explanation_de'], message: 'must be written in German' });
      if (isWrongLang(it.explanation_en, 'en')) ctx.addIssue({ code: 'custom', path: ['explanation_en'], message: 'must be written in English' });
    });

// W8: Aufgaben einzeln prüfen – ungültige fallen weg, gescheitert wird nur bei zu wenigen gültigen.
const schemaFor = (v: GrammarItemsVars): z.ZodType<GrammarItemsOut> =>
  z.object({ items: lenientArray(z.preprocess(normalizeTaskRaw, itemSchema(v.topic)), Math.min(3, v.count), Math.max(v.count, 8)) });

export const grammarItems: PromptTemplate<GrammarItemsVars, GrammarItemsOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const style =
      v.p < 0.4 ? 'mostly mc with clear contrasts and short sentences, some gap' : v.p <= 0.7 ? 'mostly gap and transform' : 'mostly correct and transform (less guessable)';
    return [
      header({ id: ID, version: VERSION }),
      'You write grammar practice items for ONE learner: German native speaker, English level B2 aiming for C1,',
      'head of business development at a German DMS/ECM cloud vendor. Use everyday and work situations, invented names only,',
      'never facts about a real company. Sentences at most about 18 words. American English (US spelling); list British variants in "accepted".',
      `Topic id: ${v.topic}`,
      `Topic: ${clip(v.nameEn, 80)}`,
      `Rule: ${clip(v.ruleEn, ITEMS_RULE_MAX)}`,
      `Examples: ${v.examples.map((e) => clip(e, 160)).join(' | ') || '(none)'}`,
      `Mastery: ${Math.round(v.p * 100)}% – style: ${style}`,
      `Wanted types: ${v.types.join(', ') || 'mc, gap, transform, correct'}`,
      `Count: ${v.count}`,
      `Do not repeat: ${v.seenText.slice(-ITEMS_SEEN_MAX).map((s) => clip(s, 140)).join(' | ') || '(none)'}`,
      `Recent mistakes (learner answer → correct): ${
        v.errors
          .slice(-ITEMS_ERRORS_MAX)
          .map((e) => `${clip(e.q, 140)} :: ${clip(e.given, 60)} → ${clip(e.ans, 60)}`)
          .join(' | ') || '(none)'
      }`,
      'Reply with only one JSON object of this shape (one item shown):',
      GRAMMAR_ITEMS_EXAMPLE,
      'Rules:',
      '- EXACTLY ONE correct answer per item. Reject any item where a second option is also grammatical in some context.',
      '- Tense items (mc and gap): the sentence MUST contain a clear signal (e.g. "yesterday", "right now", "since 2020", "every Monday", "by next June") that rules out every other option. Without such a signal, "is" vs. "was" is ambiguous – never write that.',
      '  If another form would also be correct, add a signal word that rules it out, or list it in "accepted".',
      '- If there are recent mistakes, write NEW items that test exactly the same confusion with different sentences.',
      '- "mc": prompt with one ___ and 3–4 options, "answer" identical to one option. "gap": one ___, hint_de gives the base form like "(work)".',
      '  "transform": a sentence, then "→" and the new sentence with one ___; answer is only the missing part.',
      '  "correct": one sentence with exactly one typical error; answer is the full corrected sentence; options null.',
      '- explanation_de: 1–2 short sentences in simple German: the signal word and the rule it triggers (never just repeat the answer); put English words and phrases in “…”.',
      '- explanation_en: the same in simple English.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
