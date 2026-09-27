import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// weekly-report@2 (Plan §7.6): ein kurzer Wochenrückblick in Worten, NUR aus den Fakten der
// Woche (jeder Punkt nennt seine Fakt-Kennung). `default`, zwischengespeichert (die Fakten einer
// abgeschlossenen Woche ändern sich nicht); gespeichert in `app/weekly` (Kap. 10).

export type WeeklyVars = { lang: UiLang; week: string; facts: ReadonlyArray<{ id: string; text: string }> };
export type WeeklyOut = { headline: string; learned: Array<{ text: string; ref: string }>; next: string };

const ID = 'weekly-report';
const VERSION = 2;
export const WEEKLY_FACTS_MAX_BYTES = 6_000;

/** Die Fakten, die tatsächlich im Prompt stehen (≤ 6 KB). Nur auf sie darf `ref` verweisen (Befund H7). */
export function sentFacts(facts: WeeklyVars['facts']): Array<{ id: string; line: string }> {
  let used = 0;
  const out: Array<{ id: string; line: string }> = [];
  for (const f of facts) {
    const line = `[${f.id}] ${clip(f.text, 160)}`;
    used += new TextEncoder().encode(line).length + 1;
    if (used > WEEKLY_FACTS_MAX_BYTES) break;
    out.push({ id: f.id, line });
  }
  return out;
}

/**
 * Verweis tolerant (Prüfbefund W8): „[vw:v1]", „vw:v1, vw:v2" oder `refs: [...]` → die erste
 * gültige Fakt-Kennung. Ohne gültige Kennung bleibt der Wert stehen (und das Schema meldet ihn).
 */
export function cleanRef(item: unknown, ids: ReadonlySet<string>): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const o = item as Record<string, unknown>;
  const cands: unknown[] = [o.ref, ...(Array.isArray(o.refs) ? (o.refs as unknown[]) : [o.refs])];
  for (const c of cands) {
    if (typeof c !== 'string') continue;
    for (const part of c.split(/[,;\s]+/)) {
      const id = part.replace(/^[[(]+|[\])]+$/g, '').trim();
      if (ids.has(id)) return { ...o, ref: id };
    }
  }
  return o;
}

export function weeklySchema(v: Pick<WeeklyVars, 'lang' | 'facts'>): z.ZodType<WeeklyOut> {
  const ids = new Set(sentFacts(v.facts).map((f) => f.id));
  return z
    .object({
      headline: clipped(1, 90),
      learned: sliced(
        z.preprocess(
          (x) => cleanRef(x, ids),
          z
            .object({ text: clipped(1, 160), ref: z.string().refine((r) => ids.has(r), { message: 'ref must be one of the fact ids' }) })
            .superRefine(langOf(['text'], v.lang)),
        ),
        2,
        4,
      ),
      next: clipped(1, 160),
    })
    .superRefine(langOf(['headline', 'next'], v.lang));
}

export function weeklyExample(v: Pick<WeeklyVars, 'lang' | 'facts'>): WeeklyOut {
  const de = v.lang === 'de';
  const a = v.facts[0]?.id ?? 'x';
  const b = v.facts[1]?.id ?? a;
  return {
    headline: de ? 'Eine Woche mit spürbarem Fortschritt' : 'A week of noticeable progress',
    learned: [
      { text: de ? 'Diese Wörter sitzen jetzt auch nach mehreren Tagen noch.' : 'These words still stick after several days.', ref: a },
      { text: de ? 'Bei diesem Grammatikthema machst du deutlich weniger Fehler.' : 'You make clearly fewer mistakes in this grammar topic.', ref: b },
    ],
    next: de ? 'Nächste Woche lohnt sich ein kurzer Text mit den neuen Wendungen.' : 'Next week, a short text using the new phrases is worth it.',
  };
}

export const weeklyReport: PromptTemplate<WeeklyVars, WeeklyOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    const lines = sentFacts(v.facts).map((f) => f.line);
    return [
      header({ id: ID, version: VERSION }),
      'You write a short weekly review for a German-speaking professional learning English (B2 aiming for C1).',
      `Week: ${v.week}`,
      'Use ONLY these facts. Never invent results. Each learned item cites exactly one fact id in "ref".',
      ...lines,
      `Write everything in ${langName(v.lang)}: a headline (≤ 90 characters), 2–4 learned items (≤ 160 characters each) and one concrete next step (≤ 160 characters).`,
      'Calm, specific, no exclamation marks, no emojis.',
      'Reply with only one JSON object, no other text, exactly this shape:',
      JSON.stringify(weeklyExample(v)),
    ].join('\n');
  },
  schema: (v) => weeklySchema(v),
};
