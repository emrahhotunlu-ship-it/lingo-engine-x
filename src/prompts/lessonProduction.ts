import { z } from 'zod';
import { coreWord } from '../domain/course/baseLesson';
import { containsTarget } from '../domain/course/production';
import { isWrongLang } from '../domain/lang/detect';
import { cefrLoose, clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// lesson-production@2 (phase2-plan §7, §4.9): Rückmeldung zur Produktion am Ende einer Lektion
// auf Knopfdruck „Prüfen lassen". Ergebnis → `writing/lesson-<lid>-<ms>` und Radar `w`.
// Der Abschluss der Lektion hängt nie von der KI ab.

export type LessonProductionVars = {
  taskEn: string;
  mustUse: readonly string[];
  structure: string;
  text: string;
  candoEn: string;
  uiLang: UiLang;
};

export type LessonProductionOut = {
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  scores: { task: number; grammar: number; vocabulary: number; coherence: number; register: number };
  errors: Array<{ wrong: string; right: string; why: string; cat: string; sev: 'minor' | 'major' }>;
  upgrades: Array<{ orig: string; better: string; why: string }>;
  mustUsed: string[];
  structureUsed: boolean;
  cando: 'met' | 'partly' | 'not';
  candoWhy: string;
  model: string;
};

export const PRODUCTION_TEXT_MAX = 1200;

export const LESSON_PRODUCTION_EXAMPLE =
  '{"cefr":"B2","scores":{"task":80,"grammar":70,"vocabulary":75,"coherence":80,"register":85},"errors":[{"wrong":"…","right":"…","why":"…","cat":"tense","sev":"minor"}],"upgrades":[{"orig":"…","better":"…","why":"…"}],"mustUsed":["…"],"structureUsed":true,"cando":"partly","candoWhy":"…","model":"…"}';

const ID = 'lesson-production';
const VERSION = 2;

const score = z.number().min(0).max(100);

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Die Vorgabe, die ein genanntes Pflichtwort meint (Grundform, ohne „to“, gebeugt), sonst `undefined`. */
export function mustUseOf(required: readonly string[], named: string): string | undefined {
  return required.find((r) => same(named, r) || same(coreWord(named), coreWord(r)) || containsTarget(named, r));
}

const schemaFor = (v: LessonProductionVars): z.ZodType<LessonProductionOut> =>
  z
    .object({
      cefr: z.preprocess(cefrLoose, z.enum(['A2', 'B1', 'B2', 'C1', 'C2'])),
      scores: z.object({ task: score, grammar: score, vocabulary: score, coherence: score, register: score }),
      errors: z
        .array(z.object({ wrong: z.string().trim().min(1).max(200), right: z.string().trim().min(1).max(200), why: z.string().trim().min(1).max(300), cat: z.string().trim().min(1).max(20), sev: z.enum(['minor', 'major']) }))
        .max(6),
      upgrades: z.array(z.object({ orig: z.string().trim().min(1).max(200), better: z.string().trim().min(1).max(200), why: z.string().trim().min(1).max(300) })).max(3),
      mustUsed: z.array(z.string().trim()),
      structureUsed: z.boolean(),
      cando: z.enum(['met', 'partly', 'not']),
      candoWhy: z.string().trim().min(1).max(400),
      model: z.string().trim().min(10).max(1200),
    })
    // W6: genannte Pflichtwörter den Vorgaben zuordnen („recap“, „action items“ → „to recap“,
    // „action item“); Unbekanntes fällt weg, doppelte werden zusammengefasst.
    .transform((o) => ({ ...o, mustUsed: [...new Set(o.mustUsed.map((m) => mustUseOf(v.mustUse, m)).filter((m): m is string => !!m))] }))
    .superRefine((o, ctx) => {
      o.errors.forEach((e, i) => {
        if (isWrongLang(e.why, v.uiLang)) ctx.addIssue({ code: 'custom', path: ['errors', i, 'why'], message: `must be written in ${langName(v.uiLang)}` });
      });
      if (isWrongLang(o.model, 'en')) ctx.addIssue({ code: 'custom', path: ['model'], message: 'must be written in English' });
    })
    .superRefine(langOf(['candoWhy'], v.uiLang));

export const lessonProduction: PromptTemplate<LessonProductionVars, LessonProductionOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You give feedback on a short text by a German-speaking learner (B2, aiming for C1) at the end of a lesson.',
      'American English is the standard; British spelling and British words count as correct (mention the US form as a tip, never as an error).',
      `Task: ${clip(v.taskEn, 400)}`,
      `Required words: ${v.mustUse.map((m) => clip(m, 60)).join(', ') || '(none)'}`,
      `Target structure: ${clip(v.structure, 120)}`,
      `Can-do goal: ${clip(v.candoEn, 300)}`,
      `Learner text: ${clip(v.text, PRODUCTION_TEXT_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object of this shape:',
      LESSON_PRODUCTION_EXAMPLE,
      'Rules:',
      '- Judge only from the text given; if it is too short to judge, answer cando "partly", never invent evidence.',
      '- errors: at most 6 real errors, most important first; why in the explanation language (English words and phrases in “…”); cat one of',
      '  tense, cond, verbform, pattern, modals, passive, reported, relative, articles, prep, order, wordchoice, register, spelling.',
      '- upgrades: at most 3 more natural C1 phrasings of the learner’s own sentences.',
      '- mustUsed: the required words the learner used correctly (any inflected form), written exactly as in the list. structureUsed: target structure used correctly at least once.',
      '- candoWhy: one or two sentences in the explanation language. model: a short model answer in English (3–5 sentences).',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};

/** KI-Ergebnis → Dokument `writing/lesson-<lid>-<ms>` (phase2-plan §4.9). */
export function toWritingDoc(i: { lid: string; text: string; t: number; out: LessonProductionOut }): { path: string; doc: Record<string, unknown> } {
  const id = `lesson-${i.lid}-${i.t}`;
  const text = i.text.slice(0, 4000);
  return {
    path: `writing/${id}`,
    doc: {
      id,
      t: i.t,
      text,
      words: (text.match(/[A-Za-z']+/g) ?? []).length,
      lesson: i.lid,
      res: { cefr: i.out.cefr, scores: i.out.scores, errors: i.out.errors.slice(0, 6), cando: i.out.cando, pv: `${ID}@${VERSION}` },
    },
  };
}
