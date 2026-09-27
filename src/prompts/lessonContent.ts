import { z } from 'zod';
import { coreWord } from '../domain/course/baseLesson';
import { containsTarget } from '../domain/course/production';
import { isWrongLang } from '../domain/lang/detect';
import type { LessonMeta } from '../domain/learn/types';
import { clip, header, langName, lenientArray, normalizeTaskRaw } from './common';
import type { PromptTemplate, UiLang } from './types';

// lesson-content@2 (phase2-plan §7, §4.8): Inhalt EINER Lektion (Wörter, Dialog, Fragen,
// Grammatikaufgaben, Produktion) auf Knopfdruck „Lektion vorbereiten". Ausgabe direkt im
// Speicherformat der alten App (`lesson/<lid>`), Fragen in beiden Sprachen (`q`/`q_alt`).

export type LessonContentVars = {
  meta: LessonMeta;
  /** Themenname und Regel (Kernsatz + Formen) auf Englisch, zusammen ≤ 1.500 Zeichen. */
  grammarName: string;
  ruleEn: string;
  uiLang: UiLang;
  /** Verhältnis Beruf/Alltag aus `app/profile.mix` (0–100). */
  mix?: { work: number; life: number } | null;
};

type Word = { en: string; de: string; pos: string; def: string; ex: string };
type Line = { sp: string; en: string; de: string };
type Question = { q: string; options: string[]; answer: string; lang: UiLang; q_alt: string; options_alt: string[]; answer_alt: string };
type Task = {
  topic: string;
  type: 'mc' | 'gap' | 'transform' | 'correct';
  prompt: string;
  answer: string;
  accepted: string[];
  options: string[] | null;
  hint: string;
  expl: string;
  expl_en: string;
};
export type LessonContentOut = {
  words: Word[];
  dialogue: { title: string; lines: Line[] };
  questions: Question[];
  tasks: Task[];
  output: { de: string; en: string; mustUse: string[] };
};

export const RULE_MAX = 1500;
export const SITUATION_MAX = 600;
export const LINE_MAX = 220;
/** Mindestens so viele erkannte Pflichtwörter (wie die lokale Prüfung, MIN_MUST_USE). */
export const MUST_USE_MIN = 2;

const ID = 'lesson-content';
const VERSION = 2;

/** Form der Antwort, im Prompt gezeigt (kein echtes Beispiel: es hängt an der Lektion). */
export const LESSON_CONTENT_SHAPE =
  '{"words":[{"en":"<given English word>","de":"<given German meaning>","pos":"noun|verb|adj|adv|phrase","def":"<simple English definition, max 12 words>","ex":"<one sentence from the dialogue containing the word in [square brackets]>"}],' +
  '"dialogue":{"title":"<short English title>","lines":[{"sp":"<first name>","en":"<one natural line, max 22 words>","de":"<German translation>"}]},' +
  '"questions":[{"q":"<question in UI language>","options":["<4 options in UI language>"],"answer":"<one of options>","lang":"<ui>","q_alt":"<same question in the other language>","options_alt":["<same options, other language, same order>"],"answer_alt":"<one of options_alt>"}],' +
  '"tasks":[{"topic":"<topic id>","type":"mc|gap|transform|correct","prompt":"...","answer":"...","accepted":[],"options":null,"hint":"(base form)","expl":"<why, German>","expl_en":"<why, English>"}],' +
  '"output":{"de":"<writing task in German, from this situation>","en":"<same task in English>","mustUse":["<3–5 of the given English words>"]}}';

const blanks = (s: string) => (s.match(/_{3,}/g) ?? []).length;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const other = (l: UiLang): UiLang => (l === 'de' ? 'en' : 'de');

