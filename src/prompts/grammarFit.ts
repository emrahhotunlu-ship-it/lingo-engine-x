import { z } from 'zod';
import { isPatternId, isUseId } from '../domain/tutor/tutorTypes';
import { clip, header, langName } from './common';
import { looseBool } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// grammar-fit@2 (Tutor-Engine v3 §6.3, Nachfolger von @1): „Ist diese Antwort im ganzen Satz auch richtig – und trifft sie das geübte Muster?“
// Genau ein Aufruf nach „Prüfen“ (automatisch nur mit `sampleConfirmed`, sonst Knopf „Claude fragen“) für eine lokal abgelehnte oder unklare
// Lücken-, Umformungs-, Schlüsselwort- oder Fehler-finden-Antwort. `quick`, 24 h zwischengespeichert, nie automatisch wiederholt (A6.3: nur ein
// Schemaverstoß, der sich nicht kappen lässt, darf einmal neu gefragt werden, das macht das KI-Tor). Zu lange Listen und unbekannte Kennungen werden
// gekappt statt neu gefragt. Angenommen wird nur `fits && certain`; `fits` mit einer Änderung vom Schweregrad `error` wird zu `certain:false`.
// Claude stuft nur hoch, nie herunter (§4.1 Nr. 4); Lernwerte bewegt Claude nie. Die Anführungszeichen-Regel hängt das KI-Tor an (QUOTE_RULE).

export type GrammarFitMode = 'gap' | 'find' | 'transform' | 'kwt';

export type GrammarFitVars = {
  topic: string;
  /** Name des geübten Musters (nur Kontext) oder `null`. */
  pattern: string | null;
  /** Kurzregel des Musters (Formel), höchstens 200 Zeichen, oder `null`. */
  rule?: string | null;
  /** `gap` Lücke, `find` markierte Stelle ersetzen, `transform` Umformung, `kwt` Schlüsselwort. Altname `replace` = `find`. */
  mode: GrammarFitMode | 'replace';
  /** Der Satz so, wie die Aufgabe ihn zeigt (Lücke `___` bzw. fehlerhafter Satz). */
  task: string;
  /** Ziel bzw. Bedingung der Aufgabe („Mach daraus einen Nebensatz“, Schlüsselwort), höchstens 200 Zeichen. */
  goal?: string | null;
  /** Der ganze Satz mit der Antwort des Lernenden. */
  sentence: string;
  /** Der ganze Satz mit der erwarteten Lösung. */
  expected: string;
  /** Weitere akzeptierte Antworten (Beispiele, nicht vollständig), höchstens 6. */
  accepted?: readonly string[];
  given: string;
  uiLang: UiLang;
};

export type FitBi = { de: string; en: string };
export type FitEdit = { from: string; to: string; sev: 'error' | 'upgrade' };
export type GrammarFitOut = {
  fits: boolean;
  certain: boolean;
  /** Trifft die Antwort das geübte Muster (z. B. „used to“)? Bei `false` ist sie nur „auch richtig“ (anderes Muster). */
  fitsGoal: boolean;
  why: FitBi;
  edits: FitEdit[];
  /** Gegenmuster, das die Antwort stattdessen zeigt (Muster- oder Gebrauchskennung), sonst `null`. */
  vs: string | null;
  /** Leitfrage für einen zweiten Versuch (ohne Lösung), sonst `null`. */
  retryHint: FitBi | null;
};

export const GRAMMAR_FIT_EXAMPLE =
  '{"fits":true,"certain":true,"fitsGoal":false,"why":{"de":"…","en":"…"},"edits":[],"vs":null,"retryHint":null}';

const ID = 'grammar-fit';
const VERSION = 2;
/** Prompt-Version für `fitAlt.pv`. */
export const GRAMMAR_FIT_PV = `${ID}@${VERSION}`;

