import { z } from 'zod';
import { eventById, mailById, roleById, typeById } from '../content/activation/pools';
import { containsPhrase } from '../domain/chunks/newChunk';
import { locateChunk } from '../domain/srs/chunkCards';
import { locate } from '../domain/srs/context';
import type { ActTask } from '../domain/srs/actTask';
import type { ActFmt } from '../domain/srs/actBrief';
import { clip, header, langName, langOf } from './common';
import { looseBool, produceVerdict, LEARNER_SENTENCE_MAX, MEANING_MAX, TARGET_MAX, type ProduceVerdict } from './produceCheck';
import { PRODUCE_ERR_TYPES, errTypeOf, type ProduceErrType } from './produceCheckV2';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// activate-check@1 (Wörter aktivieren, Stufe 2; docs/umbau/aktivierung.md): prüft einen eigenen Text der Aktivierungs-Aufgaben A2–A5 – Mini-Szene, Ton wechseln,
// Umschreiben, Satz erweitern, Deutscher Impuls, Lage ohne Wort, Kombi-Satz (2 Zielwörter) und Kundenmail (2–3 Zielwörter). Ersetzt `produce-check@2` NICHT:
// „Eigener Satz“ (A1) bleibt dort. Gemeinsame Hilfsfunktionen (Urteil, Wahrheitswerte, Fehlerklassen) kommen aus `produceCheck.ts` und `produceCheckV2.ts`.
// `quick`, ein Aufruf je Aufgabe, nie automatisch wiederholt; ein Neuversuch nur bei Schemaverletzung, mit angehängter Fehlerbeschreibung (A6.3).
// Drei Schichten wie bei produce-check@2: `why` richtig/falsch, `better` C1-Fassung, `whyBetter` warum. Dazu `targets[]` (je Zielwort: benutzt, richtig) und
// `reusable` (geprüft richtig und natürlich: darf später als „Dein Satz vom …“ wiederkommen). „wrong“ nur bei fehlendem oder falsch benutztem Zielwort (Lernwissenschaft H2).

export const ACT_TARGETS_MAX = 3;

export type ActivateTarget = { word: string; meaning: string; kind: 'word' | 'phrase'; shown: boolean };

/** Aufgabe so, wie der Prompt sie braucht (englische Beschreibungen, keine Kennungen). */
export type ActivateTaskVars = {
  fmt: ActFmt;
  /** Lage in einem englischen Satz (`content/activation/pools`), leer, wenn die Aufgabe keine hat. */
  scene: string;
  /** Gegenüber, englisch. */
  counterpart: string;
  /** Textsorte mit Artikel („an email“). */
  textType: string;
  tone: 'casual' | 'neutral' | 'formal' | 'free';
  tense: 'present simple' | 'past simple' | 'present perfect' | 'future (will / going to)' | 'present continuous' | 'free';
  /** Besonderheit der Aufgabe, englisch (Satzform, Umschreibart, Erweiterungsart, Antwortziel). */
  shape: string;
};

export type ActivateCheckVars = {
  targets: ActivateTarget[];
  sentence: string;
  uiLang: UiLang;
  task: ActivateTaskVars;
  /** Ausgangssatz (Ton wechseln, Umschreiben, Erweitern). */
  source?: string | null;
  /** Mail des Kunden (nur Kundenmail). */
  mail?: string | null;
  /** Frühere eigene Sätze mit dem Hauptzielwort (≤ 3): Claude achtet auf Wiederholung desselben Musters. */
  prior?: readonly string[];
  /** Typische Deutsch-Fehler, die die lokale Vorprüfung gefunden hat (englisch, ≤ 2). */
  hints?: readonly string[];
};

export type ActivateTargetOut = { used: boolean; correct: boolean };
export type ActivateCheckOut = {
  verdict: ProduceVerdict;
  /** Hauptzielwort benutzt (Abkürzung für `targets[0].used`; gleiche Form wie bei produce-check@2). */
  usesTarget: boolean;
  targets: ActivateTargetOut[];
  fixed: string;
  why: string;
  better: string;
  whyBetter: string;
  errType: ProduceErrType | null;
  reusable: boolean;
};

