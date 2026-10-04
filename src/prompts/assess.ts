import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { FOCUS_DIMS, LEVELS, TRENDS } from '../domain/assessment/types';
import { header, langName, langOf } from './common';
import { clipped, firstCefr, intIn, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// assess@3 (Plan §4.6, Fokus-Umbau 04.10.2026): Claude urteilt wie eine Prüferin über das Niveau – nur aus den
// nummerierten Belegen und nur für Grammatik und Wortschatz (assess@2 beurteilte sechs Fertigkeiten; alte Antworten bleiben lesbar). `complex`, nie zwischengespeichert, per `sample()` mit eigenem Lesen
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
  dims: Array<{ id: (typeof FOCUS_DIMS)[number]; level: (typeof LEVELS)[number] | null; confidence: 'thin' | 'fair' | 'good'; why: string | null }>;
  focus: { title: string; why: string; action: string; days: number };
};

const ID = 'assess';
/** Höchstzahl der Beleg-Kennungen je Stärke/Blocker – Anweisung und Schema gleich (Befund H7). */
export const EV_MAX = 3;
const VERSION = 3;

// Tolerant gelesen (Prüfbefund W6): Texte werden gekürzt statt abgelehnt, Listen gekappt,
// Beleg-Kennungen bereinigt und gefiltert, Stufen („B2-", „B2/C1"), Trend und Belastbarkeit
// abgebildet, fehlende Fertigkeiten wie in `finalizeAssess` mit „thin"/null aufgefüllt.
const t = (max: number) => clipped(1, max);
const enText = (max: number) =>
  t(max).refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in American English' });

const TREND_ALIASES: Record<string, (typeof TRENDS)[number]> = {
  up: 'up',
  rising: 'up',
  improving: 'up',
  upward: 'up',
  flat: 'flat',
  stable: 'flat',
  steady: 'flat',
  unchanged: 'flat',
  down: 'down',
  falling: 'down',
  declining: 'down',
  downward: 'down',
};
const CONF_ALIASES: Record<string, 'thin' | 'fair' | 'good'> = {
  thin: 'thin',
  low: 'thin',
  weak: 'thin',
  limited: 'thin',
  fair: 'fair',
  medium: 'fair',
  moderate: 'fair',
  some: 'fair',
  good: 'good',
  high: 'good',
  strong: 'good',
};
const alias = <T extends string>(map: Record<string, T>) => (v: unknown): unknown => (typeof v === 'string' ? (map[v.trim().toLowerCase()] ?? v) : v);

