import type { ArticleItem, Cefr, Domain, ListeningItem, TextError, UsHint, WritingPrompt } from './types';

// Dokument-Bauer für Phase 4 (Plan §3.3–3.7): reine Funktionen, Altformat plus additive
// Felder. Geschrieben wird nur über den einen Writer (features/input/complete.ts).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Readonly<Doc> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type GeneratedQuestion = { q: string; options: string[]; answer: string; type: string; explain_de: string; explain_en: string };

export type GeneratedArticle = {
  title: string;
  topic: string;
  topic_de: string;
  topic_en: string;
  teaser: string;
  text: string;
  keypoints: string[];
  glossary: Array<{ w: string; de: string; def: string }>;
  questions: GeneratedQuestion[];
};

/** `articles/ai<t>` (Plan §3.3). `src` = `ai` (erzeugt) oder `own` (eigener Text, M16). */
export function articleDoc(a: GeneratedArticle, i: { t: number; level: Cefr; domain: Domain; pv: string; src: 'ai' | 'own' }): Doc {
  const id = `ai${i.t}`;
  return {
    id,
    level: i.level,
    topic: a.topic,
    topic_de: a.topic_de,
    topic_en: a.topic_en,
    title: a.title,
    teaser: a.teaser,
    text: a.text,
    keypoints: [...a.keypoints],
    glossary: a.glossary.map((g) => ({ ...g })),
    questions: a.questions.map((q) => ({ ...q, options: [...q.options] })),
    domain: i.domain,
    src: i.src,
    t: i.t,
    pv: i.pv,
  };
}

export type GeneratedListening = {
  title: string;
  genre: string;
  topic_de: string;
  topic_en: string;
  text: string;
  questions: GeneratedQuestion[];
  vocab: Array<{ w: string; de: string; def: string }>;
};

/** `lpool/ai<t>` (Plan §3.4). */
export function lpoolDoc(l: GeneratedListening, i: { t: number; level: Cefr; domain: Domain; pv: string }): Doc {
  return {
    level: i.level,
    topic_de: l.topic_de,
    topic_en: l.topic_en,
    title: l.title,
    genre: l.genre,
    text: l.text,
    questions: l.questions.map((q) => ({ ...q, options: [...q.options] })),
    vocab: l.vocab.map((v) => ({ ...v })),
    domain: i.domain,
    src: 'ai',
    t: i.t,
    pv: i.pv,
  };
}

/** `reading/r<t>` beim Abschluss der Fragen (Plan §3.5). Zusammenfassung folgt später per Ergänzung. */
export function readingDoc(i: { t: number; day: string; item: Pick<ArticleItem, 'id' | 'ref' | 'title' | 'level' | 'domain'>; n: number; ok: number; readSec: number }): Doc {
  return {
    t: i.t,
    date: i.day,
    articleId: i.item.id,
    title: i.item.title,
    level: i.item.level,
    summary: '',
    words: 0,
    readSec: Math.max(0, Math.round(i.readSec)),
    quiz: { n: i.n, ok: i.ok },
    domain: i.item.domain,
    ref: i.item.ref,
  };
}

export type ReadingCheckRes = {
  score: number;
  covered: string[];
  misunderstood: string[];
  language: { cefr: string; errors: Array<{ orig: string; fix: string; cat: string; why: string }>; tips: string[] };
  feedback: string;
  model_summary: string;
};

/** Ergänzung der Zusammenfassung (mit oder ohne KI-Prüfung). */
export function readingSummaryPatch(summary: string, words: number, res: (ReadingCheckRes & { lang: 'de' | 'en'; pv: string }) | null): Doc {
  const out: Doc = { summary, words };
  if (res) out.res = { ...res, language: { ...res.language, errors: res.language.errors.map((e) => ({ ...e })), tips: [...res.language.tips] } };
  return out;
}

/** `wprompt/<tag>` (Plan §3.6). */
export function wpromptDoc(p: Doc, t: number): Doc {
  return { p, t };
}

/** `writing/w<t>` bei der ersten Abgabe (Plan §3.7). */
export function writingDoc(i: { t: number; day: string; prompt: WritingPrompt; text: string; words: number; lang: 'de' | 'en' }): Doc {
  return {
    id: `w${i.t}`,
    date: i.day,
    promptId: i.prompt.id,
    title: i.prompt.title.en,
    task: i.prompt.task.en,
    genre: i.prompt.genre,
    text: i.text,
    words: i.words,
    rev: 0,
    lang: i.lang,
    domain: i.prompt.domain,
    t: i.t,
  };
}

export type WritingReviewRes = {
  cefr: string;
  scores: { task: number; grammar: number; vocabulary: number; coherence: number; register: number };
  summary: string;
  strengths: string[];
  errors: TextError[];
  usHints: UsHint[];
  improved: string;
  upgrades: string[];
  phrases: string[];
  next: string;
};

/** Gespeicherte Rückmeldung (Altform `res`, Fehler ohne `span`) plus `lang`, `pv`. */
export function writingResDoc(res: WritingReviewRes, lang: 'de' | 'en', pv: string): Doc {
  return {
    cefr: res.cefr,
    scores: { ...res.scores },
    summary: res.summary,
    strengths: [...res.strengths],
    errors: res.errors.map((e) => ({ orig: e.orig, fix: e.fix, cat: e.cat, topic: e.topic, sev: e.sev, why: e.why })),
    usHints: res.usHints.map((h) => ({ ...h })),
    improved: res.improved,
    upgrades: [...res.upgrades],
    phrases: [...res.phrases],
    next: res.next,
    lang,
    pv,
  };
}

/** Neuer Stand eines Entdecken-Schritts; `null`, wenn der Schritt schon gesetzt ist (nur einmal). */
export function discPatch(disc: unknown, itemId: string, step: 'prep' | 'take' | 'check' | 'use', day: string): Doc | null {
  const cur = obj(obj(disc)[itemId]);
  if (typeof cur[step] === 'string' && cur[step]) return null;
  return { disc: { [itemId]: { [step]: day } } };
}

/** `gen.{ar,lp,wp}` = Lerntag der letzten KI-Erzeugung; `null`, wenn unverändert. */
export function genPatch(gen: unknown, key: 'ar' | 'lp' | 'wp', day: string): Doc | null {
  return obj(gen)[key] === day ? null : { gen: { [key]: day } };
}

/** Kennung einer Hör-Einheit für `profile.listen[].id` (Altformat: `l1` bzw. `ai<ms>`). */
export const listenId = (item: Pick<ListeningItem, 'id'>): string => item.id;
