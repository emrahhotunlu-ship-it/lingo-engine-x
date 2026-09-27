import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, lenientArray } from './common';
import { clipped, firstCefr, loose, sliced } from './tolerant';
import type { PromptTemplate } from './types';

// course-extend@1 (Kap. 6.2 „erweiterbar“): Claude plant die nächste Einheit des Kurses – vier
// Lektionen ab l25 im Format des Lehrplans (Can-Do, Situation aus der Berufswelt, Grammatikthema,
// sechs Zielwörter), passend zu Einschätzung und Fehlerradar. Den Inhalt jeder Lektion (Dialog,
// Aufgaben) erzeugt danach wie bei l01–l24 lesson-content. `default`, nie zwischengespeichert:
// jedes „Kurs erweitern“ plant neu und wird dauerhaft in `lesson/<lid>` gespeichert.

export type CourseExtendVars = {
  /** Berufskontext (`app/profile.ctx` oder Standard). */
  ctx: string;
  /** Nummer der neuen Einheit (7, 8, …). */
  unitN: number;
  /** Gesamtstufe der Einschätzung (z. B. „B2+“) oder null. */
  level: string | null;
  /** Fokus und Blocker der Einschätzung (englisch oder deutsch, gekürzt). */
  focus: string | null;
  blockers: readonly string[];
  /** Schwächste Grammatikthemen (IDs) nach Beherrschung und Fehlerradar, schwächstes zuerst. */
  weakTopics: readonly string[];
  /** Häufigste Fehlerkategorien im Radar (`Kategorie ×Anzahl`). */
  radar: readonly string[];
  /** Alle erlaubten Grammatikthemen `id: Name`. */
  topics: ReadonlyArray<{ id: string; name: string }>;
  /** Titel der schon vorhandenen Lektionen (englisch), damit nichts doppelt kommt. */
  existing: readonly string[];
  /** Verhältnis Beruf/Alltag aus `app/profile.mix` (0–100). */
  mix?: { work: number; life: number } | null;
};

export type CourseExtendLesson = {
  en: string;
  de: string;
  cando_en: string;
  cando_de: string;
  situation: string;
  grammar: string;
  level: string;
  words: Array<[string, string]>;
};

export type CourseExtendOut = {
  unit: { en: string; de: string; goal_en: string; goal_de: string; kind: 'job' | 'life' };
  lessons: CourseExtendLesson[];
};

export const CE_LESSONS = 4;
export const CE_WORDS = 6;
export const CE_LEVELS = ['B2', 'B2+', 'C1'] as const;

const ID = 'course-extend';
const VERSION = 1;

export const COURSE_EXTEND_SHAPE =
  '{"unit":{"en":"<short English unit title>","de":"<same in German>","goal_en":"<what the learner can do after the unit, English, one sentence>","goal_de":"<same in German>","kind":"job|life"},' +
  '"lessons":[{"en":"<short English lesson title>","de":"<same in German>","cando_en":"<I can …, English>","cando_de":"<Ich kann …, German>","situation":"<concrete English scene from the learner\'s work, 2–3 sentences>",' +
  '"grammar":"<one topic id from the list>","level":"B2|B2+|C1","words":[{"en":"<English word or phrase>","de":"<German meaning>"}]}]}';

const en = (min: number, max: number) => clipped(min, max).refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });
const de = (min: number, max: number) => clipped(min, max).refine((s) => !isWrongLang(s, 'de'), { message: 'must be written in German' });

/** Grammatikthema tolerant: ID, Name („Passive voice“) oder ID in anderer Schreibweise → ID. */
export function topicIdOf(v: unknown, topics: CourseExtendVars['topics']): unknown {
  if (typeof v !== 'string') return v;
  const s = loose(v);
  const hit = topics.find((t) => loose(t.id) === s || loose(t.name) === s) ?? topics.find((t) => s.length > 3 && (loose(t.name).startsWith(s) || s.startsWith(loose(t.id))));
  return hit ? hit.id : v;
}

/** Zielwort als Objekt `{en, de}` oder Paar `["en","de"]`. */
const wordPair = z.preprocess(
  (v: unknown) => (Array.isArray(v) && v.length >= 2 ? { en: v[0] as unknown, de: v[1] as unknown } : v),
  z.object({ en: z.string().trim().min(1).max(60), de: z.string().trim().min(1).max(80) }).transform((w): [string, string] => [w.en, w.de]),
);

