import { z } from 'zod';
import { clip, header, langName } from './common';
import type { PromptTemplate, UiLang } from './types';

// word-prep@1 (docs/ki-paket-plan.md §2, Lehrer-Urteil P1): Kartenpaket für mehrere Karten in EINEM
// Aufruf (sample.d.ts: „For a list of items prefer ONE call that returns a JSON array"). Je Karte vier
// Lückensätze (2 Beruf, 1 Alltag, 1 stärkste Kollokation) mit weiteren richtigen Formen, passenden
// Synonymen samt Unterschied und drei Ablenkern samt „warum nicht". `quick`, 24 h zwischengespeichert.
// Ausgelöst beim Start einer Runde (Handlung), im Hintergrund – niemand wartet darauf.
// Das Schema prüft nur die Hülle; jeder Satz wird einzeln in `domain/srs/pack.ts` geprüft
// (unbrauchbare fallen weg, statt die ganze Antwort zu verwerfen).

export type WordPrepCard = {
  word: string;
  pos: string;
  meaning: string;
  /** Ursprungssatz der Karte (wird nicht wiederholt). */
  sentence: string;
  /** Kollokationen der Karte (Text). */
  collocs: readonly string[];
  /** Frühere Paket-Sätze, die nicht wiederkommen sollen. */
  avoid: readonly string[];
  kind: 'word' | 'phrase';
};
export type WordPrepVars = { cards: readonly WordPrepCard[]; uiLang: UiLang };
export type WordPrepOut = { cards: Array<{ i: number; items: unknown[]; dis: unknown[]; cwhy: unknown }> };

export const PREP_BATCH_MAX = 8;
const WORD_MAX = 60;
const MEANING_MAX = 120;
const SENTENCE_MAX = 220;
const AVOID_MAX = 6;

export const WORD_PREP_EXAMPLE =
  '{"cards":[{"i":0,"cwhy":"…","items":[{"en":"We need reliable figures before we commit to the new rollout plan.","gap":"reliable","ok":[],"syn":[],"why":"…"}],"dis":[{"w":"reasonable","why":"…"}]}]}';

const ID = 'word-prep';
const VERSION = 1;

const cardOut = z.looseObject({
  cwhy: z.unknown().optional(),
  i: z.preprocess((v) => (typeof v === 'string' && v.trim() ? Number(v) : v), z.number().int().min(0)),
  items: z.array(z.unknown()).catch([]),
  dis: z.array(z.unknown()).catch([]),
});

const schema: z.ZodType<WordPrepOut> = z.object({
  cards: z.preprocess((v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : v), z.array(z.unknown()))
    .transform((arr) => arr.flatMap((x) => {
      const r = cardOut.safeParse(x);
      return r.success ? [{ i: r.data.i, items: r.data.items, dis: r.data.dis, cwhy: r.data.cwhy }] : [];
    }))
    .pipe(z.array(z.object({ i: z.number(), items: z.array(z.unknown()), dis: z.array(z.unknown()), cwhy: z.unknown() })).min(1)),
});

export const wordPrep: PromptTemplate<WordPrepVars, WordPrepOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const cards = v.cards.slice(0, PREP_BATCH_MAX).map((c, i) =>
      [
        `Card ${i}: ${clip(c.word, WORD_MAX)}`,
        `  Type: ${c.kind}; part of speech: ${clip(c.pos, 20) || '(unknown)'}`,
        `  Meaning: ${clip(c.meaning, MEANING_MAX) || '(unknown)'}`,
        `  Card sentence: ${clip(c.sentence, SENTENCE_MAX) || '(none)'}`,
        `  Collocations: ${c.collocs.map((x) => clip(x, 60)).filter(Boolean).join(' | ') || '(none)'}`,
        `  Do not reuse: ${c.avoid.slice(-AVOID_MAX).map((x) => clip(x, 160)).join(' | ') || '(nothing)'}`,
      ].join('\n'),
    );
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English teacher (CELTA/DELTA) preparing vocabulary practice for one German-speaking learner:',
      'head of business development at a German DMS/ECM cloud vendor, CEFR B2 aiming for C1. Invented names only, never facts about real companies.',
      'American English is the standard (US spelling and vocabulary).',
      `Explanation language: ${langName(v.uiLang)} (all "why" fields).`,
      '',
      ...cards,
      '',
      'Reply with only one JSON object, no other text, in this shape:',
      WORD_PREP_EXAMPLE,
      'Rules for every card (use its number as "i"):',
      '- items: exactly 4 new gap sentences, 10–20 words each: 2 from work (sales calls, objections, emails, meetings, projects), 1 from everyday life, 1 showing the strongest collocation.',
      '- Each sentence contains the target exactly once, with the same meaning as on the card; "gap" is the exact form as it appears in the sentence (inflected forms are fine; for a phrase, the whole phrase as it appears).',
      '- Write each sentence so that ONLY the target fits: include a collocate or pattern that rules out near-synonyms (a learner who knows the word fills the gap with certainty).',
      '- Do not reuse the card sentence or any sentence listed under "Do not reuse". No brackets, no quotes, no translations inside "en".',
      '- ok: other forms or spellings of the TARGET that are equally correct in this gap (often empty). Never other words.',
      '- syn: prefer sentences where syn is empty; list another word only if it unavoidably fits this gap in meaning, collocation and tone (max 2); "why" = the difference to the target in one short sentence.',
      '- why: one short sentence (max 20 words): why the target fits here – name the collocation or pattern (e.g. "persuade sb to do sth").',
      '- dis: exactly 3 distractors (base form, same part of speech) that are clearly wrong in all 4 sentences AND in the card sentence; at least one is a typical mistake of German speakers (false friend, make/do, become/get …); "why" = why it does not fit, one short sentence.',
      '- cwhy: one short sentence (max 20 words): why the target fits the card sentence – name the collocation or pattern; empty string if there is no card sentence.',
    ].join('\n');
  },
  schema: () => schema,
};
