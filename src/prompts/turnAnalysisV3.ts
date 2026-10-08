import { z } from 'zod';
import { clip, header, watchLine } from './common';
import { threeLayersExample, threeLayersRules, threeLayersSchema, type ThreeLayersOut } from './threeLayers';
import type { TurnAnalysisVars } from './turnAnalysis';
import type { PromptTemplate } from './types';

// turn-analysis@3 (Lernplattform 3.0 P51, KI-Tutor T7): wie @2 (drei Schichten zu EINEM eigenen Satz im Rollenspiel, `complex`, im Hintergrund der
// Analysespur, zwischengespeichert), dazu drei Felder:
// - `errors[i].pat`: Kennung aus der Musterliste des AKTUELLEN Kapitels (≤ 30 im Prompt) oder `null`. Eine Kennung außerhalb der Liste wird still
//   entfernt (lieber kein Muster als ein falsches), sie ist kein Schemaverstoß.
// - `used`: Muster der Liste, die der Satz RICHTIG benutzt (Kapitelziel „2 × A, 1 × B“); nur Kennungen der Liste, höchstens 4.
// - `count`: Claudes zweite, unabhängige Fehlerzählung (K7: Mittelwert mit der Liste, `turnErrors`).
// Ein Neuversuch nach A6.3 nur bei Schemaverletzung der drei Schichten (das erledigt das KI-Tor genau einmal).

export type TurnAnalysisV3Vars = TurnAnalysisVars & {
  /** Muster des aktuellen Kapitels (≤ 30, Englisch); leer = kein Programm, dann gibt es kein `pat` und keine Treffer. */
  pats: ReadonlyArray<{ id: string; en: string }>;
};

export type TurnAnalysisV3Out = ThreeLayersOut;

// Grenzen so, dass der Prompt bei Höchstwerten unter 8 KB bleibt (Test `turnAnalysisV3.test.ts`): fester Teil ≈ 5 KB, 30 Musterzeilen ≤ 1,9 KB.
export const TA3_HISTORY_MAX = 220;
export const TA3_LINE_MAX = 180;
export const TA3_SENTENCE_MAX = 300;
export const TA3_GOAL_MAX = 160;
export const TA3_ROLE_MAX = 100;
export const TA3_FOCUS_MAX = 5;
export const TA3_WATCH_MAX = 160;
export const TA3_PATS_MAX = 30;
export const TA3_PAT_ID_MAX = 32;
export const TA3_PAT_NAME_MAX = 28;
export const TA3_USED_MAX = 4;
export const TA3_COUNT_MAX = 20;

const ID = 'turn-analysis';
const VERSION = 3;

export const TA3_EXAMPLE_EXTRA = '"used":[],"count":1';

const PAT_ID = /^[a-z0-9][a-z0-9._-]*$/;

/** Die Musterliste im Prompt: nur gültige, kurze Kennungen, höchstens 30. */
const ta3List = (v: Pick<TurnAnalysisV3Vars, 'pats'>) => v.pats.filter((p) => p.id.length <= TA3_PAT_ID_MAX && PAT_ID.test(p.id)).slice(0, TA3_PATS_MAX);

/** Die erlaubten Kennungen (genau die Liste im Prompt). */
export const ta3Ids = (v: Pick<TurnAnalysisV3Vars, 'pats'>): Set<string> => new Set(ta3List(v).map((p) => p.id));

function patLines(v: TurnAnalysisV3Vars): string {
  const list = ta3List(v);
  return list.length ? list.map((p) => `${p.id}: ${clip(p.en, TA3_PAT_NAME_MAX)}`).join('\n') : '(none)';
}

/** Beispielantwort der drei Schichten mit `pat`, `used` und `count`. */
function example(v: TurnAnalysisV3Vars): string {
  const base = JSON.parse(threeLayersExample(v.uiLang)) as { errors: Array<Record<string, unknown>> } & Record<string, unknown>;
  return JSON.stringify({ ...base, errors: base.errors.map((e) => ({ ...e, pat: null })), used: [], count: base.errors.length });
}

const toCount = (raw: unknown): number | null => {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(TA3_COUNT_MAX, Math.round(n)) : null;
};