const schemaFor = (v: CourseExtendVars): z.ZodType<CourseExtendOut> => {
  const ids = v.topics.map((t) => t.id);
  const lesson = z.object({
    en: en(4, 80),
    de: de(4, 80),
    cando_en: en(10, 200),
    cando_de: de(10, 200),
    situation: en(30, 600),
    grammar: z.preprocess((x) => topicIdOf(x, v.topics), z.string().refine((x) => ids.includes(x), { message: `must be one of: ${ids.join(', ')}` })),
    level: z.preprocess((x) => {
      const c = firstCefr(x, CE_LEVELS);
      return c === 'B1+' || c === 'B1' ? 'B2' : c === 'C1+' || c === 'C2' ? 'C1' : c;
    }, z.enum(CE_LEVELS)),
    words: sliced(wordPair, CE_WORDS, CE_WORDS).superRefine((ws, ctx) => {
      const seen = new Set<string>();
      ws.forEach(([w], i) => {
        const k = loose(w);
        if (seen.has(k)) ctx.addIssue({ code: 'custom', path: [i], message: 'words must be distinct' });
        seen.add(k);
      });
    }),
  });
  return z.object({
    unit: z.object({
      en: en(4, 80),
      de: de(4, 80),
      goal_en: en(10, 240),
      goal_de: de(10, 240),
      kind: z.preprocess((x) => (typeof x === 'string' && /life|everyday|alltag|private/i.test(x) ? 'life' : 'job'), z.enum(['job', 'life'])),
    }),
    // Lektionen einzeln prüfen: eine unbrauchbare fällt weg, gescheitert wird erst unter drei.
    lessons: lenientArray(lesson, 3, CE_LESSONS).superRefine((ls, ctx) => {
      const titles = new Set(v.existing.map(loose));
      ls.forEach((l, i) => {
        if (titles.has(loose(l.en))) ctx.addIssue({ code: 'custom', path: [i, 'en'], message: 'title repeats an existing lesson' });
        titles.add(loose(l.en));
      });
    }),
  });
};

