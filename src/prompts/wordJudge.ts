import { z } from 'zod';
import { clip, header, langName, langOf, shortenText } from './common';
import type { PromptTemplate, UiLang } from './types';

// word-judge@1 (docs/ki-paket-plan.md §3, Lehrer-Urteil P2/P3): Urteil über eine getippte Antwort
// im Vokabeltrainer, die die feste Prüfung (gleich, britisch, Tippfehler, Form, Paket) NICHT als
// richtig erkannt hat. Nur nach „Prüfen" (Handlung), `quick`, 24 h zwischengespeichert: dieselbe
// Antwort im selben Satz fragt nie zweimal. Ohne KI oder bei Fehler gilt die feste Prüfung.
//
// verdict:
// - correct: das Zielwort in einer Form, die hier ebenso richtig ist (zählt voll),
// - synonym: anderes Wort, passt hier in Bedeutung, Kollokation und Ton (fast richtig; die Karte kommt in
//   der Runde noch einmal im Ursprungssatz, damit das Zielwort selbst abgerufen wird),
// - form: Zielwort, aber falsche Form (fast richtig, mit Grammatikgrund),
// - wrong: passt nicht (falscher Freund, falsche Kollokation, anderes Wort).

export type WordJudgeVars = {
  target: string;
  pos: string;
  meaning: string;
  /** Satz mit `___` an der Stelle der Lücke; leer bei Abfragen ohne Satz. */
  sentence: string;
  /** Gesuchte Form (Lösung). */
  expected: string;
  given: string;
  task: 'gap' | 'translate' | 'situation';
  uiLang: UiLang;
};
export type WordJudgeVerdict = 'correct' | 'synonym' | 'form' | 'wrong';
export type WordJudgeOut = { verdict: WordJudgeVerdict; why: string; example: string; trap: boolean };

export const JUDGE_WHY_WORDS = 25;
const GIVEN_MAX = 80;

export const WORD_JUDGE_EXAMPLE = '{"verdict":"wrong","why":"…","example":"…","trap":true}';

const ID = 'word-judge';
const VERSION = 1;

const VERDICTS: ReadonlyArray<[RegExp, WordJudgeVerdict]> = [
  [/^(correct|right|ok|okay|acceptable|also[\s_-]?correct)$/, 'correct'],
  [/^(synonym|near[\s_-]?synonym|also[\s_-]?possible|fits)$/, 'synonym'],
  [/^(form|wrong[\s_-]?form|grammar|inflection)$/, 'form'],
  [/^(wrong|incorrect|false|error|no)$/, 'wrong'],
];

const verdictLoose = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  return VERDICTS.find(([re]) => re.test(s))?.[1] ?? s;
};

const schemaFor = (uiLang: UiLang): z.ZodType<WordJudgeOut> =>
  z
    .object({
      verdict: z.preprocess(verdictLoose, z.enum(['correct', 'synonym', 'form', 'wrong'])),
      why: z
        .string()
        .trim()
        .min(1)
        .transform((s) => shortenText(s, JUDGE_WHY_WORDS + 5, 320)),
      example: z
        .string()
        .nullish()
        .transform((s) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)),
      trap: z.preprocess((v) => v === true || v === 'true', z.boolean()),
    })
    .superRefine(langOf(['why'], uiLang));

export const wordJudge: PromptTemplate<WordJudgeVars, WordJudgeOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const taskLine =
      v.task === 'gap'
        ? 'Task: fill the gap (___) in the sentence with the target.'
        : v.task === 'translate'
          ? 'Task: give the English word for the meaning (no sentence).'
          : 'Task: say the target phrase in a business situation.';
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English teacher. Judge one answer of a German-speaking learner (B2, aiming for C1) in a vocabulary trainer.',
      'American English is the standard; British spelling and British words always count as correct.',
      taskLine,
      `Target: ${clip(v.target, 80)} (${clip(v.pos, 20) || 'unknown'})`,
      `Meaning: ${clip(v.meaning, 120) || '(unknown)'}`,
      `Sentence: ${clip(v.sentence, 260) || '(none)'}`,
      `Expected: ${clip(v.expected, 80)}`,
      `Learner answer: ${clip(v.given, GIVEN_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      WORD_JUDGE_EXAMPLE,
      'Rules:',
      '- Ignore capitalization and final punctuation.',
      '- verdict "correct": the answer is the target (or an equally correct form of it) and fits here.',
      '- verdict "synonym": a different word that fits here just as well in meaning, collocation and tone.',
      '- verdict "form": the target, but the wrong form for this sentence (tense, -ing, plural …).',
      '- verdict "wrong": anything else (wrong meaning, false friend, wrong collocation, wrong preposition).',
      `- why: ONE sentence, max ${JUDGE_WHY_WORDS} words, in the explanation language, addressed to the learner with "du" (German) or "you": for "wrong" say exactly what is wrong, name the German cause (false friend, literal translation) and the correct pattern; for "synonym" the difference to the target; for "form" the grammar reason; for "correct" why it works.`,
      '- example: one new natural English sentence (10–18 words) using the target correctly; empty string for "correct".',
      '- trap: true if the mistake is a typical German-speaker trap (false friend, make/do, since/for, become/get …).',
    ].join('\n');
  },
  schema: (v) => schemaFor(v.uiLang),
};
