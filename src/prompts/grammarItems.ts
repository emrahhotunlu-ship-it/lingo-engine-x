import { z } from 'zod';
import { hasSignal } from '../domain/grammar/patterns';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, lenientArray, normalizeTaskRaw } from './common';
import type { PromptTemplate } from './types';

// grammar-items@3 (Lernplattform 2.0 §10.4 P5, Schritt 8; zuvor @2, phase2-plan §7): neue Aufgaben zu EINEM Thema, nur auf Knopfdruck
// („Neue Aufgaben zu {Thema}"). Ausgabe im Pool-Format der alten App, damit sie per
// `poolIntake` gespeichert werden können. Erklärungen fest zweisprachig (de + en): Welche
// angezeigt wird, entscheidet die Oberflächensprache, gemischt wird nie.
// @3: Hat das Thema Muster, bekommt Claude die Liste der EINGEFÜHRTEN Muster (Kennung, Name, Formel, Signalwörter) und ordnet jede Aufgabe genau
// einem davon zu (`pat`); Aufgaben ohne eines dieser Muster oder ohne Signalwort des Musters im Satz fallen weg (Prüfung). `why_not` begründet
// bei Auswahlaufgaben, warum eine falsche Option nicht passt (wird zu `why.wrong`). Die neuen Arten (Schlüsselwort, Fehler finden, Bedeutung) gibt es
// nur aus dem geprüften Inhalt, nie zur Laufzeit.

export type GrammarItemsVars = {
  topic: string;
  nameEn: string;
  ruleEn: string;
  examples: readonly string[];
  /** Anzeige-Beherrschung 0–1. */
  p: number;
  types: ReadonlyArray<'mc' | 'gap' | 'transform' | 'correct'>;
  seenText: readonly string[];
  /** Echte Fehler Emrahs zum Thema (≤ 5). */
  errors: ReadonlyArray<{ q: string; given: string; ans: string }>;
  count: number;
  /** Eingeführte Muster des Themas (leer, wenn das Thema keine Musterdatei hat). */
  patterns?: ReadonlyArray<{ id: string; name: string; form: string; signals: readonly string[] }>;
};

export type GrammarItem = {
  topic: string;
  type: 'mc' | 'gap' | 'transform' | 'correct';
  prompt: string;
  answer: string;
  accepted: string[];
  options: string[] | null;
  hint_de: string;
  explanation_de: string;
  explanation_en: string;
  src: 'ai';
  /** Kennung des Musters (nur bei Themen mit Musterdatei). */
  pat?: string;
  /** Begründung je falscher Option (nur `mc`), zweisprachig; daraus entsteht `why.wrong`. */
  why?: { ok: { de: string; en: string }; wrong: Array<{ opt: string; de: string; en: string }> };
};
export type GrammarItemsOut = { items: GrammarItem[] };

export const ITEMS_RULE_MAX = 600;
export const ITEMS_SEEN_MAX = 20;
export const ITEMS_ERRORS_MAX = 5;

export const GRAMMAR_ITEMS_EXAMPLE =
  '{"items":[{"topic":"passive","type":"gap","prompt":"The new contract ___ (sign) yesterday.","answer":"was signed","accepted":[],"options":null,"hint_de":"(sign)","explanation_de":"„yesterday“ zeigt eine abgeschlossene Zeit, und der Vertrag handelt nicht selbst → was + 3. Form.","explanation_en":"“yesterday” shows finished time, and the contract does not act itself → was + past participle.","src":"ai"}]}';

const ID = 'grammar-items';
const VERSION = 3;

const blanks = (s: string) => (s.match(/_{3,}/g) ?? []).length;

const itemSchema = (topic: string, patterns: NonNullable<GrammarItemsVars['patterns']>) =>
  z
    .object({
      topic: z.literal(topic),
      pat: z.string().trim().max(40).optional(),
      why_not: z
        .array(z.object({ opt: z.string().trim().min(1).max(80), de: z.string().trim().min(4).max(140), en: z.string().trim().min(4).max(140) }))
        .max(3)
        .optional(),
      type: z.enum(['mc', 'gap', 'transform', 'correct']),
      prompt: z.string().trim().min(8).max(300),
      answer: z.string().trim().min(1).max(200),
      accepted: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
      options: z.array(z.string().trim().min(1).max(80)).min(3).max(4).nullable().default(null),
      hint_de: z.string().trim().max(60).default(''),
      explanation_de: z.string().trim().min(8).max(400),
      explanation_en: z.string().trim().min(8).max(400),
      src: z.literal('ai').default('ai'),
    })
    .superRefine((it, ctx) => {
      if (it.type === 'mc') {
        if (!it.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'mc needs 3–4 options' });
        else if (!it.options.includes(it.answer)) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'answer must be one of the options' });
      } else if (it.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be null unless type is mc' });
      if ((it.type === 'mc' || it.type === 'gap' || it.type === 'transform') && blanks(it.prompt) !== 1) {
        ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'prompt must contain exactly one ___' });
      }
      if (isWrongLang(it.explanation_de, 'de')) ctx.addIssue({ code: 'custom', path: ['explanation_de'], message: 'must be written in German' });
      if (isWrongLang(it.explanation_en, 'en')) ctx.addIssue({ code: 'custom', path: ['explanation_en'], message: 'must be written in English' });
      // Muster: Bei Themen mit Musterdatei gehört jede Aufgabe zu genau einem eingeführten Muster, und dessen Signalwort steht im Satz oder in der Lösung.
      if (patterns.length) {
        const p = patterns.find((x) => x.id === it.pat);
        if (!p) ctx.addIssue({ code: 'custom', path: ['pat'], message: `pat must be one of: ${patterns.map((x) => x.id).join(', ')}` });
        else {
          const text = `${it.prompt.replace(/_{3,}/, it.answer)} ${it.answer}`;
          if (!p.signals.some((sg) => hasSignal(text, sg))) ctx.addIssue({ code: 'custom', path: ['pat'], message: `the sentence must contain a signal word of the pattern (${p.signals.join(', ')})` });
        }
      }
      if (it.why_not && it.type === 'mc' && !it.why_not.every((w) => (it.options ?? []).includes(w.opt) && w.opt !== it.answer)) ctx.addIssue({ code: 'custom', path: ['why_not'], message: 'why_not options must be wrong options of the item' });
    })
    .transform(({ why_not, ...it }) => ({
      ...it,
      ...(it.pat && patterns.length ? { pat: it.pat } : { pat: undefined }),
      ...(why_not?.length ? { why: { ok: { de: it.explanation_de, en: it.explanation_en }, wrong: why_not } } : {}),
    }));

