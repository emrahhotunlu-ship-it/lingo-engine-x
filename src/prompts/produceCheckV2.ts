import { z } from 'zod';
import { sceneText } from '../content/activation/scenes';
import type { Brief } from '../domain/srs/brief';
import { containsPhrase } from '../domain/chunks/newChunk';
import { locateChunk } from '../domain/srs/chunkCards';
import { locate } from '../domain/srs/context';
import { clip, header, langName, langOf } from './common';
import { LEARNER_SENTENCE_MAX, MEANING_MAX, TARGET_MAX, looseBool, produceVerdict, type ProduceVerdict } from './produceCheck';
import { correctionRules, withFixedGate } from './fixedGate';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// produce-check@2 (Wörter aktivieren, Stufe 1; docs/umbau/aktivierung.md): prüft einen eigenen Satz mit dem Zielwort (Abfrageart „produce“,
// „Eigener Satz“). Gegenüber @1: Die Aufgabe nennt jetzt Lage, Satzform, Ton und Zeitform (`brief`), die Antwort hat drei Schichten
// (`why` = richtig/falsch, `better` = C1-Fassung, `whyBetter` = warum sie besser ist) und eine Fehlerklasse (`errType`) für „Fehler wiederholen“
// und das Radar. Nur der wichtigste Fehler wird erklärt. `quick`, ein Aufruf je Satz, nie automatisch wiederholt (A6.3: ein Neuversuch nur bei
// Schemaverletzung, mit angehängter Fehlerbeschreibung). `produce-check@1` bleibt als Datei erhalten (Hilfsfunktionen, Tests), wird nicht mehr aufgerufen.
// Britische Formen gelten als richtig, die US-Form kommt als Hinweis (A7.3).

// `word_choice` (falsches Wort bei richtiger Bedeutungsrichtung) kam mit Stufe 2 dazu; produce-check@2 nennt es im Prompt nicht, liest es aber.
export type ProduceErrType = 'prep' | 'false_friend' | 'word_order' | 'tense' | 'register' | 'collocation' | 'article' | 'word_choice' | 'other';
export const PRODUCE_ERR_TYPES: readonly ProduceErrType[] = ['prep', 'false_friend', 'word_order', 'tense', 'register', 'collocation', 'article', 'word_choice', 'other'];

/** Vorgabe der Aufgabe, so wie der Prompt sie braucht (englische Beschreibungen, keine Kennungen). */
export type ProduceBriefVars = {
  /** Lage in einem englischen Satz (aus `content/activation/scenes`). */
  scene: string;
  form: 'statement' | 'question' | 'negation' | 'if-sentence';
  /** `free` = keine Vorgabe (die ersten Aktivierungen einer Karte). */
  tone: 'casual' | 'neutral' | 'formal' | 'free';
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
  /** Die korrigierte Fassung hat die Selbstprüfung nicht bestanden (oder fehlt): `fixed` ist leer, die App zeigt „noch nicht sicher geprüft“. */
  fixedUnsure?: boolean;
};

const FORM_EN: Record<Brief['form'], ProduceBriefVars['form']> = { s: 'statement', q: 'question', n: 'negation', i: 'if-sentence' };
const TONE_EN: Record<Brief['tone'], ProduceBriefVars['tone']> = { c: 'casual', n: 'neutral', f: 'formal', '-': 'free' };
const TENSE_EN: Record<Brief['tense'], ProduceBriefVars['tense']> = { pr: 'present simple', pa: 'past simple', pf: 'present perfect', fu: 'future (will / going to)', co: 'present continuous', '-': 'free' };

/** Vorgabe der Aufgabe (Kennungen) → Beschreibung für den Prompt; `null`, wenn die Lage unbekannt ist. */
export function briefVarsOf(b: Pick<Brief, 'scene' | 'form' | 'tone' | 'tense'>): ProduceBriefVars | null {
  const scene = sceneText(b.scene, 'en');
  return scene ? { scene, form: FORM_EN[b.form], tone: TONE_EN[b.tone], tense: TENSE_EN[b.tense] } : null;
}

export const HINT_MAX = 160;
/** C1-Fassung: höchstens so viele Wörter (am Handy lesbar, bleibt nah am Satz des Lernenden). */
export const BETTER_MAX_WORDS = 25;

/** Steht das Zielwort (gebeugt) bzw. die Wendung (auch getrennt) im Satz? */
const hasTarget = (sentence: string, target: string): boolean => {
  const t = target.trim();
  if (!t) return true;
  if (locate(sentence, t) || containsPhrase(sentence, t) || locateChunk(sentence, t)) return true;
  const parts = t.split(/\s+/);
  return parts.length >= 2 && !!locateChunk(sentence, `${parts[0]} sth ${parts.slice(1).join(' ')}`);
};
/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const PRODUCE_CHECK_V2_EXAMPLE = '{"verdict":"minor","usesTarget":true,"fixed":"…","why":"…","better":"","whyBetter":"","errType":"prep"}';

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
  [/^(word[\s_-]?choice|lexical|lexis|wrong[\s_-]?word|vocabulary)$/, 'word_choice'],
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

