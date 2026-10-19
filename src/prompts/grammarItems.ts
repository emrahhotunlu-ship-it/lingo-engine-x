import { z } from 'zod';
import { foreignSignalPattern, hasSignal, patternNearGap, patternsOf } from '../domain/grammar/patterns';
import { isWrongLang } from '../domain/lang/detect';
import { acceptGrammarItem } from '../domain/tutor/acceptGrammarItem';
import { clip, header, lenientArray, normalizeTaskRaw, US_SIMPLE_PAST_RULE } from './common';
import type { PromptTemplate } from './types';

// @5 (Tutor-Engine v3 §6.3, E5, im Konzept „grammar-items@3“): eingebaute Lösungs-Selbstprüfung. Claude löst jede Aufgabe ein zweites Mal blind
// (`self.solved`) und nennt jede weitere gültige Antwort (`self.also`); „Satz verbessern“ braucht einen Ziel-Satz (`goal`). Danach prüft die App jede
// Aufgabe lokal mit `acceptGrammarItem` (`judge` + `lintTask`, ohne KI): ohne eindeutige Lösung oder mit Lint-Befund fällt sie weg. Sind danach zu
// wenige übrig, ist das ein Schemafehler mit Begründung – genau ein Neuversuch nach A6.3, sonst nie. `budget` gilt nur für den Hintergrund-Nachschub
// (E5); der Knopf „Neue Aufgaben zu {Thema}“ ist ein Nutzeraufruf und bleibt ungedeckelt.
// grammar-items@3 (Lernplattform 2.0 §10.4 P5, Schritt 8; zuvor @2, phase2-plan §7): neue Aufgaben zu EINEM Thema, nur auf Knopfdruck
// („Neue Aufgaben zu {Thema}"). Ausgabe im Pool-Format der alten App, damit sie per
// `poolIntake` gespeichert werden können. Erklärungen fest zweisprachig (de + en): Welche
// angezeigt wird, entscheidet die Oberflächensprache, gemischt wird nie.
// @4: Trägt der Satz außerhalb der Lücke Signalwörter eines ANDEREN Musters desselben Themas (Kontrastsatz, z. B. „yet“ + „on Monday“), muss das gewählte
// Muster das Signal sein, das der Lücke am nächsten steht, sonst fällt die Aufgabe weg; der Prompt sagt es ausdrücklich.
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
  /** Ziel des Satzes (nur „Satz verbessern“, Pflicht seit @5): was der Satz sagen will, zweisprachig. */
  goal?: { de: string; en: string };
};
export type GrammarItemsOut = { items: GrammarItem[] };

export const ITEMS_RULE_MAX = 600;
export const ITEMS_SEEN_MAX = 20;
export const ITEMS_ERRORS_MAX = 5;

export const GRAMMAR_ITEMS_EXAMPLE =
  '{"items":[{"topic":"passive","type":"gap","prompt":"The new contract ___ (sign) yesterday.","answer":"was signed","accepted":["got signed"],"options":null,"hint_de":"(sign)","explanation_de":"„yesterday“ zeigt eine abgeschlossene Zeit, und der Vertrag handelt nicht selbst → was + 3. Form.","explanation_en":"“yesterday” shows finished time, and the contract does not act itself → was + past participle.","src":"ai","self":{"solved":"was signed","also":["got signed"]}},{"topic":"passive","type":"correct","prompt":"The invoices was sent to the client last Friday.","answer":"The invoices were sent to the client last Friday.","accepted":[],"options":null,"hint_de":"","explanation_de":"„invoices“ ist Plural, deshalb steht im Passiv „were“ statt „was“.","explanation_en":"“invoices” is plural, so the passive needs “were”, not “was”.","src":"ai","goal":{"de":"Die Rechnungen gingen letzten Freitag an den Kunden.","en":"The invoices went to the client last Friday."},"self":{"solved":"The invoices were sent to the client last Friday.","also":[]}}]}';

const ID = 'grammar-items';
const VERSION = 5;
/** Hintergrund-Nachschub (E5) je Gerät und Tag; die Summe deckelt `BG_PER_DAY` (src/ai/budget.ts). */
export const GRAMMAR_ITEMS_BG_PER_DAY = 2;

