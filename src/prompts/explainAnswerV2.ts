import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { acceptExample, type ExplainExample, type ExplainOp, type NeighborRef } from '../domain/tutor/explainOps';
import { clip, header } from './common';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// explain-answer@2 (Lernplattform 3.0 P26, KI-Tutor T1): „Erklär mir meine Antwort“. Nur auf Antippen, `quick`, 24 h zwischengespeichert, nie
// automatisch wiederholt. Die App hat die Antwort schon bewertet (nicht richtig) und die Abweichung berechnet (`ops`, `alignWords`); Claude
// erklärt nur diese Stellen. Ausgabe: `yours` (was die eigene Form ausdrückt), `why` (Signalwort und Regel), `signal` (nur wörtlich im Satz),
// `confused` (nur aus der Kontrastfamilie), `alsoRight` (ändert nichts, bis Emrah „Ich lag richtig“ tippt), `example` (neuer Satz, formal geprüft;
// fällt still weg statt Neuversuch). Ein Neuversuch nach A6.3 nur, wenn `yours`/`why` fehlen oder in der falschen Sprache stehen.
// `explain-answer@1` (LP2 P2) bleibt als Datei erhalten, wird aber nicht mehr aufgerufen.

export type ExplainVars = {
  kind: 'grammar' | 'word';
  /** Übungssatz mit ___ bzw. Ganzsatz, ≤ 300 Zeichen. */
  task: string;
  /** Antwort des Lernenden, ≤ 160; leer bei „Weiß ich nicht“. */
  given: string;
  answer: string;
  accepted: readonly string[];
  /** Abweichungen aus `alignWords`, ≤ 6, gleiche Stellen weggelassen. */
  ops: readonly ExplainOp[];
  pattern: { id: string; name: string; form: string; signals: readonly string[]; trap: string } | null;
  /** Muster derselben Kontrastfamilie, ≤ 4. */
  neighbors: readonly NeighborRef[];
  word: { en: string; de: string; pos: string; other: { en: string; de: string } | null; falseFriend: string | null } | null;
  /** Berufsprofil-Zeile (nur für das Beispiel), ≤ 300. */
  ctx: string;
  uiLang: UiLang;
};

export type ExplainBi = { de: string; en: string };
export type ExplainOut = {
  /** `null` nur bei leerer Antwort. */
  yours: ExplainBi | null;
  why: ExplainBi;
  signal: string[];
  confused: string | null;
  alsoRight: boolean;
  example: ExplainExample | null;
};

export const EXPLAIN_TASK_MAX = 300;
export const EXPLAIN_GIVEN_MAX = 160;
export const EXPLAIN_EXAMPLE_JSON =
  '{"yours":{"de":"…","en":"…"},"why":{"de":"…","en":"…"},"signal":["…"],"confused":null,"alsoRight":false,"example":{"en":"…","de":"…"}}';

const ID = 'explain-answer';
const VERSION = 2;

/** Zweisprachiger Text; zu lange Texte werden gekürzt, die falsche Sprache löst den einen Neuversuch aus. */
const bi = (max: number) =>
  z
    .object({ de: clipped(8, max), en: clipped(8, max) })
    .superRefine((b, ctx) => {
      if (isWrongLang(b.de, 'de')) ctx.addIssue({ code: 'custom', path: ['de'], message: 'must be written in German' });
      if (isWrongLang(b.en, 'en')) ctx.addIssue({ code: 'custom', path: ['en'], message: 'must be written in English' });
    });

const looseBool = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === 'yes' ? true : s === 'false' || s === 'no' ? false : v;
};
const asList = (v: unknown): unknown => (typeof v === 'string' ? [v] : v);

