import { z } from 'zod';
import { clip, header, langName, langOf } from '../../common';
import { clipped, intIn } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// goal-check@1 (Neubau N72, Speak/Yoodli): Ziel-Checkliste und Kriterien-Raster im Rollenspiel.
// Nach jeder Antwort der Figur (Handlung „Senden“) prüft `quick`, welche der höchstens 3 Ziele der
// Szene erreicht sind – mit wörtlichem Zitat aus den Sätzen des Lerners. Am Gesprächsende
// (`final: true`) zusätzlich die 3–5 Kriterien der Szene als Raster ✓ / teilweise / ✗ mit Zitat
// und einem Satz Begründung in der Oberflächensprache. Zwischengespeichert: gleicher Verlauf,
// gleiche Antwort. Die Anführungszeichen-Regel hängt das KI-Tor an (QUOTE_RULE).

export type GoalCheckVars = {
  /** Szenen-Ziele (Englisch, höchstens 3). */
  goals: readonly string[];
  /** Prüfbare Kriterien (Englisch, 0–5); nur mit `final`. */
  criteria: readonly string[];
  /** Verlauf: Figur und Lerner abwechselnd. */
  turns: ReadonlyArray<{ role: 'persona' | 'me'; text: string }>;
  /** Gesprächsende: Kriterien-Raster mit Begründung. */
  final: boolean;
  uiLang: UiLang;
};

export type GoalState = 'met' | 'partly' | 'open';
export type GoalMark = { i: number; state: GoalState; quote: string };
export type CriterionMark = { i: number; state: GoalState; quote: string; note: string };
export type GoalCheckOut = { goals: GoalMark[]; criteria: CriterionMark[] };

export const GC_TURN_MAX = 400;
export const GC_TRANSCRIPT_MAX = 6000;
export const GC_GOAL_MAX = 240;

const ID = 'goal-check';
const VERSION = 1;

export const GOAL_CHECK_EXAMPLE = '{"goals":[{"i":0,"state":"met","quote":"…"}],"criteria":[{"i":0,"state":"partly","quote":"…","note":"…"}]}';

/** Tolerant: `done`/`reached`/`yes` → met, `partial` → partly, `missed`/`no` → open. */
export function stateOf(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 'met' : 'open';
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (/^(met|done|reached|achieved|yes|true|✓)$/.test(s)) return 'met';
  if (/^(partly|partial|partially|some|half)$/.test(s)) return 'partly';
  if (/^(open|missed|no|false|not met|not yet|✗)$/.test(s)) return 'open';
  return s;
}

const state = z.preprocess(stateOf, z.enum(['met', 'partly', 'open']));
const text = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v : ''), clipped(0, max));

/** Verlauf als kompakte Zeilen; zu lang → die ältesten Zeilen fallen weg (das Ende bleibt immer). */
export function transcript(turns: GoalCheckVars['turns']): string {
  const lines = turns.map((t) => `${t.role === 'me' ? 'Learner' : 'Partner'}: ${clip(t.text, GC_TURN_MAX)}`);
  let out = lines.join('\n');
  while (out.length > GC_TRANSCRIPT_MAX && lines.length > 2) {
    lines.shift();
    out = lines.join('\n');
  }
  return out;
}

export const goalCheck: PromptTemplate<GoalCheckVars, GoalCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: true,
  build(v) {
    const goals = v.goals.slice(0, 3).map((g, i) => `${i}. ${clip(g, GC_GOAL_MAX)}`);
    const criteria = v.final ? v.criteria.slice(0, 5).map((c, i) => `${i}. ${clip(c, GC_GOAL_MAX)}`) : [];
    return [
      header({ id: ID, version: VERSION }),
      'You watch a spoken business role-play of a German-speaking learner (B2, aiming for C1) and tick off his goals.',
      'Judge ONLY what the learner actually said. Be fair but strict: a goal is "met" only if his own words clearly do it.',
      'Goals:',
      ...goals,
      ...(criteria.length ? ['Criteria:', ...criteria] : []),
      'Transcript:',
      transcript(v.turns),
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      GOAL_CHECK_EXAMPLE,
      'Rules:',
      '- goals: one entry per goal, i = its number. state: "met", "partly" or "open".',
      '- quote: the learner words (verbatim, at most 20 words) that show it; "" if the state is "open".',
      criteria.length
        ? '- criteria: one entry per criterion with state, quote and note (one short sentence in the explanation language: why).'
        : '- criteria: [] (empty list).',
    ].join('\n');
  },
  schema: (v) => {
    const nGoals = Math.min(3, v.goals.length);
    const nCrit = v.final ? Math.min(5, v.criteria.length) : 0;
    const goal = z.object({ i: intIn(0, Math.max(0, nGoals - 1)), state, quote: text(200) });
    const crit = z
      .object({ i: intIn(0, Math.max(0, nCrit - 1)), state, quote: text(200), note: text(240) })
      .superRefine(langOf(['note'], v.uiLang));
    return z.object({
      goals: z.preprocess((x) => (Array.isArray(x) ? x.slice(0, nGoals) : x), z.array(goal)),
      criteria: z.preprocess((x) => (nCrit === 0 ? [] : Array.isArray(x) ? x.slice(0, nCrit) : x), z.array(crit)),
    });
  },
};
