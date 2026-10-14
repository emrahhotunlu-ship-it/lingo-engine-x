import { z } from 'zod';
import { sceneText } from '../content/activation/scenes';
import type { Brief } from '../domain/srs/brief';
import { clip, header, langName, langOf } from './common';
import { LEARNER_SENTENCE_MAX, MEANING_MAX, TARGET_MAX, looseBool, produceVerdict, type ProduceVerdict } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// produce-check@2 (Wörter aktivieren, Stufe 1; docs/umbau/aktivierung.md): prüft einen eigenen Satz mit dem Zielwort (Abfrageart „produce“,
// „Eigener Satz“). Gegenüber @1: Die Aufgabe nennt jetzt Lage, Satzform, Ton und Zeitform (`brief`), die Antwort hat drei Schichten
// (`why` = richtig/falsch, `better` = C1-Fassung, `whyBetter` = warum sie besser ist) und eine Fehlerklasse (`errType`) für „Fehler wiederholen“
// und das Radar. Nur der wichtigste Fehler wird erklärt. `quick`, ein Aufruf je Satz, nie automatisch wiederholt (A6.3: ein Neuversuch nur bei
// Schemaverletzung, mit angehängter Fehlerbeschreibung). `produce-check@1` bleibt als Datei erhalten (Hilfsfunktionen, Tests), wird nicht mehr aufgerufen.
// Britische Formen gelten als richtig, die US-Form kommt als Hinweis (A7.3).

export type ProduceErrType = 'prep' | 'false_friend' | 'word_order' | 'tense' | 'register' | 'collocation' | 'article' | 'other';
export const PRODUCE_ERR_TYPES: readonly ProduceErrType[] = ['prep', 'false_friend', 'word_order', 'tense', 'register', 'collocation', 'article', 'other'];

/** Vorgabe der Aufgabe, so wie der Prompt sie braucht (englische Beschreibungen, keine Kennungen). */
export type ProduceBriefVars = {
  /** Lage in einem englischen Satz (aus `content/activation/scenes`). */
  scene: string;
  form: 'statement' | 'question' | 'negation' | 'if-sentence';
  tone: 'casual' | 'neutral' | 'formal';
  /** `free` beim Wenn-Satz (die Bedingung bestimmt die Zeitform). */
  tense: 'present simple' | 'past simple' | 'present perfect' | 'future (will / going to)' | 'present continuous' | 'free';
};

export type ProduceCheckV2Vars = {
  target: string;
  meaning: string;
  sentence: string;
  uiLang: UiLang;
  kind: 'word' | 'phrase';
  brief?: ProduceBriefVars | null;
  /** Beschreibungen typischer Deutsch-Fehler, die die lokale Vorprüfung gefunden hat (englisch, ≤ 2). Claude prüft, ob sie wirklich zutreffen. */
  hints?: readonly string[];
};

export type ProduceCheckV2Out = {
  verdict: ProduceVerdict;
  usesTarget: boolean;
  fixed: string;
  why: string;
  better: string;
  whyBetter: string;
  errType: ProduceErrType | null;
};

const FORM_EN: Record<Brief['form'], ProduceBriefVars['form']> = { s: 'statement', q: 'question', n: 'negation', i: 'if-sentence' };
const TONE_EN: Record<Brief['tone'], ProduceBriefVars['tone']> = { c: 'casual', n: 'neutral', f: 'formal' };
const TENSE_EN: Record<Brief['tense'], ProduceBriefVars['tense']> = { pr: 'present simple', pa: 'past simple', pf: 'present perfect', fu: 'future (will / going to)', co: 'present continuous', '-': 'free' };

/** Vorgabe der Aufgabe (Kennungen) → Beschreibung für den Prompt; `null`, wenn die Lage unbekannt ist. */
export function briefVarsOf(b: Pick<Brief, 'scene' | 'form' | 'tone' | 'tense'>): ProduceBriefVars | null {
  const scene = sceneText(b.scene, 'en');
  return scene ? { scene, form: FORM_EN[b.form], tone: TONE_EN[b.tone], tense: TENSE_EN[b.tense] } : null;
}

export const HINT_MAX = 120;
/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const PRODUCE_CHECK_V2_EXAMPLE = '{"verdict":"minor","usesTarget":true,"fixed":"…","why":"…","better":"…","whyBetter":"…","errType":"prep"}';

const ID = 'produce-check';
const VERSION = 2;