// W8: Aufgaben einzeln prüfen – ungültige fallen weg, gescheitert wird nur bei zu wenigen gültigen.
const schemaFor = (v: GrammarItemsVars): z.ZodType<GrammarItemsOut> =>
  z.object({ items: lenientArray(z.preprocess(normalizeTaskRaw, itemSchema(v.topic, v.patterns ?? [])), Math.min(3, v.count), Math.max(v.count, 8)) });

export const grammarItems: PromptTemplate<GrammarItemsVars, GrammarItemsOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const style =
      v.p < 0.4 ? 'mostly mc with clear contrasts and short sentences, some gap' : v.p <= 0.7 ? 'mostly gap and transform' : 'mostly correct and transform (less guessable)';
    return [
      header({ id: ID, version: VERSION }),
      'You write grammar practice items for ONE learner: German native speaker, English level B2 aiming for C1,',
      'head of business development at a German DMS/ECM cloud vendor. Use everyday and work situations, invented names only,',
      'never facts about a real company. Sentences at most about 18 words. American English (US spelling); list British variants in "accepted".',
      `Topic id: ${v.topic}`,
      `Topic: ${clip(v.nameEn, 80)}`,
      `Rule: ${clip(v.ruleEn, ITEMS_RULE_MAX)}`,
      `Examples: ${v.examples.map((e) => clip(e, 160)).join(' | ') || '(none)'}`,
      `Mastery: ${Math.round(v.p * 100)}% – style: ${style}`,
      `Wanted types: ${v.types.join(', ') || 'mc, gap, transform, correct'}`,
      ...(v.patterns?.length
        ? [
            'Patterns of this topic (every item MUST belong to exactly one of them and put its id in "pat"; the sentence must contain one of its signal words):',
            ...v.patterns.map((p) => `- ${p.id} | ${clip(p.name, 80)} | ${clip(p.form, 100)} | signals: ${p.signals.slice(0, 6).join(', ')}`),
          ]
        : []),
      `Count: ${v.count}`,
      `Do not repeat: ${v.seenText.slice(-ITEMS_SEEN_MAX).map((s) => clip(s, 140)).join(' | ') || '(none)'}`,
      `Recent mistakes (learner answer → correct): ${
        v.errors
          .slice(-ITEMS_ERRORS_MAX)
          .map((e) => `${clip(e.q, 140)} :: ${clip(e.given, 60)} → ${clip(e.ans, 60)}`)
          .join(' | ') || '(none)'
      }`,
      'Reply with only one JSON object of this shape (one item shown):',
      GRAMMAR_ITEMS_EXAMPLE,
      'Rules:',
      '- EXACTLY ONE correct answer per item. Reject any item where a second option is also grammatical in some context.',
      '- Tense items (mc and gap): the sentence MUST contain a clear signal (e.g. "yesterday", "right now", "since 2020", "every Monday", "by next June") that rules out every other option. Without such a signal, "is" vs. "was" is ambiguous – never write that.',
      '  If another form would also be correct, add a signal word that rules it out, or list it in "accepted".',
      '- If there are recent mistakes, write NEW items that test exactly the same confusion with different sentences.',
      '- "mc": prompt with one ___ and 3–4 options, "answer" identical to one option. "gap": one ___, hint_de gives the base form like "(work)".',
      '  "transform": a sentence, then "→" and the new sentence with one ___; answer is only the missing part.',
      '  "correct": one sentence with exactly one typical error; answer is the full corrected sentence; options null.',
      ...(v.patterns?.length ? ['- "pat": the id of the pattern the item trains. For "mc" items add "why_not": up to 3 objects {"opt": a WRONG option exactly as written in options, "de": German, "en": English; max 140 characters each} saying why that option does not fit THIS sentence.'] : []),
      '- explanation_de: 1–2 short sentences in simple German: the signal word and the rule it triggers (never just repeat the answer); put English words and phrases in “…”.',
      '- explanation_en: the same in simple English.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