export function explainSchema(v: ExplainVars): z.ZodType<ExplainOut> {
  const hay = `${v.task} ${v.answer}`.toLowerCase();
  const ids = new Set(v.neighbors.map((n) => n.id));
  return z
    .object({
      yours: z.preprocess((x) => (x === undefined ? null : x), bi(160).nullable()),
      why: bi(160),
      // Nur Signalwörter, die wörtlich im Satz (oder in der Lösung) stehen; alles andere fällt still weg.
      signal: z
        .preprocess((x) => (x === undefined || x === null ? [] : asList(x)), z.array(z.unknown()))
        .transform((xs) => xs.filter((s): s is string => typeof s === 'string' && s.trim().length > 0 && hay.includes(s.trim().toLowerCase())).map((s) => s.trim()).slice(0, 3)),
      // Nur Muster aus der Kontrastfamilie.
      confused: z.preprocess((x) => (typeof x === 'string' && ids.has(x) ? x : null), z.string().nullable()),
      alsoRight: z.preprocess((x) => looseBool(x ?? false), z.boolean()),
      // Fällt weg statt Neuversuch: britisch, gerade Anführungszeichen im Text, falsche Länge.
      example: z.unknown().transform((x) => acceptExample(x, v.task)),
    })
    .superRefine((o, ctx) => {
      if (v.given.trim() && !o.yours) ctx.addIssue({ code: 'custom', path: ['yours'], message: 'yours is required' });
    })
    .transform((o) => ({ ...o, yours: v.given.trim() ? o.yours : null }));
}

const line = (label: string, text: string): string => `${label}: ${text}`;

export const explainAnswerV2: PromptTemplate<ExplainVars, ExplainOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const ops = v.ops.length ? v.ops.map((o) => `${o.op}: learner "${clip(o.g, 40) || '(nothing)'}" → expected "${clip(o.e, 40) || '(nothing)'}"`).join('; ') : '(none)';
    const p = v.pattern;
    return [
      header({ id: ID, version: VERSION }),
      'You explain one wrong answer in an English exercise to a German-speaking learner (B2, aiming for C1, business English).',
      'The app has already graded this answer as NOT correct. Do not grade again; only set alsoRight to true if the learner answer is fully correct English for this exact task.',
      'Explain ONLY the listed changes (ops). Never mention other problems. American English is the standard.',
      line('Kind', v.kind),
      line('Task', clip(v.task, EXPLAIN_TASK_MAX)),
      line('Learner answer', clip(v.given, EXPLAIN_GIVEN_MAX) || '(none, the learner did not know)'),
      line('Correct answer', clip(v.answer, EXPLAIN_GIVEN_MAX)),
      v.accepted.length > 1 ? line('Also accepted', v.accepted.slice(0, 4).map((a) => clip(a, 80)).join(' | ')) : '',
      line('Changes (ops)', ops),
      p ? line('Pattern', `${clip(p.name, 100)} (${clip(p.form, 120)}); signals: ${p.signals.slice(0, 6).map((s) => clip(s, 30)).join(', ') || '-'}; typical error: ${clip(p.trap, 160)}`) : 'Pattern: (unknown)',
      v.neighbors.length ? line('Easily confused patterns (id: name)', v.neighbors.map((n) => `${n.id}: ${clip(n.name, 80)}`).join('; ')) : '',
      v.word
        ? line('Word', `${clip(v.word.en, 60)} = ${clip(v.word.de, 60)} (${clip(v.word.pos, 20)})${v.word.other ? `; the learner's answer is another word of theirs: ${clip(v.word.other.en, 60)} = ${clip(v.word.other.de, 60)}` : ''}${v.word.falseFriend ? `; false friend: ${clip(v.word.falseFriend, 100)}` : ''}`)
        : '',
      v.ctx ? line('Learner work context (only for the example)', clip(v.ctx, 300)) : '',
      'Reply with only one JSON object in exactly this shape:',
      EXPLAIN_EXAMPLE_JSON,
      'Rules:',
      '- yours: what the learner form expresses, or when it would be right (one sentence). null only if the learner gave no answer. why: the signal word in the sentence and the rule (one or two sentences, only if not already obvious).',
      '- yours and why are written in both languages: "de" in simple German, "en" in English; each at most 25 words. English terms inside German text go in „…“.',
      '- signal: up to 3 words copied exactly from the task sentence. Empty list if none.',
      '- confused: the id of ONE easily confused pattern from the list above if the learner mixed it up, otherwise null.',
      '- alsoRight: true only if the learner answer is fully correct English for this exact task, otherwise false.',
      '- example: ONE new sentence with the same pattern, 8 to 16 words, American English, from the learner work context, plus its German translation. Never reuse the task sentence.',
      '- Never invent grammar rules. Never use the straight double quote character inside text values.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: (v) => explainSchema(v),
};
