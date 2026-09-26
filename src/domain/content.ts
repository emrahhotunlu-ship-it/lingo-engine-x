import courseJson from '../content/legacy/course.json';
import grammarJson from '../content/legacy/grammar.json';
import vocabJson from '../content/legacy/vocab.json';

// Voreinstellungen der alten App als Daten (CLAUDE.md A6.11): Lehrplan, Grammatikthemen,
// Startvokabeln. Die alte App hielt sie im Code und legte die Datenbank darüber.
// Hier gilt dasselbe: ein Dokument in der Datenbank gewinnt immer vor der Voreinstellung.

export type Unit = { id: string; n: number; de: string; en: string; kind: 'job' | 'life'; goal_de: string; goal_en: string };
export type Lesson = {
  id: string;
  unit: string;
  grammar: string;
  level: string;
  de: string;
  en: string;
  cando_de: string;
  cando_en: string;
  situation: string;
  words: Array<[string, string]>;
};
export type LessonStep = { id: string; k: string; icon: string; min: number };
export type Topic = {
  id: string;
  group: string;
  level: string;
  p0: number;
  name: string;
  name_en?: string;
  rule?: string;
  ex?: string[];
};
export type SeedWord = { w: string; p: string; de: string; def: string; ex: string; l?: string };

export const UNITS = courseJson.units as Unit[];
export const LESSONS = courseJson.lessons as Lesson[];
export const LESSON_STEPS = courseJson.lessonSteps as LessonStep[];
export const TOPICS = grammarJson.topics as Topic[];
export const GROUP_EN = grammarJson.groupEn as Record<string, string>;
export const SEED_VOCAB = vocabJson.seedVocab as SeedWord[];
const COLLOC = vocabJson.colloc as Record<string, unknown[]>;

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const topicById = (id: string): Topic | undefined => TOPICS.find((t) => t.id === id);

/** Kartenkennung aus einem Wort – identisch zur alten App, damit Dokumentpfade übereinstimmen. */
export function slug(word: string): string {
  return String(word)
    .toLowerCase()
    .replace(/^to\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Startkarte wie in der alten App (`seedCard`), solange es kein Dokument `vocab/<id>` gibt. */
export function seedCard(s: SeedWord, order: number): Record<string, unknown> & { id: string; word: string } {
  const id = slug(s.w);
  return {
    id,
    word: s.w,
    pos: s.p,
    de: s.de,
    def: s.def,
    ex: s.ex,
    col: COLLOC[id] ?? [],
    level: s.l ?? 'B2',
    state: 'new',
    S: 0,
    D: 5,
    last: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    modes: {},
    order,
    src: 'seed',
  };
}

/** Grammatikthema ohne Dokument: Startwerte wie in der alten App (`defaultTopic`). */
export function defaultTopic(t: Topic): Record<string, unknown> & { id: string } {
  return { id: t.id, p: t.p0, n: 0, c: 0, last: 0, hist: [], errors: [], seen: [], seenText: [] };
}
