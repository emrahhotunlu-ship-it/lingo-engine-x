import { z } from 'zod';
import { clip, clipped, header, langName, type PromptTemplate, type UiLang } from '../shared';
import { checkLang, EXAMPLE_MAX, looseBool, MEANING_MAX, WHY_MAX, WORD_MAX } from './common';

// vocab-meaning@1 (Großpaket A Schritt 5; plan.md §7): die zweite Meinung zu einer Antwort, die die lokale Prüfung nicht anerkannt hat – nur auf Antippen
// („War das auch richtig?“), nie automatisch. Zwei Fälle:
//  - `meaning`: Bedeutung frei nennen (Verstehen-Spur): trifft die eigene Erklärung den Sinn des Worts in DIESEM Satz? Wortlaut und Rechtschreibung zählen nicht.
//  - `gap`: anderes Wort in der Lücke: `same` gleichwertig (gleiches Wort, andere gültige Form) · `synonym` passt, ist aber ein anderes Wort ·
//    `simpler` passt, ist aber einfacher/allgemeiner · `no` passt nicht. Die App wertet nur `same` als Abruf; `synonym`/`simpler` bekommen keine Note
//    und eine Wiederholung (domain/apply.ts). Beim freien Nennen gibt es nur `same`/`no` (abgeleitet aus `ok`).
// `quick`, 24 h zwischengespeichert (gleiche Eingabe, gleiches Urteil). Ein Neuversuch nur bei Schemaverletzung (A6.3).

export type MeaningMode = 'meaning' | 'gap';

export type MeaningVars = {
  mode: MeaningMode;
  /** Stichwort (Englisch). */
  word: string;
  /** Gelernte Bedeutung in der Oberflächensprache. */
  meaning: string;
  /** Satz der Karte (bei `gap` mit der Lücke als „___“). */
  sentence: string;
  given: string;
  uiLang: UiLang;
};

export type MeaningKind = 'same' | 'synonym' | 'simpler' | 'no';
export const MEANING_KINDS: readonly MeaningKind[] = ['same', 'synonym', 'simpler', 'no'];

/** `ok` = zählt als Abruf (nur `same`); `synonym`/`simpler` passen, zählen aber nicht. */
export type MeaningOut = { ok: boolean; kind: MeaningKind; why: string };

export const GIVEN_MAX = 120;
export const MEANING_EXAMPLE = '{"ok":true,"why":"…"}';
export const GAP_EXAMPLE = '{"kind":"synonym","why":"…"}';

const ID = 'vocab-meaning';
const VERSION = 1;

const kindOf = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (/^(same|equal|equivalent|identical|yes|ok)$/.test(s)) return 'same';
  if (/^(synonym|similar|alternative)$/.test(s)) return 'synonym';
  if (/^(simpler|simple|general|broader|basic)$/.test(s)) return 'simpler';
  if (/^(no|wrong|different|false)$/.test(s)) return 'no';
  return v;
};

const schemaFor = (v: MeaningVars): z.ZodType<MeaningOut> =>
  v.mode === 'gap'
    ? z
        .object({ kind: z.preprocess(kindOf, z.enum(MEANING_KINDS as unknown as [MeaningKind, ...MeaningKind[]])), why: clipped(1, WHY_MAX) })
        .superRefine((o, ctx) => checkLang(o.why, v.uiLang, ['why'], ctx))
        .transform((o): MeaningOut => ({ ok: o.kind === 'same', kind: o.kind, why: o.why }))
    : z
        .object({ ok: z.preprocess(looseBool, z.boolean()), why: clipped(1, WHY_MAX) })
        .superRefine((o, ctx) => checkLang(o.why, v.uiLang, ['why'], ctx))
        .transform((o): MeaningOut => ({ ok: o.ok, kind: o.ok ? 'same' : 'no', why: o.why }));

export const meaning: PromptTemplate<MeaningVars, MeaningOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const task =
      v.mode === 'meaning'
        ? [
            'A German-speaking learner (B2, aiming for C1, business English) was asked what the English word means in this sentence and answered in their own words. Decide whether the answer captures the meaning in this sentence.',
            'Wording, spelling, grammar and word class of the answer do not matter. Accept every translation a good translator could use here, even if it is a little broader, and every correct paraphrase or explanation. Reject only a different meaning, a meaning that fits the word in general but not in this sentence, or something too vague to show the meaning ("etwas machen", "something good").',
          ]
        : [
            'A German-speaking learner (B2, aiming for C1, business English) typed a word in the gap that differs from the expected word. Decide how it fits in this sentence.',
            'kind: "same" = the expected word itself (another valid inflection or British spelling); any other word, however equivalent, is "synonym" if it is correct and natural here; "simpler" = correct here, but clearly more basic or general than the expected word; "no" = wrong here (different meaning, not natural, or ungrammatical).',
            'The answer must also fit the words around the gap (a/an, the preposition after it, singular/plural, tense). American English is the standard; British spelling and words count as correct.',
          ];
    return [
      header({ id: ID, version: VERSION }),
      ...task,
      `Word: ${clip(v.word, WORD_MAX)} (learned meaning: ${clip(v.meaning, MEANING_MAX)})`,
      `Sentence: ${clip(v.sentence, EXAMPLE_MAX)}`,
      `Learner answer: ${clip(v.given, GIVEN_MAX)}`,
      'The automatic check rejected this answer only because it differs from the expected one; accept every valid alternative.',
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      v.mode === 'gap' ? GAP_EXAMPLE : MEANING_EXAMPLE,
      v.mode === 'gap'
        ? '- why: one or two short sentences in the explanation language. same: why it fits. synonym or simpler: name how it differs from the expected word (meaning, register, partner words). no: say what the answer means and why it does not fit here. Quote English words in "…". No generic praise.'
        : '- why: one or two short sentences in the explanation language. If it fits, say why. If not, say what the word means here. Quote English words in "…". No generic praise.',
    ].join('\n');
  },
  schema: schemaFor,
};