/** zod-Schema: die drei Schichten wie @2 (Verstöße → der eine Neuversuch), dazu `pat`/`used` nur aus der Liste (sonst still entfernt) und `count`. */
export function turnAnalysisV3Schema(v: TurnAnalysisV3Vars): z.ZodType<TurnAnalysisV3Out> {
  const base = threeLayersSchema({ sentence: clip(v.sentence, TA3_SENTENCE_MAX), focusWords: v.focusWords, uiLang: v.uiLang });
  const ids = ta3Ids(v);
  return z.unknown().transform((raw, ctx): TurnAnalysisV3Out => {
    const r = base.safeParse(raw);
    if (!r.success) {
      for (const issue of r.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      return z.NEVER;
    }
    const o = (raw && typeof raw === 'object' ? raw : {}) as { errors?: unknown; used?: unknown; count?: unknown };
    const rawErrors = Array.isArray(o.errors) ? o.errors : [];
    // Die drei Schichten lassen die Reihenfolge der Fehler unverändert: `pat` gehört zum Fehler an derselben Stelle.
    const errors = r.data.errors.map((e, k) => {
      const p = (rawErrors[k] as { pat?: unknown } | undefined)?.pat;
      const pat = typeof p === 'string' ? p.trim() : '';
      return ids.has(pat) ? { ...e, pat } : e;
    });
    const used = r.data.english && Array.isArray(o.used) ? [...new Set(o.used.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter((x) => ids.has(x)))].slice(0, TA3_USED_MAX) : [];
    return { ...r.data, errors, used, count: r.data.english ? toCount(o.count) : null };
  });
}

export const turnAnalysisV3: PromptTemplate<TurnAnalysisV3Vars, TurnAnalysisV3Out> = {
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
      TA3_HISTORY_MAX,
    );
    return [
      header({ id: ID, version: VERSION }),
      'You coach a German-speaking business professional (B2, aiming for C1) during a spoken role-play.',
      'Analyze ONLY the learner sentence below. The other speaker never corrects; you do, afterwards. You only see text: never judge pronunciation.',
      `Learner goal: ${clip(v.goal, TA3_GOAL_MAX)}`,
      `Other speaker: ${clip(v.role, TA3_ROLE_MAX)}`,
      `Earlier exchanges: ${hist || '(none)'}`,
      `Other speaker just said: ${clip(v.personaLine, TA3_LINE_MAX)}`,
      `Learner sentence: ${clip(v.sentence, TA3_SENTENCE_MAX)}`,
      `Focus words: ${v.focusWords.slice(0, TA3_FOCUS_MAX).map((w) => clip(w, 24)).join(', ') || '(none)'}`,
      `Known recurring mistakes of this learner (pay special attention to these): ${clip(watchLine(v.watch), TA3_WATCH_MAX)}`,
      'Grammar patterns of the current chapter (id: name):',
      patLines(v),
      'Reply with only one JSON object, no other text, exactly this shape:',
      example(v),
      'Rules:',
      ...threeLayersRules(v.uiLang),
      'The sentence may come from speech recognition: missing punctuation, capitalization and obvious recognition slips (e.g. homophones like their/there) are not mistakes; do not list or count them.',
      '- Judge the sentence as spoken business English in this situation. Register, tone and style are feedback for "upgraded"/"changes", never mistakes in "count".',
      '- This is speech: contractions, ellipsis, short fragments ("Fair point."), sentences starting with And/But/So, fillers, and missing punctuation or capitalization are never errors and never count.',
      '- C1 toolkit: where it clearly helps, add ONE device (hedging, a discourse marker, or a cleft sentence; inversion only if it sounds natural in speech). Not every sentence needs one.',
      '- upgraded must sound like natural speech in a call or meeting: keep the learner\'s words where they already work, about the same length, contractions welcome, no written-only phrasing.',
      '- errors[].pat: the id from the list above ONLY if the mistake is clearly an instance of that pattern; when in doubt, or for word choice, spelling or style, null. Never an id that is not in the list.',
      `- used: ids from the list that the learner sentence itself uses correctly as a complete instance (not just a shared word), at most ${TA3_USED_MAX}, else []. Not the upgraded version.`,
      '- count: count the real grammar, word and meaning mistakes in the learner sentence again, independently of "errors". Register, tone, style, punctuation and C1 upgrades never count. A whole number.',
      '- Never invent facts about the learner\'s company.',
    ].join('\n');
  },
  schema: (v) => turnAnalysisV3Schema(v),
};