const schemaFor = (v: LessonContentVars): z.ZodType<LessonContentOut> => {
  const word = z.object({
    en: z.string().trim().min(1).max(80),
    de: z.string().trim().min(1).max(120),
    pos: z.string().trim().max(20).default('phrase'),
    def: z.string().trim().max(200).default(''),
    ex: z.string().trim().max(300).default(''),
  });
  const line = z.object({ sp: z.string().trim().min(1).max(40), en: z.string().trim().min(1).max(LINE_MAX), de: z.string().trim().max(400).default('') });
  const question = z.object({
    q: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(160)).length(4),
    answer: z.string().trim().min(1),
    lang: z.literal(v.uiLang),
    q_alt: z.string().trim().min(3).max(300),
    options_alt: z.array(z.string().trim().min(1).max(160)).length(4),
    answer_alt: z.string().trim().min(1),
  });
  const task = z
    .object({
      topic: z.literal(v.meta.grammar),
      type: z.enum(['mc', 'gap', 'transform', 'correct']),
      prompt: z.string().trim().min(8).max(300),
      answer: z.string().trim().min(1).max(200),
      accepted: z.array(z.string().trim().min(1)).max(6).default([]),
      options: z.array(z.string().trim().min(1).max(80)).length(4).nullable().default(null),
      hint: z.string().trim().max(60).default(''),
      expl: z.string().trim().min(8).max(400),
      expl_en: z.string().trim().min(8).max(400),
    })
    .superRefine((t, ctx) => {
      const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
      if (t.type === 'mc') {
        if (!t.options) issue(['options'], 'mc needs 4 options');
        else if (!t.options.includes(t.answer)) issue(['answer'], 'answer must be one of the options');
      } else if (t.options) issue(['options'], 'options must be null unless type is mc');
      if ((t.type === 'mc' || t.type === 'gap') && blanks(t.prompt) !== 1) issue(['prompt'], 'prompt must contain exactly one ___');
      if (isWrongLang(t.expl, 'de')) issue(['expl'], 'must be written in German');
      if (isWrongLang(t.expl_en, 'en')) issue(['expl_en'], 'must be written in English');
    });
  const targets = v.meta.words.map(([en]) => en);
  /** W6: Pflichtwort der Vorgabe zuordnen („chair a meeting“, „attendees“ → „to chair a meeting“, „attendee“). */
  const targetOf = (m: string): string | undefined =>
    targets.find((t) => same(m, t) || same(coreWord(m), coreWord(t)) || containsTarget(m, t));
  return z
    .object({
      words: z.array(word).length(v.meta.words.length),
      dialogue: z.object({ title: z.string().trim().min(1).max(120), lines: z.array(line).min(8).max(14) }),
      questions: z.array(question).min(2).max(3),
      // W8: Aufgaben einzeln prüfen; ungültige fallen weg, gescheitert wird erst unter 3 gültigen.
      tasks: lenientArray(z.preprocess(normalizeTaskRaw, task), 3, 6),
      output: z.object({ de: z.string().trim().min(10).max(600), en: z.string().trim().min(10).max(600), mustUse: z.array(z.string().trim().min(1)) }),
    })
    .transform((o) => ({
      ...o,
      // Wörter ohne „to“ o. Ä. auf die Vorgabe zurückführen.
      words: o.words.map((w, i) => {
        const given = v.meta.words[i]?.[0];
        return given && !same(w.en, given) && same(coreWord(w.en), coreWord(given)) ? { ...w, en: given } : w;
      }),
      // W6: Pflichtwörter den Vorgaben zuordnen, Unbekanntes verwerfen, doppelte zusammenfassen.
      output: { ...o.output, mustUse: [...new Set(o.output.mustUse.map(targetOf).filter((t): t is string => !!t))].slice(0, 5) },
    }))
    .superRefine((o, ctx) => {
      const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
      // Wörter genau wie vorgegeben, in derselben Reihenfolge.
      o.words.forEach((w, i) => {
        const given = v.meta.words[i];
        if (given && !same(w.en, given[0])) issue(['words', i, 'en'], `must be exactly "${given[0]}"`);
      });
      // Jedes Zielwort kommt im Dialog vor (gebeugt erlaubt).
      const text = o.dialogue.lines.map((l) => l.en).join(' ');
      v.meta.words.forEach(([en], i) => {
        if (!containsTarget(text, en)) issue(['dialogue', 'lines'], `target word ${i + 1} "${en}" must appear in the dialogue`);
      });
      o.questions.forEach((q, i) => {
        if (!q.options.includes(q.answer)) issue(['questions', i, 'answer'], 'answer must be one of the options');
        if (!q.options_alt.includes(q.answer_alt)) issue(['questions', i, 'answer_alt'], 'answer_alt must be one of options_alt');
        if (q.options.indexOf(q.answer) !== q.options_alt.indexOf(q.answer_alt)) issue(['questions', i, 'answer_alt'], 'answer_alt must be at the same position as answer');
        if (isWrongLang(q.q, v.uiLang)) issue(['questions', i, 'q'], `must be written in ${langName(v.uiLang)}`);
        if (isWrongLang(q.q_alt, other(v.uiLang))) issue(['questions', i, 'q_alt'], `must be written in ${langName(other(v.uiLang))}`);
      });
      if (isWrongLang(o.output.de, 'de')) issue(['output', 'de'], 'must be written in German');
      if (isWrongLang(o.output.en, 'en')) issue(['output', 'en'], 'must be written in English');
      if (o.output.mustUse.length < Math.min(MUST_USE_MIN, targets.length)) issue(['output', 'mustUse'], `must name at least ${MUST_USE_MIN} of the given English words`);
    });
};