export const courseExtend: PromptTemplate<CourseExtendVars, CourseExtendOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const mix = v.mix ? `${Math.round(v.mix.work)}% work, ${Math.round(v.mix.life)}% everyday life` : 'mostly work';
    return [
      header({ id: ID, version: VERSION }),
      'You plan the next unit of a tailored English course for a German native speaker, early B2 aiming for C1.',
      'Use invented names and companies; never state facts about a real company. American English only (US spelling and vocabulary).',
      `Learner's job: ${clip(v.ctx, 300)}`,
      `Unit number: ${v.unitN}`,
      `Current overall level (AI assessment): ${v.level ? clip(v.level, 20) : 'unknown'}`,
      `Assessment focus: ${v.focus ? clip(v.focus, 200) : 'none'}`,
      `Assessment blockers: ${v.blockers.length ? v.blockers.map((b) => clip(b, 120)).join(' | ') : 'none'}`,
      `Weakest grammar topics (weakest first): ${v.weakTopics.length ? v.weakTopics.join(', ') : 'none'}`,
      `Most frequent error categories: ${v.radar.length ? v.radar.join(', ') : 'none'}`,
      `Content mix: ${mix}`,
      `Allowed grammar topics (id: name): ${v.topics.map((t) => `${t.id}: ${clip(t.name, 50)}`).join('; ')}`,
      `Lessons that already exist (do not repeat): ${v.existing.map((t) => clip(t, 60)).join(' | ') || 'none'}`,
      'Reply with only one JSON object of this shape:',
      COURSE_EXTEND_SHAPE,
      'Rules:',
      `- exactly ${CE_LESSONS} lessons that build on each other and on the finished course; each one practices a realistic situation from the learner's job (or everyday life, as the mix says).`,
      '- pick each grammar topic from the allowed ids; prefer the weakest topics and the assessment focus, at most two lessons on the same topic.',
      `- words: exactly ${CE_WORDS} useful words or phrases at B2+/C1 per lesson that fit the situation, not trivial, not repeated across lessons; German meaning short.`,
      '- level: B2, B2+ or C1, rising across the unit.',
      '- German fields (de, cando_de, goal_de) in natural German, English fields in English.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};

/** Beispielantwort (Entwicklungs-Adapter, Tests): vier Lektionen zu den schwächsten Themen. */
export function courseExtendExample(v: Pick<CourseExtendVars, 'unitN' | 'weakTopics' | 'topics'>): CourseExtendOut {
  const pick = (i: number) => v.weakTopics[i % Math.max(1, v.weakTopics.length)] ?? v.topics[i]?.id ?? 'passive';
  const base: Array<Omit<CourseExtendLesson, 'grammar'>> = [
    {
      en: 'Running a quarterly business review',
      de: 'Ein Quartalsgespräch mit dem Kunden führen',
      cando_en: 'I can present results to a customer, explain gaps and agree on priorities for the next quarter.',
      cando_de: 'Ich kann einem Kunden Ergebnisse vorstellen, Lücken erklären und Prioritäten für das nächste Quartal vereinbaren.',
      situation: 'A quarterly business review with a logistics customer that uses the cloud DMS. Adoption in two departments is lower than planned, and the customer wants to know why before renewing.',
      level: 'B2+',
      words: [['adoption rate', 'Nutzungsquote'], ['to fall short of', 'hinter etwas zurückbleiben'], ['to drill down into', 'genauer untersuchen'], ['a quick win', 'ein schneller Erfolg'], ['to renew a contract', 'einen Vertrag verlängern'], ['going forward', 'künftig']],
    },
    {
      en: 'Handling a data protection audit',
      de: 'Eine Datenschutzprüfung begleiten',
      cando_en: 'I can answer an auditor’s questions about data storage precisely and admit what is still open.',
      cando_de: 'Ich kann die Fragen einer Prüferin zur Datenspeicherung genau beantworten und offen sagen, was noch fehlt.',
      situation: 'An external auditor checks how the cloud archive stores invoices and personal data. She asks about retention periods, access logs and where the servers are located.',
      level: 'B2+',
      words: [['retention period', 'Aufbewahrungsfrist'], ['audit trail', 'Prüfpfad'], ['to comply with', 'einhalten'], ['to be accountable for', 'verantwortlich sein für'], ['a remaining gap', 'eine verbleibende Lücke'], ['to the best of my knowledge', 'nach bestem Wissen']],
    },
    {
      en: 'Winning back an unhappy customer',
      de: 'Einen verärgerten Kunden zurückgewinnen',
      cando_en: 'I can acknowledge a failure without over-apologizing and offer a concrete recovery plan.',
      cando_de: 'Ich kann einen Fehler eingestehen, ohne mich zu oft zu entschuldigen, und einen konkreten Plan zur Wiedergutmachung anbieten.',
      situation: 'After two outages in one month, a long-standing customer threatens to cancel. You call the managing director to rebuild trust and propose concrete steps.',
      level: 'C1',
      words: [['to rebuild trust', 'Vertrauen zurückgewinnen'], ['a recovery plan', 'ein Plan zur Wiedergutmachung'], ['to take ownership of', 'Verantwortung übernehmen für'], ['root cause', 'eigentliche Ursache'], ['to make it up to someone', 'es jemandem wiedergutmachen'], ['service credit', 'Gutschrift']],
    },
    {
      en: 'Presenting the product roadmap',
      de: 'Die Produkt-Roadmap vorstellen',
      cando_en: 'I can present future plans with the right degree of certainty and handle critical questions.',
      cando_de: 'Ich kann künftige Pläne mit der passenden Sicherheit vorstellen und auf kritische Fragen eingehen.',
      situation: 'At a partner event you present the roadmap for the cloud DMS: e-invoice validation, a mobile app and new interfaces. Partners ask which dates are firm.',
      level: 'C1',
      words: [['roadmap', 'Produktfahrplan'], ['tentatively scheduled', 'vorläufig geplant'], ['to prioritize', 'priorisieren'], ['subject to change', 'vorbehaltlich Änderungen'], ['a firm commitment', 'eine feste Zusage'], ['down the line', 'später einmal']],
    },
  ];
  return {
    unit: {
      en: 'Owning the customer relationship',
      de: 'Die Kundenbeziehung verantworten',
      goal_en: 'Lead demanding customer conversations on results, risks and plans with precision and calm.',
      goal_de: 'Anspruchsvolle Kundengespräche über Ergebnisse, Risiken und Pläne präzise und ruhig führen.',
      kind: 'job',
    },
    lessons: base.map((l, i) => ({ ...l, grammar: pick(i) })),
  };
}
