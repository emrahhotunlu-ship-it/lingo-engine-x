import { z } from 'zod';
import type { GrammarTask } from '../domain/learn/types';
import { splitTransform } from '../domain/grammar/tasks';
import { clip, header } from './common';
import { cut } from './tolerant';
import type { PromptTemplate } from './types';

// solve-check@1 (Tutor-Engine v3 §6.3, E5, quick): ein zweiter, UNABHÄNGIGER Löser für neu erzeugte Aufgaben. Claude bekommt die Aufgabe OHNE Lösung
// (Satz mit Lücke, Grundform-Hinweis, Auswahl, Ziel) und nennt alle Antworten, die ein sorgfältiger Muttersprachler gelten ließe. Die App nimmt eine
// Aufgabe nur an, wenn die Lösung darunter ist und jede weitere Antwort durch Lösung/`accepted`/`alt` gedeckt ist (`acceptGrammarItem`, Regel 6).
// Kein Lernwert, nie zwischengespeichert, Hintergrund mit Tagesdeckel. Tolerant: zu lange Listen werden gekappt, unbekannte Indizes fallen weg – ein
// Neuversuch nur bei einem Schemafehler, der sich nicht kappen lässt (A6.3). Die Anführungszeichen-Regel hängt das KI-Tor an.

export type SolveCheckTask = Pick<GrammarTask, 'type' | 'prompt' | 'options' | 'hint' | 'goal'>;
export type SolveCheckVars = { tasks: readonly SolveCheckTask[] };
export type SolveCheckItem = { i: number; answers: string[]; ambiguous: boolean; why: { de: string; en: string } };
export type SolveCheckOut = { results: SolveCheckItem[] };

/** Höchstens so viele Aufgaben je Anfrage; je Aufgabe höchstens `TASK_MAX_BYTES` Eingabe (§6.3: ≤ 600 B). */
export const SOLVE_CHECK_MAX_TASKS = 6;
export const TASK_MAX_BYTES = 600;
export const SOLVE_ANSWERS_MAX = 6;
export const SOLVE_CHECK_BG_PER_DAY = 2;

export const SOLVE_CHECK_EXAMPLE =
  '{"results":[{"i":0,"answers":["was signed"],"ambiguous":false,"why":{"de":"„yesterday“ verlangt Past Simple, und der Vertrag handelt nicht selbst: Passiv.","en":"“yesterday” needs the past simple, and the contract does not act itself: passive."}},{"i":1,"answers":["has worked","has been working"],"ambiguous":false,"why":{"de":"Mit „since 2020“ passen beide Formen des Present Perfect.","en":"With “since 2020” both present perfect forms fit."}},' +
  '{"i":2,"answers":["met","have met","are meeting","will meet"],"ambiguous":true,"why":{"de":"Ohne Zeitangabe passen mehrere Zeitformen.","en":"Without a time expression, several tenses fit."}}]}';

const ID = 'solve-check';
const VERSION = 1;

const bytes = (s: string): number => new TextEncoder().encode(s).length;

/** Eine Aufgabe als Zeile ohne Lösung, höchstens 600 Byte. */
export function taskLine(t: SolveCheckTask, i: number): string {
  const parts: string[] = [`#${i}`, `type=${t.type}`];
  if (t.type === 'transform') {
    const { from, target } = splitTransform(t.prompt);
    parts.push(`source=${clip(from, 200)}`, `target=${clip(target, 200)}`);
  } else parts.push(`sentence=${clip(t.prompt, 300)}`);
  if (t.hint) parts.push(`hint=${clip(t.hint, 60)}`);
  if (t.options?.length) parts.push(`options=${t.options.map((o) => clip(o, 60)).join(' / ')}`);
  if (t.goal?.en) parts.push(`goal=${clip(t.goal.en, 200)}`);
  let line = parts.join(' | ');
  while (bytes(line) > TASK_MAX_BYTES) line = cut(line, Array.from(line).length - 20);
  return line;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Tolerant: `{results}` oder ein nacktes Array; `answers` als Text → Liste; gekappt auf 6. */
function looseResults(v: unknown): unknown {
  const list: unknown = Array.isArray(v) ? v : isObj(v) ? (v.results ?? v.items) : v;
  if (!Array.isArray(list)) return list;
  return (list as unknown[]).map((r: unknown): unknown => {
    if (!isObj(r)) return r;
    const a = typeof r.answers === 'string' ? [r.answers] : r.answers;
    return { ...r, answers: Array.isArray(a) ? a.map(str).filter(Boolean).slice(0, SOLVE_ANSWERS_MAX) : a };
  });
}

const why = z
  .object({ de: z.string().trim().max(400), en: z.string().trim().max(400) })
  .transform((b) => ({ de: cut(b.de, 240), en: cut(b.en, 240) }))
  .catch({ de: '', en: '' });

const schemaFor = (v: SolveCheckVars): z.ZodType<SolveCheckOut> => {
  const n = Math.min(v.tasks.length, SOLVE_CHECK_MAX_TASKS);
  const item = z.object({ i: z.number().int(), answers: z.array(z.string().min(1).max(200)).max(SOLVE_ANSWERS_MAX), ambiguous: z.boolean().catch(true), why });
  return z.preprocess(looseResults, z.array(z.unknown())).transform((arr, ctx): SolveCheckOut => {
    const seen = new Set<number>();
    const results: SolveCheckItem[] = [];
    for (const raw of arr) {
      const r = item.safeParse(raw);
      // Unbekannte oder doppelte Indizes und kaputte Einträge fallen weg (kappen statt neu fragen).
      if (!r.success || r.data.i < 0 || r.data.i >= n || seen.has(r.data.i)) continue;
      seen.add(r.data.i);
      results.push(r.data);
    }
    if (!results.length && n > 0) {
      ctx.addIssue({ code: 'custom', message: `reply with one result per task, "i" from 0 to ${n - 1}, "answers" as a list of strings` });
      return z.NEVER;
    }
    return { results: results.sort((a, b) => a.i - b.i) };
  });
};

export const solveCheck: PromptTemplate<SolveCheckVars, SolveCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: false,
  budget: { bgPerDay: SOLVE_CHECK_BG_PER_DAY },
  build(v) {
    const tasks = v.tasks.slice(0, SOLVE_CHECK_MAX_TASKS);
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced C1 English teacher. Solve each grammar task below WITHOUT any answer key.',
      'American English is the standard, but British forms and spellings are also correct. Style is not an error.',
      'For each task list EVERY answer a careful native speaker would accept for the gap (or the whole corrected sentence for type=correct), max 6:',
      'other tenses, contractions, word order and synonyms that fit grammatically and in meaning. The listed answers are examples, not exhaustive.',
      'type=mc: choose only among the options. type=transform: the target sentence must keep the meaning of the source.',
      'Set "ambiguous" to true if more than one clearly different answer fits or the task cannot be solved from what is given.',
      '"why": one short sentence in German (de) and English (en): the signal that decides the answer. Put English words in “…”.',
      'Tasks:',
      ...tasks.map((t, i) => taskLine(t, i)),
      'Reply with only one JSON object of this shape:',
      SOLVE_CHECK_EXAMPLE,
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
