import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { DIMS, LEVELS, TRENDS } from '../domain/assessment/types';
import { header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// assess@1 (Plan §4.6): Claude urteilt wie eine Prüferin über das Niveau – nur aus den
// nummerierten Belegen. `complex`, nie zwischengespeichert, per `sample()` mit eigenem Lesen
// (`verb: 'text-json'`), damit die tatsächlich antwortende Stufe bekannt ist (Plan W4).

export type AssessVars = {
  lang: UiLang;
  /** Belege als Text (`evidenceText`) und ihre Kennungen. */
  evidence: string;
  ids: readonly string[];
  allowed: readonly string[];
  prev: { cefr: string | null; dims: Record<string, string | null> } | null;
  today: string;
};

export type AssessOut = {
  level: string;
  cefr: (typeof LEVELS)[number];
  levelWhy: string;
  trend: (typeof TRENDS)[number];
  trendWhy: string;
  today: string;
  c1gap: string[];
  strengths: Array<{ title: string; why: string; ev: string[] }>;
  blockers: Array<{ title: string; why: string; fix: string; action: string; ev: string[] }>;
  dims: Array<{ id: (typeof DIMS)[number]; level: (typeof LEVELS)[number] | null; confidence: 'thin' | 'fair' | 'good'; why: string }>;
  focus: { title: string; why: string; action: string; days: number };
};

const ID = 'assess';
const VERSION = 1;

const t = (max: number) => z.string().trim().min(1).max(max);
const enText = (max: number) =>
  t(max).refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in American English' });

export function assessSchema(v: Pick<AssessVars, 'lang' | 'ids' | 'allowed'>): z.ZodType<AssessOut> {
  const ids = new Set(v.ids);
  const allowed = v.allowed as [string, ...string[]];
  const ev = z
    .array(z.string())
    .min(1)
    .max(6)
    .superRefine((xs, ctx) => {
      xs.forEach((x, i) => {
        if (!ids.has(x)) ctx.addIssue({ code: 'custom', path: [i], message: `unknown evidence id "${x}" – use only ids in [brackets]` });
      });
    });
  const action = z.string().refine((a) => (allowed as readonly string[]).includes(a), { message: 'action must be one of the allowed actions' });
  return z
    .object({
      level: z.string().trim().min(20).max(220),
      cefr: z.enum(LEVELS),
      levelWhy: t(400),
      trend: z.enum(TRENDS),
      trendWhy: t(300),
      today: t(160),
      c1gap: z.array(t(90)).min(2).max(4),
      strengths: z.array(z.object({ title: t(60), why: t(240), ev }).superRefine(langOf(['why'], v.lang))).length(2),
      blockers: z.array(z.object({ title: t(60), why: t(240), fix: enText(200), action, ev }).superRefine(langOf(['why'], v.lang))).min(2).max(3),
      dims: z
        .array(z.object({ id: z.enum(DIMS), level: z.enum(LEVELS).nullable(), confidence: z.enum(['thin', 'fair', 'good']), why: z.string().trim().max(200) }).superRefine(langOf(['why'], v.lang)))
        .length(6)
        .refine((ds) => new Set(ds.map((d) => d.id)).size === 6, { message: 'dims must contain each of the six skills exactly once' }),
      focus: z.object({ title: t(60), why: t(240), action, days: z.number().int().min(1).max(7) }).superRefine(langOf(['why'], v.lang)),
    })
    .superRefine(langOf(['level', 'levelWhy', 'trendWhy', 'today'], v.lang))
    .superRefine((o, ctx) => {
      o.c1gap.forEach((g, i) => {
        if (isWrongLang(g, v.lang)) ctx.addIssue({ code: 'custom', path: ['c1gap', i], message: `must be written in ${langName(v.lang)}` });
      });
    });
}

/** Beispielantwort (besteht selbst das Schema, Test). */
export function assessExample(v: Pick<AssessVars, 'lang' | 'ids' | 'allowed'>): AssessOut {
  const de = v.lang === 'de';
  const e = [v.ids[0] ?? 'p:14d'];
  const a0 = v.allowed[0] ?? 'write';
  const a1 = v.allowed[1] ?? a0;
  return {
    level: de ? 'Solides B2: Du kommunizierst im Beruf sicher, unter Zeitdruck wackeln noch einige Zeitformen.' : 'Solid B2: you communicate confidently at work, but some tenses still slip under time pressure.',
    cefr: 'B2',
    levelWhy: de ? 'Deine Texte sind klar aufgebaut, aber Fehler bei Bedingungssätzen häufen sich in schnellen Antworten.' : 'Your texts are well structured, but conditional sentences go wrong more often in fast answers.',
    trend: 'up',
    trendWhy: de ? 'Die Trefferquote in Grammatik ist in den letzten zwei Wochen gestiegen.' : 'Your grammar accuracy has risen over the last two weeks.',
    today: de ? 'Heute zehn Minuten Bedingungssätze mit eigenen Beispielen.' : 'Today spend ten minutes on conditionals with your own examples.',
    c1gap: de ? ['Hypothesen sicher formulieren', 'Kritik diplomatisch äußern'] : ['State hypotheses with confidence', 'Voice criticism diplomatically'],
    strengths: [
      { title: de ? 'Klare E-Mails' : 'Clear emails', why: de ? 'Deine Texte haben Anliegen, Begründung und nächsten Schritt.' : 'Your texts state the request, the reason and the next step.', ev: e },
      { title: de ? 'Fachwortschatz' : 'Domain vocabulary', why: de ? 'Du nutzt Fachbegriffe passend und ohne Umwege.' : 'You use technical terms correctly and directly.', ev: e },
    ],
    blockers: [
      { title: 'Mixed conditionals', why: de ? 'Auf C1 erwartet man, Vergangenheit und Gegenwart sauber zu verknüpfen.' : 'At C1 you are expected to link past and present cleanly.', fix: 'If we had tested earlier, we would not be in this situation now.', action: a0, ev: e },
      { title: 'Present perfect continuous', why: de ? 'Laufende Entwicklungen klingen im Present Simple unnatürlich.' : 'Ongoing developments sound unnatural in the present simple.', fix: 'We have been working on the migration since March.', action: a1, ev: e },
    ],
    dims: DIMS.map((id) => ({ id, level: id === 'speaking' ? null : 'B2', confidence: id === 'speaking' ? 'thin' : 'fair', why: de ? 'Mehrere Belege der letzten Wochen.' : 'Several pieces of evidence from recent weeks.' })),
    focus: { title: 'Mixed conditionals', why: de ? 'Größter Abstand zu C1 bei hoher Bedeutung für Verhandlungen.' : 'Biggest gap to C1 and highly relevant for negotiations.', action: a0, days: 3 },
  };
}

export const assess: PromptTemplate<AssessVars, AssessOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: false,
  verb: 'text-json',
  build(v) {
    const prev = v.prev
      ? `Previous assessment: overall ${v.prev.cefr ?? '–'}; ${Object.entries(v.prev.dims)
          .map(([k, l]) => `${k}=${l ?? 'none'}`)
          .join(' ')}`
      : 'Previous assessment: none';
    return [
      header({ id: ID, version: VERSION }),
      'You are a strict CEFR examiner for a German-speaking Head of Business Development, currently B2 and aiming for C1.',
      `Today is ${v.today}.`,
      'Judgment rules:',
      '- Judge ONLY from the numbered evidence below. Never invent results.',
      '- Give a skill level (A2, B1, B1+, B2, B2+, C1, C1+) only where the evidence supports it; otherwise level null and confidence "thin".',
      '- Prefer "thin" to guessing. confidence: "thin" = little evidence, "fair" = some, "good" = plenty and consistent.',
      '- trend compares with the previous assessment and the recent logs: "up", "flat" or "down".',
      '- Every strength and blocker cites 1–3 evidence ids in "ev", copied exactly from the brackets.',
      '- blockers: why it stands out at C1 ("why"), how to get it right ("fix", one model sentence in American English), and one action from the allowed list.',
      '- focus: the one thing for the next days, with an allowed action and days 1–7.',
      'Language rules:',
      `- Write level, levelWhy, trendWhy, today, c1gap, titles and every "why" in ${langName(v.lang)}.`,
      '- "fix" is always American English. Grammar terms may stay in English.',
      prev,
      'Evidence:',
      v.evidence,
      `Allowed actions: ${v.allowed.join(', ')}`,
      'Length limits: level 20–220 characters, levelWhy ≤ 400, trendWhy ≤ 300, today ≤ 160, each c1gap item ≤ 90 (2–4 items), titles ≤ 60, why ≤ 240, fix ≤ 200, dims.why ≤ 200.',
      'Exactly 2 strengths, 2–3 blockers, and all six skills in dims (grammar, vocabulary, reading, listening, writing, speaking).',
      'Reply with only one JSON object, no other text, exactly this shape:',
      JSON.stringify(assessExample(v)),
    ].join('\n');
  },
  schema: (v) => assessSchema(v),
};