const FMT_EN: Record<ActFmt, string> = {
  sc: 'mini scene: say one sentence in the given situation to the given counterpart',
  tw: 'change the tone: rewrite the original sentence in the requested tone for the given text type',
  rw: 'rewrite the original sentence as requested (shorter, more concrete, or with a different opening)',
  ex: 'extend the original sentence as requested (reason, consequence, example, or contrast)',
  im: 'German thought: the learner saw only the meaning of the target in their own language and had to say it in English',
  lg: 'situation without the word: the learner saw only a situation and the meaning of the target and had to say it in English',
  kb: 'combination: one or two sentences that use both target words',
  ml: 'customer email: answer the email below in a short reply (about 2-4 sentences) that uses all target words',
};

const TONE_EN = { c: 'casual', n: 'neutral', f: 'formal', '-': 'free' } as const;
const TENSE_EN = { pr: 'present simple', pa: 'past simple', pf: 'present perfect', fu: 'future (will / going to)', co: 'present continuous', '-': 'free' } as const;
const SHAPE_EN: Record<string, string> = {
  s: 'statement',
  q: 'question',
  n: 'negation',
  i: 'if-sentence',
  k: 'shorter than the original',
  p: 'more concrete (add a number, a name or a time)',
  o: 'a different opening than the original',
  r: 'add a reason',
  c: 'add a consequence',
  e: 'add an example',
  x: 'add a contrast',
  a: 'confirm the next step',
  d: 'decline politely and offer an alternative',
  f: 'fix the problem and name a deadline',
  '-': 'free',
};

/** Aufgabe (Kennungen) → Beschreibung für den Prompt. */
export function activateTaskVarsOf(t: Pick<ActTask, 'fmt' | 'event' | 'role' | 'type' | 'tone' | 'tense' | 'shape'>): ActivateTaskVars {
  const ev = eventById(t.event);
  return {
    fmt: t.fmt,
    scene: ev?.en ?? '',
    counterpart: roleById(t.role)?.en ?? '',
    textType: typeById(t.type)?.en ?? '',
    tone: TONE_EN[t.tone],
    tense: TENSE_EN[t.tense],
    shape: SHAPE_EN[t.shape] ?? 'free',
  };
}

/** Text der Kundenmail zur Aufgabe, `null` ohne. */
export const mailTextOf = (t: Pick<ActTask, 'fmt' | 'event'>): string | null => (t.fmt === 'ml' ? (mailById(t.event)?.en ?? null) : null);

export const ACTIVATE_FIELD_MAX = 160;
export const SOURCE_MAX = 300;
export const MAIL_MAX = 420;
/** Antwortlänge der Kundenmail und des Kombi-Satzes: etwas mehr als ein Satz. */
export const ACTIVATE_SENTENCE_MAX = 600;
export const BETTER_MAX_WORDS_ACT = 40;
export const BETTER_MAX_WORDS_MAIL = 70;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test) – für zwei Zielwörter. */
export const ACTIVATE_CHECK_EXAMPLE =
  '{"verdict":"minor","targets":[{"used":true,"correct":true},{"used":true,"correct":true}],"fixed":"…","why":"…","better":"","whyBetter":"","errType":"tense","reusable":false}';

const ID = 'activate-check';
const VERSION = 1;

const hasTarget = (sentence: string, target: string): boolean => {
  const t = target.trim();
  if (!t) return true;
  if (locate(sentence, t) || containsPhrase(sentence, t) || locateChunk(sentence, t)) return true;
  const parts = t.split(/\s+/);
  return parts.length >= 2 && !!locateChunk(sentence, `${parts[0]} sth ${parts.slice(1).join(' ')}`);
};

