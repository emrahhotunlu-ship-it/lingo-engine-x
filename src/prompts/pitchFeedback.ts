import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { ERROR_CATS, threeLayersRules, threeLayersSchema, type ThreeLayersOut } from './threeLayers';
import { loose, topicCat } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// pitch-feedback@2 (Plan §5.5, §6.2): Rückmeldung auf den eigenen Präsentationsversuch –
// Abdeckung der Folienpunkte plus die drei Schichten (Korrektheit, C1-Fassung, „landet besser“).
// `default`, zwischengespeichert.

export type PitchFeedbackVars = { points: readonly string[]; model: string; attempt: string; uiLang: UiLang };
export type PitchFeedbackOut = ThreeLayersOut & { coverage: Array<{ point: string; covered: boolean; note: string }> };

export const PF_MODEL_MAX = 3000;
export const PF_ATTEMPT_MAX = 2000;
export const PF_UPGRADED_MAX = 1500;

const ID = 'pitch-feedback';
const VERSION = 2;

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Punkt mit den meisten gemeinsamen Wörtern (mindestens 60 % seiner Wörter), sonst -1. */
function bestOverlap(k: string, keys: readonly string[]): number {
  const got = new Set(k.split(' '));
  let best = -1;
  let score = 0.6;
  keys.forEach((p, i) => {
    const words = p.split(' ').filter(Boolean);
    const r = words.length ? words.filter((w) => got.has(w)).length / words.length : 0;
    if (r >= score) {
      best = i;
      score = r + 1e-9;
    }
  });
  return best;
}

/**
 * Abdeckung tolerant (Prüfhinweis): Der Punkt wird ohne Satzzeichen und Groß/klein zugeordnet
 * („Cloud archive for small businesses."), dann über gemeinsame Wörter („GDPR-compliant data
 * retention"), sonst über die Stelle in der Liste (umformuliert).
 * Ausgegeben wird immer der gegebene Punkt.
 */
export function matchCoverage(raw: unknown, points: readonly string[]): unknown {
  if (!Array.isArray(raw)) return raw;
  const keys = points.map(loose);
  return (raw as unknown[]).map((x, i) => {
    const o = rec(x);
    if (!o || typeof o.point !== 'string') return x;
    const k = loose(o.point);
    let hit = keys.indexOf(k);
    if (hit < 0) hit = keys.findIndex((p) => p.length > 3 && k.length > 3 && (p.includes(k) || k.includes(p)));
    if (hit < 0) hit = bestOverlap(k, keys);
    if (hit < 0 && raw.length === points.length) hit = i;
    return hit >= 0 ? { ...o, point: points[hit] } : o;
  });
}

/** Kategorien der drei Schichten tolerant („grammar" → other, „preposition" → prepositions). */
function normalizeCats(raw: unknown): unknown {
  const o = rec(raw);
  if (!o || !Array.isArray(o.errors)) return raw;
  return { ...o, errors: (o.errors as unknown[]).map((e) => (rec(e) ? { ...(e as object), cat: topicCat((e as { cat?: unknown }).cat, ERROR_CATS) } : e)) };
}

export function pitchFeedbackSchema(v: PitchFeedbackVars): z.ZodType<PitchFeedbackOut> {
  const layers = threeLayersSchema({ sentence: clip(v.attempt, PF_ATTEMPT_MAX), focusWords: [], uiLang: v.uiLang, upgradedMax: PF_UPGRADED_MAX });
  const points = v.points.map((p) => p.trim().toLowerCase());
  const coverage = z.preprocess(
    (c) => matchCoverage(c, v.points.map((p) => p.trim())),
    z
      .array(z.object({ point: z.string().trim().min(1), covered: z.boolean(), note: z.string().trim().max(200) }).superRefine(langOf(['note'], v.uiLang)))
      .superRefine((list, ctx) => {
        list.forEach((c, i) => {
          if (!points.includes(c.point.trim().toLowerCase())) ctx.addIssue({ code: 'custom', path: [i, 'point'], message: 'point must be copied from the given points' });
        });
      }),
  );
  const cov = z.object({ coverage });
  // Zwei Schemas auf demselben Objekt: Abdeckung plus drei Schichten, alle Mängel gesammelt.
  return z.unknown().transform((raw, ctx): PitchFeedbackOut => {
    const a = cov.safeParse(raw);
    const b = layers.safeParse(normalizeCats(raw));
    for (const res of [a, b]) {
      if (!res.success) for (const i of res.error.issues) ctx.addIssue({ code: 'custom', path: i.path, message: i.message });
    }
    if (!a.success || !b.success) return z.NEVER;
    return { ...b.data, coverage: a.data.coverage };
  });
}

export function pitchFeedbackExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    coverage: [
      { point: 'Setup in one day', covered: true, note: '' },
      { point: 'GDPR-compliant retention', covered: false, note: de ? 'Die Aufbewahrung fehlt noch.' : 'Retention is still missing.' },
    ],
    verdict: 'minor',
    english: true,
    errors: [{ wrong: 'in one day installed', right: 'set up in one day', cat: 'word-order', why: de ? 'Im Englischen steht das Verb vor der Zeitangabe.' : 'In English the verb comes before the time phrase.' }],
    upgraded: 'Our archive is set up in one day, so your team can start right away.',
    changes: [{ from: 'in one day installed', to: 'set up in one day', why: de ? 'Natürliche Wortstellung.' : 'Natural word order.' }],
    lands: de ? 'Der Nutzen („start right away“) kommt direkt nach der Tatsache.' : 'The benefit ("start right away") follows the fact directly.',
    chunks: [{ en: 'start right away', de: 'sofort loslegen', def: 'begin immediately', kind: 'phrase', register: 'neutral', why: de ? 'Macht den Nutzen greifbar.' : 'Makes the benefit concrete.' }],
    targets: [],
  });
}

export const pitchFeedback: PromptTemplate<PitchFeedbackVars, PitchFeedbackOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You coach a German-speaking professional (B2, aiming for C1) who just practiced presenting one slide in English.',
      `Key points of the slide: ${v.points.map((p) => clip(p, 120)).join(' | ')}`,
      `Model script: ${clip(v.model, PF_MODEL_MAX)}`,
      `Learner attempt (this is the "learner sentence"): ${clip(v.attempt, PF_ATTEMPT_MAX)}`,
      `Explanation language (why, lands, note): ${langName(v.uiLang)}.`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      pitchFeedbackExample(v.uiLang),
      'Rules:',
      '- coverage: one entry per key point (copy the point exactly); covered = the attempt conveys it; note = what is missing or "".',
      ...threeLayersRules(v.uiLang),
      `- upgraded: the whole attempt as a confident C1 presenter would say it (max ${PF_UPGRADED_MAX} characters).`,
    ].join('\n');
  },
  schema: (v) => pitchFeedbackSchema(v),
};