const BiSchema = z.object({ de: clipped(1, 240), en: clipped(1, 240) });
const EditSchema = z.object({
  from: clipped(0, 80),
  to: clipped(0, 80),
  sev: z.preprocess((v) => (typeof v === 'string' && /^(error|major|wrong)$/i.test(v.trim()) ? 'error' : 'upgrade'), z.enum(['error', 'upgrade'])),
});
const RefSchema = z.string().refine((s) => isPatternId(s) || isUseId(s));

const schema: z.ZodType<GrammarFitOut> = z
  .object({
    fits: z.preprocess(looseBool, z.boolean()),
    certain: z.preprocess(looseBool, z.boolean()),
    fitsGoal: z.preprocess(looseBool, z.boolean()).catch(false),
    why: BiSchema,
    edits: z
      .array(EditSchema)
      .transform((a) => a.slice(0, 3))
      .catch([]),
    vs: RefSchema.nullable().catch(null),
    retryHint: BiSchema.nullable().catch(null),
  })
  // Nach dem Lesen (§6.3): „passt“, aber mit einer echten Fehlerkorrektur, ist nicht sicher.
  .transform((o) => (o.fits && o.certain && o.edits.some((e) => e.sev === 'error') ? { ...o, certain: false } : o));

const modeText: Record<GrammarFitMode, string> = {
  gap: 'fill the gap',
  find: 'find the mistake and replace only the marked part',
  transform: 'rewrite the sentence',
  kwt: 'complete the sentence with the key word',
};

export const grammarFit: PromptTemplate<GrammarFitVars, GrammarFitOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const mode: GrammarFitMode = v.mode === 'replace' ? 'find' : v.mode;
    const accepted = (v.accepted ?? []).slice(0, 6).map((a) => clip(a, 100));
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced C1 English teacher. A German-speaking learner (B2, aiming for C1) answered a grammar exercise differently from the expected answer.',
      'Decide whether the learner’s COMPLETE sentence is also correct, and whether it uses the practiced pattern.',
      'American English is the standard; British spelling and British forms count as correct. Correct minimally: style is never an error.',
      'The listed answers are examples, not exhaustive.',
      `Grammar topic: ${clip(v.topic, 80)}${v.pattern ? ` (practiced pattern: ${clip(v.pattern, 80)})` : ''}`,
      ...(v.rule ? [`Pattern rule: ${clip(v.rule, 200)}`] : []),
      `Exercise (${modeText[mode]}): ${clip(v.task, 300)}`,
      ...(v.goal ? [`Goal of the exercise: ${clip(v.goal, 200)}`] : []),
      `Expected sentence: ${clip(v.expected, 300)}`,
      ...(accepted.length ? [`Other accepted answers: ${accepted.join(' | ')}`] : []),
      `Learner sentence: ${clip(v.sentence, 300)}`,
      `Learner answer only: ${clip(v.given, 80)}`,
      `Explanation language: ${langName(v.uiLang)} (write "why" and "retryHint" in German AND English)`,
      'Reply with only one JSON object:',
      GRAMMAR_FIT_EXAMPLE,
      'Rules:',
      '- fits: true only if the learner sentence is fully grammatical AND natural in American English AND says what the context says (small shades of meaning, such as simple past instead of used to, are fine; a different time, person, number, polarity or fact is not).',
      '- certain: true only if you have no real doubt. If it is borderline, regional, stilted or depends on context you do not have, set certain to false.',
      '- fitsGoal: true only if the learner sentence uses the practiced pattern or meets the goal of the exercise (in another correct form). A correct sentence with a different structure has fitsGoal false.',
      '- Do not be generous: a wrong form, a missing or extra word, a wrong tense for the context or an unnatural collocation means fits is false.',
      '- why: {"de","en"}, one or two short sentences each: why it works (or what is wrong). Quote the learner words exactly.',
      '- edits: at most 3 minimal changes to the learner sentence, each {"from","to","sev"}; sev "error" for a real mistake, "upgrade" for style. Empty list if nothing must change.',
      '- vs: the id of the pattern the learner used instead (like "ut.past-simple"), or null if unsure.',
      '- retryHint: if fits is false, one guiding question {"de","en"} that does not give away the answer; otherwise null.',
    ].join('\n');
  },
  schema: () => schema,
};
