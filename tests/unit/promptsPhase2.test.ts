import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lessonMeta } from '../../src/domain/course/catalog';
import { promptBytes, PROMPT_MAX_BYTES } from '../../src/prompts/common';
import { GRAMMAR_ITEMS_EXAMPLE, grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { GRAMMAR_JUDGE_EXAMPLE, grammarJudge, type GrammarJudgeVars } from '../../src/prompts/grammarJudge';
import { LESSON_CONTENT_SHAPE, lessonContent, toLessonDoc, type LessonContentOut, type LessonContentVars } from '../../src/prompts/lessonContent';
import { LESSON_PRODUCTION_EXAMPLE, lessonProduction, toWritingDoc, type LessonProductionVars } from '../../src/prompts/lessonProduction';
import { TEMPLATES } from '../../src/prompts/registry';
import { validateDoc } from '../../src/data/validate';

const judgeVars: GrammarJudgeVars = {
  topic: 'Past Simple vs. Present Perfect',
  type: 'correct',
  prompt: 'I have seen that film yesterday.',
  answer: 'I saw that film yesterday.',
  accepted: [],
  given: 'Yesterday I saw that film.',
  uiLang: 'de',
};

const itemsVars: GrammarItemsVars = {
  topic: 'passive',
  nameEn: 'Passive',
  ruleEn: 'be + past participle',
  examples: ['The contract has been signed.'],
  p: 0.5,
  types: ['gap', 'transform'],
  seenText: ['The road ___ (repair) every year.'],
  errors: [{ q: 'My bike ___ (steal).', given: 'was stoled', ans: 'was stolen' }],
  count: 6,
};

const meta = lessonMeta('l01')!;
const contentVars: LessonContentVars = { meta, grammarName: 'Present Perfect Continuous', ruleEn: 'have/has been + -ing', uiLang: 'de' };

/** Gültige Lektion l01 (erfunden) – auch Vorlage für die festen Antworten des Entwicklungs-Adapters. */
export const L01_CONTENT: LessonContentOut = {
  words: meta.words.map(([en, de]) => ({ en, de, pos: 'phrase', def: 'simple definition here', ex: `We use [${en.replace(/^to /, '')}] a lot.` })),
  dialogue: {
    title: 'Monday project meeting',
    lines: [
      { sp: 'Anna', en: "Good morning, everyone. I'll chair the meeting today.", de: 'Guten Morgen zusammen. Ich leite heute das Meeting.' },
      { sp: 'Anna', en: "Let's look at the agenda first.", de: 'Schauen wir zuerst auf die Tagesordnung.' },
      { sp: 'Ben', en: 'Every attendee has been reading the notes since Friday.', de: 'Alle Teilnehmer lesen seit Freitag die Notizen.' },
      { sp: 'Anna', en: "Great. Let's go over the numbers.", de: 'Gut. Gehen wir die Zahlen durch.' },
      { sp: 'Ben', en: "We've been working on the migration for two weeks.", de: 'Wir arbeiten seit zwei Wochen an der Migration.' },
      { sp: 'Cara', en: "I've been testing the new search since Monday.", de: 'Ich teste seit Montag die neue Suche.' },
      { sp: 'Anna', en: 'Is there an action item for the sales team?', de: 'Gibt es einen offenen Punkt für den Vertrieb?' },
      { sp: 'Anna', en: 'Let me recap: we have been making good progress.', de: 'Kurz zusammengefasst: Wir kommen gut voran.' },
    ],
  },
  questions: [
    {
      q: 'Woran arbeitet Ben seit zwei Wochen?',
      options: ['An der Migration', 'Am Vertrieb', 'An der Suche', 'An der Tagesordnung'],
      answer: 'An der Migration',
      lang: 'de',
      q_alt: 'What has Ben been working on for two weeks?',
      options_alt: ['The migration', 'Sales', 'The search', 'The agenda'],
      answer_alt: 'The migration',
    },
    {
      q: 'Was testet Cara seit Montag?',
      options: ['Die neue Suche', 'Die Migration', 'Die Notizen', 'Das Budget'],
      answer: 'Die neue Suche',
      lang: 'de',
      q_alt: 'What has Cara been testing since Monday?',
      options_alt: ['The new search', 'The migration', 'The notes', 'The budget'],
      answer_alt: 'The new search',
    },
  ],
  tasks: Array.from({ length: 4 }, (_, i) => ({
    topic: 'pres-perf-cont',
    type: 'gap' as const,
    prompt: `We ___ (work) on topic ${'ABCD'[i]} since Monday.`,
    answer: 'have been working',
    accepted: ["'ve been working"],
    options: null,
    hint: '(work)',
    expl: '„since Monday“ zeigt eine Handlung, die bis jetzt andauert → have been + -ing.',
    expl_en: '“since Monday” shows an action that is still going on → have been + -ing.',
  })),
  output: {
    de: 'Schreibe drei Sätze: Eröffne das Meeting und sage, woran das Team seit letzter Woche arbeitet.',
    en: 'Write three sentences: open the meeting and say what the team has been working on since last week.',
    mustUse: ['agenda', 'to recap', 'attendee'],
  },
};

const productionVars: LessonProductionVars = {
  taskEn: 'Open the meeting and say what the team has been working on.',
  mustUse: ['agenda', 'to recap', 'attendee'],
  structure: 'Present Perfect Continuous',
  text: 'Good morning. Here is the agenda. We have been working on the migration.',
  candoEn: meta.cando_en,
  uiLang: 'de',
};

describe('Phase-2-Vorlagen: Kopfzeile, Stufe, Zwischenspeicher', () => {
  it('im Verzeichnis, mit Kopfzeile', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of ['lesson-content', 'lesson-production', 'grammar-items', 'grammar-judge']) expect(ids).toContain(id);
    expect(grammarJudge.build(judgeVars).split('\n')[0]).toBe('[grammar-judge@1]');
    expect(grammarItems.build(itemsVars).split('\n')[0]).toBe('[grammar-items@1]');
    expect(lessonContent.build(contentVars).split('\n')[0]).toBe('[lesson-content@1]');
    expect(lessonProduction.build(productionVars).split('\n')[0]).toBe('[lesson-production@1]');
    expect([grammarJudge.tier, grammarItems.tier, lessonContent.tier, lessonProduction.tier]).toEqual(['quick', 'default', 'default', 'default']);
    expect(grammarJudge.cache).toEqual({ gcTime: 86_400_000 });
    expect(grammarItems.cache).toBe(false);
    expect(lessonContent.cache).toEqual({ gcTime: 86_400_000 });
    expect(lessonProduction.cache).toBe(true);
    expect(grammarItems.build(itemsVars)).toContain('Reject any item where a second option is also grammatical in some context.');
    expect(lessonContent.build(contentVars)).toContain(LESSON_CONTENT_SHAPE);
  });
});