const targetItem = z.preprocess(
  (v) => (v && typeof v === 'object' ? v : { used: v, correct: v }),
  z.object({ used: z.preprocess(looseBool, z.boolean()), correct: z.preprocess(looseBool, z.boolean()) }).transform((x) => ({ used: x.used, correct: x.used && x.correct })),
);

const schemaFor = (vars: Pick<ActivateCheckVars, 'uiLang' | 'targets' | 'task'>): z.ZodType<ActivateCheckOut> => {
  const words = vars.targets.map((t) => t.word);
  const maxWords = vars.task.fmt === 'ml' ? BETTER_MAX_WORDS_MAIL : BETTER_MAX_WORDS_ACT;
  return z
    .object({
      verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
      targets: z.array(targetItem).length(words.length),
      fixed: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 700)),
      why: clipped(1, 400),
      better: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 700)),
      whyBetter: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 300)),
      errType: z.preprocess(errTypeOf, z.enum(PRODUCE_ERR_TYPES as unknown as [ProduceErrType, ...ProduceErrType[]]).nullable()),
      reusable: z.preprocess((v) => (v === undefined || v === null ? false : looseBool(v)), z.boolean()),
    })
    // Keine Widersprüche (Kap. 2): „wrong“ genau dann, wenn ein Zielwort fehlt oder falsch benutzt ist; „reusable“ nur bei „correct“; Fehlerklasse nur bei Fehlern.
    .transform((v) => {
      const bad = v.targets.some((t) => !(t.used && t.correct));
      const verdict: ProduceVerdict = bad ? 'wrong' : v.verdict === 'wrong' ? 'minor' : v.verdict;
      return {
        verdict,
        usesTarget: v.targets[0]?.used ?? false,
        targets: v.targets,
        fixed: v.fixed,
        why: v.why,
        better: v.better,
        whyBetter: v.whyBetter,
        errType: verdict === 'correct' ? null : (v.errType ?? ('other' as const)),
        reusable: verdict === 'correct' && v.reusable,
      };
    })
    .superRefine((v, ctx) => {
      if (v.verdict !== 'correct' && !v.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected text' });
      if (v.better.trim() && !v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['whyBetter'], message: 'whyBetter must explain why "better" is better' });
      if (!v.better.trim() && v.whyBetter.trim()) ctx.addIssue({ code: 'custom', path: ['better'], message: 'better must contain the C1 version when whyBetter is given' });
      // Die C1-Fassung behält alle Zielwörter (sonst übt Emrah, sie zu umgehen) und bleibt kurz.
      if (v.better.trim() && words.some((w) => !hasTarget(v.better, w))) ctx.addIssue({ code: 'custom', path: ['better'], message: 'better must keep every target word or phrase' });
      if (v.better.trim().split(/\s+/).length > maxWords) ctx.addIssue({ code: 'custom', path: ['better'], message: `better must have at most ${maxWords} words` });
    })
    .superRefine(langOf(['why', 'whyBetter'], vars.uiLang));
};

