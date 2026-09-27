import passages from '../../content/legacy/passages.json';
import { levelOr, parseCefr } from './level';
import { docDomain, LEGACY_DOMAIN } from './mix';
import { keypointQuestions } from './keypointQuiz';
import { normalizeQuestions } from './questions';
import type { ArticleItem, Cefr, GlossEntry, ListeningItem, Question, WritingPrompt } from './types';

// Inhalte für Lesen, Hören und Schreiben aus zwei Quellen (Plan F1): gespeicherte Dokumente
// (`articles/*`, `lpool/*`, `wprompt/*`) und der Startbestand aus passages.json. Der
// Startbestand ist Daten, er wird nie in die Datenbank kopiert.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

const FALLBACK: Cefr = 'B2';

function gloss(v: unknown): GlossEntry[] {
  if (!Array.isArray(v)) return [];
  const out: GlossEntry[] = [];
  for (const raw of v) {
    const g = obj(raw);
    const w = str(g.w) || str(g.en) || str(g.word);
    if (!w) continue;
    const e: GlossEntry = { w };
    if (str(g.de)) e.de = str(g.de);
    if (str(g.def)) e.def = str(g.def);
    out.push(e);
  }
  return out;
}

function topicOf(doc: Doc): { de?: string; en?: string } {
  const t: { de?: string; en?: string } = {};
  if (str(doc.topic_de)) t.de = str(doc.topic_de);
  if (str(doc.topic_en)) t.en = str(doc.topic_en);
  return t;
}

// ---------------------------------------------------------------- Lesen

export function articleFromDoc(id: string, doc: Doc, origin: 'db' | 'legacy' = 'db'): ArticleItem | null {
  const text = str(doc.text);
  const title = str(doc.title);
  if (!text || !title) return null;
  const ref = origin === 'db' ? `articles/${id}` : `legacy:${id}`;
  const item: ArticleItem = {
    ref,
    id,
    level: levelOr(doc.level, FALLBACK),
    domain: origin === 'legacy' ? (LEGACY_DOMAIN[id] ?? docDomain(doc)) : docDomain(doc),
    title,
    topic: topicOf(doc),
    text,
    keypoints: strList(doc.keypoints),
    glossary: gloss(doc.glossary),
    questions: normalizeQuestions(doc.questions, ref),
    origin,
  };
  if (str(doc.teaser)) item.teaser = str(doc.teaser);
  return item;
}

export const LEGACY_ARTICLES: readonly ArticleItem[] = (passages.articles as unknown[])
  .map((a) => articleFromDoc(str(obj(a).id), obj(a), 'legacy'))
  .filter((a): a is ArticleItem => a !== null);

/** Fragen eines Artikels: eigene, sonst lokale Kernaussage-Fragen (F16). Höchstens vier. */
export function articleQuestions(item: ArticleItem, pool: readonly ArticleItem[]): Question[] {
  if (item.questions.length) return item.questions.slice(0, 4);
  return keypointQuestions(item, [...pool, ...LEGACY_ARTICLES]);
}

// ---------------------------------------------------------------- Hören

export function listeningFromDoc(id: string, doc: Doc, origin: 'db' | 'legacy' = 'db'): ListeningItem | null {
  const text = str(doc.text);
  const title = str(doc.title);
  if (!text || !title) return null;
  const ref = origin === 'db' ? `lpool/${id}` : `legacy:${id}`;
  return {
    ref,
    id,
    level: levelOr(doc.level, FALLBACK),
    domain: origin === 'legacy' ? (LEGACY_DOMAIN[id] ?? docDomain(doc)) : docDomain(doc),
    title,
    genre: str(doc.genre) || 'podcast',
    text,
    topic: topicOf(doc),
    questions: normalizeQuestions(doc.questions, ref).slice(0, 4),
    vocab: gloss(doc.vocab),
    origin,
  };
}

export const LEGACY_LISTENING: readonly ListeningItem[] = (passages.listen as unknown[])
  .map((l) => listeningFromDoc(str(obj(l).id), obj(l), 'legacy'))
  .filter((l): l is ListeningItem => l !== null);

// ---------------------------------------------------------------- Schreiben

export function promptFromDoc(raw: unknown): WritingPrompt | null {
  const p = obj(raw);
  const id = str(p.id);
  const titleDe = str(p.title_de);
  const titleEn = str(p.title_en);
  const taskEn = str(p.task_en);
  const taskDe = str(p.task_de);
  if (!id || !(titleDe || titleEn) || !(taskEn || taskDe)) return null;
  const w = Array.isArray(p.words) ? p.words.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [];
  const min = Math.max(20, Math.round(w[0] ?? 80));
  const max = Math.max(min + 10, Math.round(w[1] ?? min + 50));
  const focus: WritingPrompt['focus'] = {};
  if (str(p.focus_de)) focus.de = str(p.focus_de);
  if (str(p.focus_en)) focus.en = str(p.focus_en);
  return {
    id,
    genre: str(p.genre) || 'email',
    level: parseCefr(p.level) ?? FALLBACK,
    domain: p.domain === 'work' || p.domain === 'life' ? p.domain : (LEGACY_DOMAIN[id] ?? 'work'),
    title: { de: titleDe || titleEn, en: titleEn || titleDe },
    task: { de: taskDe || taskEn, en: taskEn || taskDe },
    words: [min, max],
    focus,
    useful: strList(p.useful).slice(0, 8),
    src: p.src === 'ai' ? 'ai' : 'seed',
  };
}

export const LEGACY_PROMPTS: readonly WritingPrompt[] = (passages.write as unknown[]).map(promptFromDoc).filter((p): p is WritingPrompt => p !== null);

/** Gespeicherte Form einer Aufgabe in `wprompt/<tag>.p` (Altformat plus `domain`). */
export function promptToDoc(p: WritingPrompt): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    genre: p.genre,
    level: p.level,
    title_de: p.title.de,
    title_en: p.title.en,
    task_en: p.task.en,
    task_de: p.task.de,
    words: [p.words[0], p.words[1]],
    focus_de: p.focus.de ?? '',
    focus_en: p.focus.en ?? '',
    useful: [...p.useful],
    src: p.src,
    domain: p.domain,
  };
  return out;
}