describe('Beispiele bestehen das Schema, falsche Sprache nicht', () => {
  it('grammar-judge@1', () => {
    const s = grammarJudge.schema(judgeVars);
    expect(s.safeParse(JSON.parse(GRAMMAR_JUDGE_EXAMPLE)).success).toBe(true);
    expect(s.safeParse({ verdict: 'wrong', acceptable: true, corrected: 'x', why: 'y' }).success).toBe(false);
    expect(s.safeParse({ verdict: 'correct', acceptable: true, corrected: 'x', why: 'The answer is correct because the time is finished.' }).success).toBe(false);
    expect(s.safeParse({ verdict: 'correct', acceptable: true, corrected: 'x', why: 'Die Antwort ist richtig, weil die Zeit abgeschlossen ist.' }).success).toBe(true);
  });

  it('grammar-items@1, U-06: answer ∉ options wird abgelehnt', () => {
    const s = grammarItems.schema(itemsVars);
    const ex = JSON.parse(GRAMMAR_ITEMS_EXAMPLE) as { items: Array<Record<string, unknown>> };
    const three = { items: [ex.items[0], ex.items[0], ex.items[0]] };
    expect(s.safeParse(three).success).toBe(true);
    const mc = { ...ex.items[0], type: 'mc', options: ['is signed', 'signed', 'has signed'], answer: 'was signed' };
    expect(s.safeParse({ items: [mc, ex.items[0], ex.items[0]] }).success).toBe(false);
    const wrongLang = { ...ex.items[0], explanation_de: 'Yesterday shows finished time, so we need the past passive here.' };
    expect(s.safeParse({ items: [wrongLang, ex.items[0], ex.items[0]] }).success).toBe(false);
    const otherTopic = { ...ex.items[0], topic: 'articles' };
    expect(s.safeParse({ items: [otherTopic, ex.items[0], ex.items[0]] }).success).toBe(false);
  });

  it('lesson-content@1: gültige Lektion; Refinements greifen', () => {
    const s = lessonContent.schema(contentVars);
    const r = s.safeParse(L01_CONTENT);
    expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true);
    const missingWord = { ...L01_CONTENT, dialogue: { ...L01_CONTENT.dialogue, lines: L01_CONTENT.dialogue.lines.map((l) => ({ ...l, en: l.en.replace('agenda', 'plan') })) } };
    expect(s.safeParse(missingWord).success).toBe(false);
    const q0 = L01_CONTENT.questions[0]!;
    const badQ = { ...L01_CONTENT, questions: [{ ...q0, answer: 'Nichts davon' }, L01_CONTENT.questions[1]] };
    expect(s.safeParse(badQ).success).toBe(false);
    const wrongLangQ = { ...L01_CONTENT, questions: [{ ...q0, q: 'What has Ben been working on for two weeks?' }, L01_CONTENT.questions[1]] };
    expect(s.safeParse(wrongLangQ).success).toBe(false);
    const doc = toLessonDoc(L01_CONTENT, contentVars, 1000);
    expect(validateDoc('lesson/l01', doc).ok).toBe(true);
    expect((doc.tasks as Array<Record<string, unknown>>)[0]!.src).toBe('lesson');
  });

  it('lesson-production@1 und writing-Dokument', () => {
    const s = lessonProduction.schema(productionVars);
    const ex = JSON.parse(LESSON_PRODUCTION_EXAMPLE) as Record<string, unknown>;
    const valid = { ...ex, mustUsed: ['agenda'], model: 'Good morning, everyone. Here is the agenda for today.', candoWhy: 'Das Ziel ist teilweise erreicht.', errors: [], upgrades: [] };
    const r = s.safeParse(valid);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(s.safeParse({ ...valid, mustUsed: ['banana'] }).success).toBe(false);
    expect(s.safeParse({ ...valid, candoWhy: 'The goal is partly met because the text is short.' }).success).toBe(false);
    const w = toWritingDoc({ lid: 'l07', text: productionVars.text, t: 1790497100000, out: s.parse(valid) });
    expect(w.path).toBe('writing/lesson-l07-1790497100000');
    expect(validateDoc(w.path, w.doc).ok).toBe(true);
  });
});

describe('Größen und Prompt-Freiheit', () => {
  it('maximale Eingaben bleiben unter 60.000 Bytes', () => {
    const huge = 'x'.repeat(100_000);
    const big = [
      grammarJudge.build({ ...judgeVars, prompt: huge, answer: huge, given: huge, accepted: [huge, huge, huge] }),
      grammarItems.build({ ...itemsVars, ruleEn: huge, examples: Array(20).fill(huge), seenText: Array(40).fill(huge), errors: Array(10).fill({ q: huge, given: huge, ans: huge }) }),
      lessonContent.build({ ...contentVars, ruleEn: huge, grammarName: huge, meta: { ...meta, situation: huge, cando_en: huge } }),
      lessonProduction.build({ ...productionVars, text: huge, taskEn: huge, candoEn: huge, mustUse: Array(10).fill(huge) }),
    ];
    for (const p of big) expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('kein Prompt-Text in features/ (U-PROMPT-06 erweitert)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(new URL('../../src/features', import.meta.url).pathname);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Reply with only|You write|You judge|You give feedback/);
  });
});