export const activateCheck: PromptTemplate<ActivateCheckVars, ActivateCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: true,
  build(vars) {
    const t = vars.task;
    const multi = vars.targets.length > 1;
    const hidden = vars.targets.some((x) => !x.shown);
    return [
      header({ id: ID, version: VERSION }),
      'You check one short text written by a German-speaking learner (B2, aiming for C1) in a vocabulary activation exercise.',
      'American English is the standard; British spelling and British words count as correct',
      '(then mention the US form in "why" as a tip, never as an error).',
      `Assignment type: ${FMT_EN[t.fmt]}`,
      ...vars.targets.map((x, i) => `Target ${i + 1}${i === 0 ? ' (main)' : ''}: ${clip(x.word, TARGET_MAX)} (${x.kind}; meaning: ${clip(x.meaning, MEANING_MAX)}; shown to the learner: ${x.shown ? 'yes' : 'no'})`),
      ...(t.scene ? [`Situation: ${clip(t.scene, ACTIVATE_FIELD_MAX)}`] : []),
      ...(t.counterpart ? [`Counterpart: ${clip(t.counterpart, 60)}`] : []),
      ...(t.textType ? [`Text type: ${clip(t.textType, 60)}`] : []),
      `Requirements: tone: ${t.tone} | tense: ${t.tense} | shape: ${clip(t.shape, 80)}`,
      ...(vars.source ? [`Original sentence: ${clip(vars.source, SOURCE_MAX)}`] : []),
      ...(vars.mail ? [`Customer email: ${clip(vars.mail, MAIL_MAX)}`] : []),
      `Learner text: ${clip(vars.sentence, Math.max(LEARNER_SENTENCE_MAX, ACTIVATE_SENTENCE_MAX))}`,
      ...(vars.prior?.length ? [`Earlier sentences by the learner with the main target (judge freshness, never penalize): ${vars.prior.slice(0, 3).map((p) => clip(p, 160)).join(' | ')}`] : []),
      ...(vars.hints?.length ? [`Local check found possible typical German-speaker errors (confirm only if really present): ${vars.hints.map((h) => clip(h, 160)).join(' | ')}`] : []),
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object:',
      ACTIVATE_CHECK_EXAMPLE,
      'Rules:',
      `- targets: exactly ${vars.targets.length} entr${vars.targets.length === 1 ? 'y' : 'ies'}, in the order of the targets above. used = the target (any inflected form; a separable phrasal verb may be split) appears; correct = it is used with the right meaning and form.`,
      '- verdict: "correct" = every target used correctly and no real error; "minor" = all targets used correctly but a grammar error, unnatural wording or a missed requirement (tone, tense, shape, text type);',
      '  "wrong" ONLY if a target is missing, misused or has the wrong meaning. Any other error, or not fulfilling the requirements, is "minor", never "wrong".',
      ...(hidden ? ['- The learner was NOT shown the target. If they used another word for the meaning, the target is missing: used=false. Say in "why" which word was meant and how it differs from theirs.'] : []),
      ...(multi ? ['- With several targets, name in "why" the one that is not used correctly first; the other targets stay unmentioned unless they have a problem.'] : []),
      '- Tone: casual = chat with a colleague, contractions fine; neutral = standard business email; formal = client or executive, polite and precise, modern US business style (no "hereby", no "kindly do the needful").',
      '- Tense: if the requested tense is unnatural with a target (e.g. stative verbs in the continuous), accept a natural tense and do not lower the verdict.',
      '- Ignore capitalization, missing final punctuation and obvious phone typos unless they change meaning.',
      '- In fixed and better, do not add facts, numbers, names or content that the learner did not write. fixed keeps every target.',
      '- fixed: the text corrected with minimal changes (identical if nothing to fix).',
      '- why (layer 1, right or wrong): one or two sentences in the explanation language about the single most important error and why it is one.',
      '  Priority: target missing or misused > error that changes meaning > typical German-speaker error > register > style. Never list several errors.',
      '  Always explain, also when correct: then name the specific thing that works (e.g. the collocation, the hedge, the register), no generic praise.',
      '  Quote English words in "…" inside the explanation; never translate the learner text.',
      '- better (layer 2): only if a C1 speaker would really say it differently (collocation, register, precision, hedging, natural word order); never just a synonym or taste.',
      `  Keep the learner's meaning, every target (any form) and the requirements; at most ${t.fmt === 'ml' ? BETTER_MAX_WORDS_MAIL : BETTER_MAX_WORDS_ACT} words, in English. Otherwise "".`,
      '- whyBetter (layer 3): one sentence in the explanation language: why the C1 version is better. "" if better is "".',
      '- errType: the class of the most important error: prep | false_friend | word_order | tense | register | collocation | article | word_choice | other. null if verdict is "correct".',
      '- reusable: true ONLY if verdict is "correct", the text is natural and could stand as a model example for the main target; else false.',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars),
};
