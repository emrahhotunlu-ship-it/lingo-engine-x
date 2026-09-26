import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, header, langName } from './common';
import type { PromptTemplate, UiLang } from './types';

// preply-prep@1: eine Preply-Stunde vorbereiten (Phase 5 §6.3, Kap. 6.10). Ergebnis im
// Altformat von `preply/pp<ms>`. `default`, `cache: false` („Neu erstellen" muss neu sein).
// `watch` besteht NUR aus echten eigenen Fehlern (sonst Schemafehler → ein Neuversuch, A6.3).

export type PrepCtx = { kind: 'free' | 'lesson' | 'topic' | 'import'; title?: string; topic?: string };
export type PrepVars = {
  uiLang: UiLang;
  minutes: 25 | 50 | 60;
  ctx: PrepCtx;
  learner: string;
  errors: ReadonlyArray<{ wrong: string; right: string; topic: string }>;
  words: readonly string[];
  lastImport: { title: string; homework: readonly string[] } | null;
  work: string;
};
export type PrepOut = {
  title: string;
  goal_en: string;
  goal_x: string;
  warmup: string[];
  talk: string[];
  say: string[];
  watch: Array<{ mistake: string; fix: string; note: string }>;
  message: string;
};

const ID = 'preply-prep';
const VERSION = 1;
export const PREP_ERRORS_MAX = 8;
export const PREP_WORDS_MAX = 10;

/** Beispielantwort (UI Deutsch, mit einem übergebenen Fehler); besteht selbst das Schema (Test). */
export const PREP_EXAMPLE =
  '{"title":"Einwände souverän behandeln","goal_en":"Handle three typical objections to a cloud DMS without hesitating.","goal_x":"Drei typische Einwände gegen ein Cloud-DMS ohne Zögern entkräften.","warmup":["What was the hardest question a customer asked you this month?","How do you usually start a sales call?","Which objection do you hear most often?"],"talk":["Describe a deal you lost and what you would do differently.","How do you explain data security to a skeptical CFO?","Role-play: the customer says the price is too high."],"say":["I understand your concern, and that is exactly why we offer a pilot.","Would it help if we started with one department?","Let me walk you through how other customers solved this.","If you had the numbers in one place, would that change your view?"],"watch":[{"mistake":"We look forward to hear from you.","fix":"We look forward to hearing from you.","note":"Nach „look forward to“ folgt die -ing-Form."}],"message":"Hi! In our next lesson I would like to practice handling objections in sales calls. Could we do a short role-play where you are a skeptical customer? Please correct my verb forms after prepositions."}';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const langIs = (lang: 'de' | 'en', field: string) => (s: string, ctx: z.RefinementCtx) => {
  if (isWrongLang(s, lang)) ctx.addIssue({ code: 'custom', message: `${field} must be written in ${langName(lang)}` });
};

export function prepSchema(vars: Pick<PrepVars, 'uiLang' | 'errors'>): z.ZodType<PrepOut> {
  const en = (max: number, field: string) => z.string().trim().min(1).max(max).superRefine(langIs('en', field));
  const ui = (max: number, field: string) => z.string().trim().min(1).max(max).superRefine(langIs(vars.uiLang, field));
  const known = new Set(vars.errors.map((e) => norm(e.wrong)).filter(Boolean));
  return z
    .object({
      title: ui(80, 'title'),
      goal_en: en(200, 'goal_en'),
      goal_x: ui(200, 'goal_x'),
      warmup: z.array(en(160, 'warmup')).min(3).max(4),
      talk: z.array(en(220, 'talk')).min(3).max(5),
      say: z.array(en(160, 'say')).min(4).max(6),
      watch: z
        .array(z.object({ mistake: en(200, 'mistake'), fix: en(200, 'fix'), note: z.string().trim().max(160).superRefine(langIs(vars.uiLang, 'note')) }))
        .max(4),
      message: z.string().trim().min(60).max(700).superRefine(langIs('en', 'message')),
    })
    .superRefine((v, ctx) => {
      if (known.size >= 2 && v.watch.length < 2) ctx.addIssue({ code: 'custom', path: ['watch'], message: 'use 2 to 4 of the given mistakes' });
      v.watch.forEach((w, i) => {
        if (!known.has(norm(w.mistake))) ctx.addIssue({ code: 'custom', path: ['watch', i, 'mistake'], message: 'mistake must be copied exactly from the given list' });
      });
    });
}

function ctxLine(c: PrepCtx): string {
  if (c.kind === 'lesson') return `Current course lesson: ${clip(c.title ?? '', 100)}${c.topic ? ` (grammar: ${clip(c.topic, 60)})` : ''}`;
  if (c.kind === 'topic') return `Topic chosen by the learner: ${clip(c.title ?? '', 120)}`;
  if (c.kind === 'import') return `Follow-up to the last lesson: ${clip(c.title ?? '', 100)}`;
  return 'Free conversation about work and everyday life.';
}

export const preplyPrep: PromptTemplate<PrepVars, PrepOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(vars) {
    const errors = vars.errors.slice(0, PREP_ERRORS_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'You prepare a 1:1 English lesson with a human tutor on Preply for a German-speaking professional (CEFR B2, aiming for C1).',
      `Work context: ${clip(vars.work, 200)}`,
      `Lesson length: ${vars.minutes} minutes`,
      `Occasion: ${ctxLine(vars.ctx)}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      'Learner profile:',
      block(vars.learner, 2_500) || '(no data)',
      'Real recent mistakes of the learner (wrong → correct):',
      errors.length ? errors.map((e) => `- ${clip(e.wrong, 200)} → ${clip(e.right, 200)}`).join('\n') : '(none)',
      `Words to use actively: ${vars.words.slice(0, PREP_WORDS_MAX).map((w) => clip(w, 40)).join(', ') || '(none)'}`,
      vars.lastImport
        ? `Last lesson: ${clip(vars.lastImport.title, 80)}; homework: ${vars.lastImport.homework.slice(0, 5).map((h) => clip(h, 120)).join(' | ') || '(none)'}`
        : 'Last lesson: (unknown)',
      'Reply with only one JSON object, no other text, exactly this shape:',
      PREP_EXAMPLE,
      'Rules:',
      '- title, goal_x: in the explanation language. goal_en, warmup, talk, say, watch.mistake, watch.fix and message: American English.',
      '- warmup: 3–4 easy opening questions. talk: 3–5 talking points from the work context. say: 4–6 model sentences slightly above the learner level (i+1).',
      '- watch: 2–4 items copied EXACTLY from the list of real mistakes (mistake = the wrong sentence, fix = the correct one, note = short tip in the explanation language). If the list is "(none)", watch is [].',
      '- message: a friendly message (60–700 characters) the learner sends to the tutor, naming the goal and the focus.',
    ].join('\n');
  },
  schema: (vars) => prepSchema(vars),
};