const schemaFor = (uiLang: UiLang, target = '', lenient = false): z.ZodType<ProduceCheckV2Out> =>
  withFixedGate<ProduceCheckV2Out>(
  z
    .object({
      verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
      usesTarget: z.preprocess(looseBool, z.boolean()),
      fixed: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
      why: clipped(1, 400),
      better: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
      whyBetter: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 300)),
      errType: z.preprocess(errTypeOf, z.enum(['prep', 'false_friend', 'word_order', 'tense', 'register', 'collocation', 'article', 'word_choice', 'other']).nullable()),
    })
    // Fehlerklasse: bei „richtig“ keine; fehlt sie trotz Fehler, gilt `other` (kein Neuversuch wegen eines Nebenfelds).
    .transform((v) => ({ ...v, errType: v.verdict === 'correct' ? null : (v.errType ?? ('other' as const)) }))
    .superRefine((v, ctx) => {
      // Keine Widersprüche (Kap. 2): „richtig“ setzt voraus, dass das Zielwort vorkommt.
      if (v.verdict !== 'wrong' && !v.usesTarget) ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must be "wrong" when usesTarget is false' });
      // Dritte Schicht: eine C1-Fassung braucht ihre Begründung; ohne Fassung gibt es keine.
      if (v.better.trim() && !v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['whyBetter'], message: 'whyBetter must explain why "better" is better' });
      if (!v.better.trim() && v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['better'], message: 'better must contain the C1 version when whyBetter is given' });
      // Die C1-Fassung behält das Zielwort (sonst übt Emrah, es zu umgehen) und bleibt kurz.
      if (v.better.trim() && !hasTarget(v.better, target)) ctx.addIssue({ code: 'custom', path: ['better'], message: 'better must keep the target word or phrase' });
      if (v.better.trim().split(/\s+/).length > BETTER_MAX_WORDS) ctx.addIssue({ code: 'custom', path: ['better'], message: `better must have at most ${BETTER_MAX_WORDS} words` });
    })
    .superRefine(langOf(['why', 'whyBetter'], uiLang)),
  { needs: (o) => o.verdict !== 'correct', lenient },
  );

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
            '(The learner saw exactly this assignment; "free" means no requirement. Ignoring the assignment alone never lowers "correct" to "minor": mention it in "why".',
            ' If the assignment makes the target sound unnatural, do not penalize that; say so in "why".)',
          ]
        : []),
      ...(vars.hints?.length ? [`Local check found possible typical German-speaker errors (confirm only if really present): ${vars.hints.map((h) => clip(h, HINT_MAX)).join(' | ')}`] : []),
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object:',
      PRODUCE_CHECK_V2_EXAMPLE,
      'Rules:',
      '- verdict: "correct" = target used correctly and the sentence has no real error; "minor" = target used correctly',
      '  but a grammar error or unnatural wording elsewhere (the learner is practicing the target, not the rest);',
      '  "wrong" ONLY if the target is missing, misused or has the wrong meaning. Any other error, or ignoring the assignment, is "minor", never "wrong".',
      '- Tone: casual = chat with a colleague, contractions fine; neutral = standard business email; formal = client or executive, polite and precise,',
      '  modern US business style (no "hereby", no "kindly do the needful").',
      '- Tense: if the assigned tense is unnatural with the target (e.g. stative verbs in the continuous), accept a natural tense and do not lower the verdict.',
      '  Future = any natural future form (will, going to, present continuous for arrangements). For "if-sentence", a real condition is required;',
      '  "if" meaning "whether" does not count.',
      '- Ignore capitalization, missing final punctuation and obvious phone typos unless they change meaning; on their own they never make the verdict worse than "correct".',
      '- In fixed and better, do not add facts, numbers, names or content that the learner did not write. fixed keeps the target.',
      '- usesTarget: true if the target (any inflected form; a separable phrasal verb may be split, e.g. "follow it up") is used with the right meaning.',
      '- fixed: the sentence corrected with minimal changes (identical if nothing to fix).',
      ...correctionRules(),
      '- why (layer 1, right or wrong): one or two sentences in the explanation language about the single most important error and why it is one.',
      '  Priority: target misused > error that changes meaning > typical German-speaker error > register > style. Never list several errors.',
      '  Always explain, also when correct: then name the specific thing that works (e.g. the collocation or the hedge), no generic praise.',
      '  Quote English words in "…" inside the explanation; never translate the learner sentence.',
      `- better (layer 2): only if a C1 speaker would really say it differently (collocation, register, precision, hedging, natural word order); never just a synonym or taste.`,
      `  Keep the learner's meaning, the target word or phrase (any form) and the assigned form, tone and tense; at most ${BETTER_MAX_WORDS} words, in English. Otherwise "".`,
      '- whyBetter (layer 3): one sentence in the explanation language: why the C1 version is better. "" if better is "".',
      '- errType: the class of the most important error: prep | false_friend | word_order | tense | register | collocation | article | other. null if verdict is "correct".',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars.uiLang, vars.target),
  lenient: (vars) => schemaFor(vars.uiLang, vars.target, true),
};