const ERR_ALIASES: ReadonlyArray<[RegExp, ProduceErrType]> = [
  [/^(prep|preposition|prepositions|preposition[\s_-]?error)$/, 'prep'],
  [/^(false[\s_-]?friend|false[\s_-]?friends|faux[\s_-]?ami)$/, 'false_friend'],
  [/^(word[\s_-]?order|syntax)$/, 'word_order'],
  [/^(tense|tenses|verb[\s_-]?tense)$/, 'tense'],
  [/^(register|style|tone|formality)$/, 'register'],
  [/^(collocation|collocations|word[\s_-]?partner)$/, 'collocation'],
  [/^(article|articles|determiner)$/, 'article'],
];

/** Tolerant: „Preposition“, „word order“ → die acht Werte; Unbekanntes wird `other`; leer/null bleibt `null`. */
export function errTypeOf(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (!s || s === 'none' || s === 'null') return null;
  if ((PRODUCE_ERR_TYPES as readonly string[]).includes(s)) return s;
  for (const [re, out] of ERR_ALIASES) if (re.test(s)) return out;
  return 'other';
}

const schemaFor = (uiLang: UiLang): z.ZodType<ProduceCheckV2Out> =>
  z
    .object({
      verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
      usesTarget: z.preprocess(looseBool, z.boolean()),
      fixed: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
      why: clipped(1, 400),
      better: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
      whyBetter: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 300)),
      errType: z.preprocess(errTypeOf, z.enum(['prep', 'false_friend', 'word_order', 'tense', 'register', 'collocation', 'article', 'other']).nullable()),
    })
    // Fehlerklasse: bei „richtig“ keine; fehlt sie trotz Fehler, gilt `other` (kein Neuversuch wegen eines Nebenfelds).
    .transform((v) => ({ ...v, errType: v.verdict === 'correct' ? null : (v.errType ?? ('other' as const)) }))
    .superRefine((v, ctx) => {
      if (v.verdict !== 'correct' && !v.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected sentence' });
      // Keine Widersprüche (Kap. 2): „richtig“ setzt voraus, dass das Zielwort vorkommt.
      if (v.verdict !== 'wrong' && !v.usesTarget) ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must be "wrong" when usesTarget is false' });
      // Dritte Schicht: eine C1-Fassung braucht ihre Begründung; ohne Fassung gibt es keine.
      if (v.better.trim() && !v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['whyBetter'], message: 'whyBetter must explain why "better" is better' });
      if (!v.better.trim() && v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['better'], message: 'better must contain the C1 version when whyBetter is given' });
    })
    .superRefine(langOf(['why', 'whyBetter'], uiLang));

export const produceCheckV2: PromptTemplate<ProduceCheckV2Vars, ProduceCheckV2Out> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: true,
  build(vars) {
    const label = vars.kind === 'phrase' ? 'phrase' : 'word';
    const b = vars.brief;
    return [
      header({ id: ID, version: VERSION }),
      'You check one sentence written by a German-speaking learner (B2, aiming for C1).',
      'American English is the standard; British spelling and British words count as correct',
      '(then mention the US form in "why" as a tip, never as an error).',
      `Target ${label}: ${clip(vars.target, TARGET_MAX)} (meaning: ${clip(vars.meaning, MEANING_MAX)})`,
      `Learner sentence: ${clip(vars.sentence, LEARNER_SENTENCE_MAX)}`,
      ...(b
        ? [
            `Assignment: situation: ${clip(b.scene, 160)} | form: ${b.form} | tone: ${b.tone} | tense: ${b.tense}`,
            '(The learner saw exactly this assignment. A sentence that ignores form, tone or tense is at most "minor"; say so in "why".)',
          ]
        : []),
      ...(vars.hints?.length ? [`Local check found possible typical German-speaker errors (confirm only if really present): ${vars.hints.map((h) => clip(h, HINT_MAX)).join(' | ')}`] : []),
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object:',
      PRODUCE_CHECK_V2_EXAMPLE,
      'Rules:',
      '- verdict: "correct" = grammatical, natural, target used correctly; "minor" = target used correctly',
      '  but a small error or slightly unnatural wording elsewhere; "wrong" = target missing or misused,',
      '  or the sentence is ungrammatical.',
      '- usesTarget: true if the target (any inflected form) is used with the right meaning.',
      '- fixed: the sentence corrected with minimal changes (identical if nothing to fix).',
      '- why (layer 1, right or wrong): one or two sentences in the explanation language about the single most important error and why it is one.',
      '  Never list several errors. Always explain, also when correct (then say what works well).',
      '- better (layer 2): a more natural C1 version of the learner sentence, in English, or "" if the sentence is already C1.',
      '- whyBetter (layer 3): one sentence in the explanation language: why the C1 version is better. "" if better is "".',
      '- errType: the class of the most important error: prep | false_friend | word_order | tense | register | collocation | article | other. null if verdict is "correct".',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars.uiLang),
};
