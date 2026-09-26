import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, langName, langOf } from './common';
import { ERROR_CATS } from './threeLayers';
import type { PromptTemplate, UiLang } from './types';

// roleplay-report@1 (Plan §5.4, §6.2): Urteil in Worten nach einem Gespräch – Ziel, Stärken
// mit Zitat, Fokuspunkte, beste Wendungen. Kein Punktestand (Kap. 2.3). `default`, zwischen-
// gespeichert. Zitate müssen wörtlich aus den eigenen Zügen stammen.

export type ReportTurnInfo = { me: string; persona: string; v: string; c: readonly string[] };

export type RoleplayReportVars = {
  title: string;
  goal: string;
  role: string;
  turns: readonly ReportTurnInfo[];
  taken: readonly string[];
  uiLang: UiLang;
};

export type RoleplayReportOut = {
  goal: { state: 'reached' | 'partly' | 'missed'; why: string };
  summary: string;
  strengths: Array<{ quote: string; why: string }>;
  focus: Array<{ title: string; said: string; better: string; why: string; cat: string }>;
  phrases: Array<{ en: string; de: string; def: string; ex: string }>;
};

export const REP_ME_MAX = 300;
export const REP_PERSONA_MAX = 200;
export const REP_TURNS_MAX = 16;

const ID = 'roleplay-report';
const VERSION = 1;

const en = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export function reportSchema(v: Pick<RoleplayReportVars, 'turns' | 'uiLang'>): z.ZodType<RoleplayReportOut> {
  const mine = v.turns.map((t) => clip(t.me, REP_ME_MAX));
  const inMine = (s: string) => mine.some((m) => containsPhrase(m, s));
  return z
    .object({
      goal: z.object({ state: z.enum(['reached', 'partly', 'missed']), why: z.string().trim().min(1).max(240) }).superRefine(langOf(['why'], v.uiLang)),
      summary: z.string().trim().min(1).max(500),
      strengths: z
        .array(z.object({ quote: z.string().trim().min(1).max(300), why: z.string().trim().min(1).max(200) }).superRefine(langOf(['why'], v.uiLang)))
        .min(1)
        .max(2),
      focus: z
        .array(
          z
            .object({ title: z.string().trim().min(1).max(80), said: z.string().trim().min(1).max(300), better: en(300), why: z.string().trim().min(1).max(200), cat: z.string().trim() })
            .superRefine(langOf(['title', 'why'], v.uiLang)),
        )
        .min(1)
        .max(3),
      phrases: z.array(z.object({ en: en(80), de: z.string().trim().min(1).max(120), def: en(160), ex: en(240) })).max(3),
    })
    .superRefine((o, ctx) => {
      o.strengths.forEach((s, i) => {
        if (!inMine(s.quote)) ctx.addIssue({ code: 'custom', path: ['strengths', i, 'quote'], message: 'must be quoted word for word from a learner turn' });
      });
      o.focus.forEach((f, i) => {
        if (!inMine(f.said)) ctx.addIssue({ code: 'custom', path: ['focus', i, 'said'], message: 'must be quoted word for word from a learner turn' });
        if (!ERROR_CATS.includes(f.cat)) ctx.addIssue({ code: 'custom', path: ['focus', i, 'cat'], message: `cat must be one of: ${ERROR_CATS.join(', ')}` });
      });
      o.phrases.forEach((p, i) => {
        if (!containsPhrase(p.ex, p.en)) ctx.addIssue({ code: 'custom', path: ['phrases', i, 'ex'], message: 'ex must contain en word for word' });
      });
    })
    .superRefine(langOf(['summary'], v.uiLang));
}

export function reportExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    goal: { state: 'partly', why: de ? 'Du hast das Risiko benannt, aber keinen festen Termin vereinbart.' : 'You named the risk but did not agree on a firm date.' },
    summary: de ? 'Du bist ruhig geblieben und hast Argumente gebracht. Bei Einwänden bist du noch zu schnell eingeknickt.' : 'You stayed calm and gave reasons. You still gave in too quickly when he objected.',
    strengths: [{ quote: 'the exposure here is the penalty', why: de ? 'Klare Benennung des Risikos, ohne Vorwurf.' : 'A clear statement of the risk without blame.' }],
    focus: [
      {
        title: de ? 'Vorschläge abschwächen' : 'Softening proposals',
        said: 'we must delay the start',
        better: 'I would rather we kept the Q2 date.',
        why: de ? '„I would rather we …“ klingt nach Vorschlag statt nach Befehl.' : '"I would rather we …" sounds like a proposal, not an order.',
        cat: 'register',
      },
    ],
    phrases: [{ en: 'that hinges on', de: 'das hängt ab von', def: 'depends mainly on', ex: 'That hinges on how fast your team can test.' }],
  });
}

export const roleplayReport: PromptTemplate<RoleplayReportVars, RoleplayReportOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    const lines = v.turns.slice(-REP_TURNS_MAX).map((t, i) => {
      const c = t.c.length ? ` [${t.c.join(', ')}]` : '';
      return `- T${i + 1} them: ${clip(t.persona, REP_PERSONA_MAX)}\n  T${i + 1} learner: ${clip(t.me, REP_ME_MAX)} (${t.v}${c})`;
    });
    return [
      header({ id: ID, version: VERSION }),
      'You coach a German-speaking business professional (B2, aiming for C1) after a spoken role-play.',
      'Judge in words, not in points. Be specific, kind and honest.',
      `Scene: ${clip(v.title, 160)}`,
      `Learner goal: ${clip(v.goal, 300)}`,
      `Other speaker: ${clip(v.role, 200)}`,
      'Turns (with a short verdict per learner turn):',
      ...lines,
      `Phrases the learner already saved: ${v.taken.slice(0, 12).map((p) => clip(p, 60)).join(', ') || '(none)'}`,
      `Explanation language: ${langName(v.uiLang)} (goal.why, summary, strengths.why, focus.title, focus.why). All English fields in American English.`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      reportExample(v.uiLang),
      'Rules:',
      '- goal.state: "reached", "partly" or "missed"; goal.why: one sentence.',
      '- summary: at most 3 sentences.',
      '- strengths: 1–2 items; quote copied word for word from a learner turn.',
      '- focus: 1–3 items; said copied word for word from a learner turn; better = how a C1 speaker would say it;',
      `  cat one of ${ERROR_CATS.join(', ')}.`,
      '- phrases: up to 3 useful phrases for this situation that the learner has not saved yet; ex contains en word for word.',
      '- British spelling is never a mistake.',
    ].join('\n');
  },
  schema: (v) => reportSchema(v),
};