/** Begründung je Ablehnungsgrund (geht beim einen Neuversuch nach A6.3 an Claude zurück). */
const REJECT_HINT: Readonly<Record<string, string>> = {
  shape: 'invalid item',
  lint: 'item is ambiguous or incomplete (one ___ only, a base-form hint like "(sign)" for verbs, enough sentence around the gap, a source sentence for transform)',
  answer_not_correct: 'the answer does not fill the gap as written',
  accepted_not_correct: 'an accepted variant is not a valid answer',
  distractor_ok: 'a wrong option is also a correct answer',
  error_kept: 'the sentence to correct is already correct or nearly correct',
  self_missing: 'self check missing',
  self_wrong: 'your blind solution does not match the answer',
  also_uncovered: 'another valid answer is not listed in accepted; list it or change the sentence so only one answer fits',
};

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
      goal: z.object({ de: z.string().trim().min(4).max(200), en: z.string().trim().min(4).max(200) }).optional(),
      self: z.object({ solved: z.string().trim().min(1).max(300), also: z.array(z.string().trim().min(1).max(300)).max(4).default([]) }),
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
          else {
            // Kontrastsatz: Signal eines anderen Musters im Satz (außerhalb der Lücke) → das gewählte Muster muss das der Lücke nächste Signal tragen.
            const tp = patternsOf(topic);
            if (tp && /_{3,}/.test(it.prompt) && foreignSignalPattern(tp, p.id, it.prompt.replace(/_{3,}/, ' '))) {
              const near = patternNearGap(tp, it.prompt, it.answer);
              if (near?.id !== p.id) ctx.addIssue({ code: 'custom', path: ['pat'], message: 'the sentence contains signal words of another pattern; use a sentence with only the signal that forces the gap' });
            }
          }
        }
      }
      if (it.why_not && it.type === 'mc' && !it.why_not.every((w) => (it.options ?? []).includes(w.opt) && w.opt !== it.answer)) ctx.addIssue({ code: 'custom', path: ['why_not'], message: 'why_not options must be wrong options of the item' });
      if (it.type === 'correct' && !it.goal) ctx.addIssue({ code: 'custom', path: ['goal'], message: '"correct" items need "goal" {de, en}: what the sentence wants to say' });
      if (it.goal && isWrongLang(it.goal.de, 'de')) ctx.addIssue({ code: 'custom', path: ['goal', 'de'], message: 'must be written in German' });
      // Lösungs-Selbstprüfung: lokal mit `judge` und `lintTask` (keine KI). Jede Verletzung verwirft nur diese Aufgabe.
      for (const reason of acceptGrammarItem(it, { src: 'ai', requireSelf: true }).reasons) {
        ctx.addIssue({ code: 'custom', path: [], message: `${REJECT_HINT[reason.startsWith('lint:') ? 'lint' : reason] ?? 'invalid item'} (${reason})` });
      }
    })
    .transform(({ why_not, ...withSelf }) => {
      // `self` dient nur der Prüfung; gespeichert wird die Aufgabe ohne sie.
      const it: Omit<typeof withSelf, 'self'> & { self?: unknown } = { ...withSelf };
      delete it.self;
      return {
        ...it,
        ...(it.pat && patterns.length ? { pat: it.pat } : { pat: undefined }),
        ...(why_not?.length ? { why: { ok: { de: it.explanation_de, en: it.explanation_en }, wrong: why_not } } : {}),
      };
    });

// W8: Aufgaben einzeln prüfen – ungültige fallen weg, gescheitert wird nur bei zu wenigen gültigen.
const schemaFor = (v: GrammarItemsVars): z.ZodType<GrammarItemsOut> =>
  z.object({ items: lenientArray(z.preprocess(normalizeTaskRaw, itemSchema(v.topic, v.patterns ?? [])), Math.min(3, v.count), Math.max(v.count, 8)) });

export const grammarItems: PromptTemplate<GrammarItemsVars, GrammarItemsOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  budget: { bgPerDay: GRAMMAR_ITEMS_BG_PER_DAY },
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
      'Reply with only one JSON object of this shape (two items shown):',
      GRAMMAR_ITEMS_EXAMPLE,
      'Rules:',
      '- EXACTLY ONE correct answer in this sentence. If another answer also fits this sentence, list it in "accepted" or rewrite the sentence.',
      `- ${US_SIMPLE_PAST_RULE}: list it in "accepted".`,
      '- Tense items (mc and gap): the sentence MUST contain a clear signal (e.g. "yesterday", "right now", "since 2020", "every Monday", "by next June") that rules out every other option. Without such a signal, "is" vs. "was" is ambiguous – never write that.',
      '  If another form would also be correct, add a signal word that rules it out, or list it in "accepted".',
      '- If there are recent mistakes, write NEW items that test exactly the same confusion with different sentences.',
      '- "mc": prompt with one ___ and 3–4 options, "answer" identical to one option. "gap": one ___, hint_de gives the base form like "(work)".',
      '  "transform": a sentence, then "→" and the new sentence with one ___; answer is only the missing part.',
      '  "correct": one sentence with exactly one typical error; answer is the full corrected sentence; options null; "goal": {"de","en"} says in plain words what the sentence wants to say.',
      '- Self check for EVERY item: after writing it, solve it again as if you had never seen the answer and put that solution in "self.solved".',
      '  In "self.also" list every OTHER answer a careful native speaker would accept (other tenses, contractions, word order, British forms), max 4.',
      '  Every answer in "self.also" must also be in "accepted" – otherwise rewrite the sentence so that only one answer fits. Good English is never wrong.',
      '- The app checks every item again and drops items with a second valid answer, a gap without a base-form hint for a verb, or a correct sentence to "correct".',
      ...(v.patterns?.length ? ['- Signal words: the sentence may contain only the signal word(s) of the ONE pattern it trains, and that signal must be what forces the gap. Never combine signals of two patterns in one sentence (no contrast sentences like "We ___ it yet, although we sent it on Monday").',
      '- "pat": the id of the pattern the item trains. For "mc" items add "why_not": up to 3 objects {"opt": a WRONG option exactly as written in options, "de": German, "en": English; max 140 characters each} saying why that option does not fit THIS sentence.'] : []),
      '- explanation_de: 1–2 short sentences in simple German: the signal word and the rule it triggers (never just repeat the answer); put English words and phrases in “…”.',
      '- explanation_en: the same in simple English.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