/** Beleg-Kennungen: „[p:14d]" → „p:14d", auch als Komma-Liste; unbekannte fallen weg, höchstens EV_MAX. Mindestens eine muss bleiben (Urteil nur aus Belegen). */
export function cleanEv(v: unknown, ids: ReadonlySet<string>): unknown {
  const raw = typeof v === 'string' ? v.split(/[,;]/) : v;
  if (!Array.isArray(raw)) return v;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const id = x.trim().replace(/^\[+|\]+$/g, '').trim();
    if (ids.has(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(0, EV_MAX);
}

/** Aktion tolerant: „grammar: mixed-cond" → „grammar:mixed-cond"; nur das Thema „mixed-cond" → die erste erlaubte Aktion dazu. */
export function cleanAction(v: unknown, allowed: readonly string[]): unknown {
  if (typeof v !== 'string') return v;
  const a = v.trim().replace(/\s*:\s*/g, ':');
  if (allowed.includes(a)) return a;
  const lower = a.toLowerCase();
  const exact = allowed.find((x) => x.toLowerCase() === lower);
  if (exact) return exact;
  return allowed.find((x) => x.includes(':') && x.slice(x.indexOf(':') + 1) === lower) ?? v;
}

/** Fertigkeiten (nur Grammatik und Wortschatz): unbekannte und doppelte fallen weg, fehlende kommen als „thin" ohne Stufe dazu. */
function fillDims(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  const seen = new Map<string, unknown>();
  for (const x of v) {
    const id = x && typeof x === 'object' ? (x as { id?: unknown }).id : undefined;
    const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
    if ((FOCUS_DIMS as readonly string[]).includes(key) && !seen.has(key)) seen.set(key, { ...(x as object), id: key });
  }
  return FOCUS_DIMS.map((id) => seen.get(id) ?? { id, level: null, confidence: 'thin', why: null });
}

export function assessSchema(v: Pick<AssessVars, 'lang' | 'ids' | 'allowed'>): z.ZodType<AssessOut> {
  const ids = new Set(v.ids);
  const allowed = v.allowed as [string, ...string[]];
  const ev = z.preprocess((x) => cleanEv(x, ids), z.array(z.string()).min(1, { message: 'cite at least one known evidence id from the [brackets]' }).max(EV_MAX));
  const action = z.preprocess(
    (a) => cleanAction(a, allowed),
    z.string().refine((a) => (allowed as readonly string[]).includes(a), { message: 'action must be one of the allowed actions' }),
  );
  const level = z.preprocess((x) => firstCefr(x, LEVELS), z.enum(LEVELS));
  const dimLevel = z.preprocess((x) => {
    const l = firstCefr(x, LEVELS);
    return typeof l === 'string' && (LEVELS as readonly string[]).includes(l) ? l : null;
  }, z.enum(LEVELS).nullable());
  return z
    .object({
      level: clipped(4, 220),
      cefr: level,
      levelWhy: t(400),
      trend: z.preprocess(alias(TREND_ALIASES), z.enum(TRENDS)),
      trendWhy: t(300),
      today: t(160),
      c1gap: sliced(t(90), 1, 4),
      strengths: sliced(z.object({ title: t(60), why: t(240), ev }).superRefine(langOf(['title', 'why'], v.lang)), 1, 2),
      blockers: sliced(z.object({ title: t(60), why: t(240), fix: enText(200), action, ev }).superRefine(langOf(['title', 'why'], v.lang)), 1, 3),
      dims: z.preprocess(
        fillDims,
        z
          .array(
            z
              .object({
                id: z.enum(FOCUS_DIMS),
                level: dimLevel,
                confidence: z.preprocess(alias(CONF_ALIASES), z.enum(['thin', 'fair', 'good'])),
                why: z.preprocess((w) => (typeof w === 'string' && w.trim() ? w : null), clipped(1, 200).nullable()),
              })
              .superRefine(langOf(['why'], v.lang)),
          )
          .length(2),
      ),
      focus: z.object({ title: t(60), why: t(240), action, days: intIn(1, 7) }).superRefine(langOf(['title', 'why'], v.lang)),
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
      { title: de ? 'Gemischte Bedingungssätze' : 'Mixed conditionals', why: de ? 'Auf C1 erwartet man, Vergangenheit und Gegenwart sauber zu verknüpfen.' : 'At C1 you are expected to link past and present cleanly.', fix: 'If we had tested earlier, we would not be in this situation now.', action: a0, ev: e },
      { title: de ? 'Verlaufsform im Present Perfect' : 'Present perfect continuous', why: de ? 'Laufende Entwicklungen klingen im Present Simple unnatürlich.' : 'Ongoing developments sound unnatural in the present simple.', fix: 'We have been working on the migration since March.', action: a1, ev: e },
    ],
    dims: FOCUS_DIMS.map((id) => ({ id, level: 'B2', confidence: 'fair', why: de ? 'Mehrere Belege der letzten Wochen.' : 'Several pieces of evidence from recent weeks.' })),
    focus: { title: de ? 'Gemischte Bedingungssätze' : 'Mixed conditionals', why: de ? 'Größter Abstand zu C1 bei hoher Bedeutung für Verhandlungen.' : 'Biggest gap to C1 and highly relevant for negotiations.', action: a0, days: 3 },
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
      `- Every strength and blocker cites 1–${EV_MAX} evidence ids in "ev", copied exactly from the brackets.`,
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
      'Exactly 2 strengths, 2–3 blockers, and both skills in dims (grammar, vocabulary). Judge only grammar and vocabulary; do not rate reading, listening, writing or speaking.',
      'Reply with only one JSON object, no other text, exactly this shape:',
      JSON.stringify(assessExample(v)),
    ].join('\n');
  },
  schema: (v) => assessSchema(v),
};