export const lessonContent: PromptTemplate<LessonContentVars, LessonContentOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const m = v.meta;
    const mix = v.mix ? `${Math.round(v.mix.work)}% work, ${Math.round(v.mix.life)}% everyday life` : 'mostly work';
    return [
      header({ id: ID, version: VERSION }),
      'You write ONE lesson of a tailored English course for a German native speaker, early B2 aiming for C1,',
      'head of business development at a German DMS/ECM cloud vendor. Use invented names; never state facts about a real company.',
      'American English only (US spelling and vocabulary); list British variants in "accepted".',
      `Lesson id: ${m.id}`,
      `Level: ${m.level}`,
      `Theme: ${clip(m.en, 120)}`,
      `Situation: ${clip(m.situation, SITUATION_MAX)}`,
      `Can-do goal: ${clip(m.cando_en, 300)}`,
      `Grammar topic id: ${m.grammar}`,
      `Grammar point: ${clip(v.grammarName, 80)} – ${clip(v.ruleEn, RULE_MAX)}`,
      `Target words (keep exactly, in this order): ${m.words.map(([en, de]) => `${clip(en, 60)} = ${clip(de, 60)}`).join('; ')}`,
      `Content mix: ${mix}`,
      `UI language: ${v.uiLang} (${langName(v.uiLang)})`,
      'Reply with only one JSON object of this shape:',
      LESSON_CONTENT_SHAPE,
      'Rules:',
      `- words: exactly ${m.words.length} entries, one per target word, en and de exactly as given; ex is a line of the dialogue with the word in [brackets].`,
      '- dialogue: 8–14 short spoken lines between two or three people in this situation; use every target word at least once',
      '  and the grammar point at least 3 times, naturally.',
      '- questions: 2–3 comprehension questions with 4 options and exactly one correct answer that needs the dialogue.',
      `  q/options/answer in ${langName(v.uiLang)} ("lang": "${v.uiLang}"), q_alt/options_alt/answer_alt the same in ${langName(other(v.uiLang))}.`,
      '- tasks: 4–6 grammar items on this grammar point, set in this situation. EXACTLY ONE correct answer per item;',
      '  reject any item where a second option is also grammatical in some context, or list it in "accepted".',
      '  mc and gap prompts contain exactly one ___; mc has 4 options including the answer; other types have options null.',
      '  expl in simple German (put English words and phrases in “…”), expl_en in simple English: name the signal word and the rule (never just repeat the answer).',
      '- output: a short writing task from this situation that forces the grammar point; mustUse = 3–5 of the given English words, written exactly as given.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};

/** KI-Ergebnis → Speicherform `lesson/<lid>` (Aufgaben in `validG`-Form mit `src:'lesson'`). */
export function toLessonDoc(out: LessonContentOut, v: Pick<LessonContentVars, 'uiLang'>, nowMs: number): Record<string, unknown> {
  return {
    v: 1,
    t: nowMs,
    words: out.words,
    dialogue: out.dialogue,
    questions: out.questions,
    tasks: out.tasks.map((t) => ({ ...t, src: 'lesson' })),
    output: out.output,
    lx: { pv: `${ID}@${VERSION}`, lang: v.uiLang },
  };
}
