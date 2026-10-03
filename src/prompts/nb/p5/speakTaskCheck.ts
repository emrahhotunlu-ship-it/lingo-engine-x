import { z } from 'zod';
import { clip, header, langName, langOf } from '../../common';
import { clipped, sliced } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// speak-task-check@1 (Neubau N79, B9 – Lehrer I7, I8, W10, S9): eine Rückmeldung für die kurzen
// Sprechaufgaben unter Sprechen › Training. Emrah hat laut gesprochen und dann getippt oder mit
// der Diktiertaste der Tastatur diktiert. Claude beurteilt die Aufgabe je Art:
// - `pitch`: Elevator Pitch in 30/60/120 s mit derselben Kernbotschaft,
// - `chart`: ein Diagramm in 60 s beschreiben (Trend, Vergleich, Folgerung),
// - `circum`: einen Fachbegriff umschreiben, ohne das Wort zu benutzen (würde ein Kunde verstehen?),
// - `back`: Rückübersetzung – eigene englische Fassung gegen den Originalsatz.
// Ausgabe wie alle Rückmeldungen: Urteil, Wirkung, ≤ 3 Korrekturen, bessere Fassung, ein Satz
// zum Kern der Aufgabe. `quick`: kurze Antwort, gleiche Eingabe → gleiche Antwort (Zwischenspeicher).

export type SpeakTaskKind = 'pitch' | 'chart' | 'circum' | 'back';

export type SpeakTaskCheckVars = {
  kind: SpeakTaskKind;
  /** Was der Lerner tun sollte (Englisch). */
  task: string;
  /** Bezug (Englisch): Kernbotschaft, Diagrammdaten, Zielwort oder Originalsatz. */
  ref: string;
  /** Musterfassung (Englisch) als Orientierung; darf leer sein. */
  model: string;
  /** Antwort des Lerners. */
  answer: string;
  /** Sprechzeit der Aufgabe in Sekunden (0 = ohne Zeitlimit). */
  seconds: number;
  uiLang: UiLang;
};

export type SpeakTaskFix = { mine: string; right: string; why: string };
export type SpeakTaskCheckOut = {
  verdict: 'ok' | 'close' | 'wrong';
  /** Kern der Aufgabe in einem Satz (z. B. „Ein Kunde würde es verstehen.“). */
  core: string;
  effect: string;
  fixes: SpeakTaskFix[];
  better: string;
};

export const STC_TEXT_MAX = 1600;
const ID = 'speak-task-check';
const VERSION = 1;

export const SPEAK_TASK_CHECK_EXAMPLE = '{"verdict":"close","core":"…","effect":"…","fixes":[{"mine":"…","right":"…","why":"…"}],"better":"…"}';

const GOAL: Record<SpeakTaskKind, string> = {
  pitch:
    'Task type: elevator pitch. core = does the pitch keep the same core message, have a clear structure (hook, problem, solution, proof, ask) and fit the time? Longer versions add examples and proof, not filler.',
  chart:
    'Task type: describe a chart in 60 seconds. core = did he state the overall trend, one comparison and a conclusion, with correct numbers? Useful phrases: more than doubled, leveled off, a fraction of, peaked at.',
  circum:
    'Task type: paraphrase a term without using it (self-repair while speaking). core = would a customer understand what he means, and did he avoid the target word? If he used the target word, verdict is "wrong".',
  back:
    'Task type: back-translation. He read the original English sentence, then saw only a German translation and wrote the English again. core = which differences change the meaning and which are only style? Different but correct wording is fine.',
};

const fix = z.object({ mine: clipped(1, 200), right: clipped(1, 200), why: clipped(1, 200) });

/** Tolerant: `good`/`correct` → ok, `partly`/`almost` → close, `bad`/`incorrect` → wrong. */
export function verdictOf(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 'ok' : 'wrong';
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (/^(ok|good|correct|clean|great|fine)$/.test(s)) return 'ok';
  if (/^(close|partly|partial|almost|minor)$/.test(s)) return 'close';
  if (/^(wrong|bad|incorrect|errors|missed)$/.test(s)) return 'wrong';
  return s;
}

export const speakTaskCheck: PromptTemplate<SpeakTaskCheckVars, SpeakTaskCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking salesperson (B2, aiming for C1) practices speaking English. He said his answer out loud, then typed or dictated it, so spoken style and small dictation slips are fine.',
      'American English is the standard; British spelling and British words are correct too.',
      GOAL[v.kind],
      `Task: ${clip(v.task, 400)}`,
      `Reference: ${clip(v.ref, 800)}`,
      ...(v.model ? [`Model (orientation only, he does not have to copy it): ${clip(v.model, STC_TEXT_MAX)}`] : []),
      ...(v.seconds > 0 ? [`Speaking time: ${v.seconds} seconds`] : []),
      `Learner answer: ${clip(v.answer, STC_TEXT_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      SPEAK_TASK_CHECK_EXAMPLE,
      'Rules:',
      '- verdict: "ok" (the task is done well), "close" (done, with gaps) or "wrong" (the task is missed).',
      '- core: one short sentence in the explanation language about the core of the task (see task type).',
      '- effect: one short sentence in the explanation language: how the answer sounds to a listener.',
      '- fixes: at most 3 real mistakes (grammar, word choice, German-English traps), most important first. mine = the exact words from the learner answer, right = the corrected words (English), why = one short reason in the explanation language. Empty list if there are none.',
      '- better: the learner answer rewritten as natural US business English, keeping his ideas and the length that fits the speaking time.',
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        verdict: z.preprocess(verdictOf, z.enum(['ok', 'close', 'wrong'])),
        core: clipped(1, 240),
        effect: clipped(1, 240),
        fixes: sliced(fix, 0, 3).catch([]),
        better: clipped(1, STC_TEXT_MAX),
      })
      .superRefine(langOf(['core', 'effect'], v.uiLang)),
};
