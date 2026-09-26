import type { ZodType } from 'zod';
import {
  articleSchema,
  assessSchema,
  chatSchema,
  chunkSchema,
  courseSchema,
  dailySchema,
  feedSchema,
  grammarSchema,
  lessonSchema,
  logSchema,
  lookupSchema,
  lpoolSchema,
  poolSchema,
  preplySchema,
  profileSchema,
  radarSchema,
  readingSchema,
  sceneSchema,
  schemaDocSchema,
  talkSchema,
  bizSchema,
  vocabSchema,
  wpromptSchema,
  writingSchema,
} from './schemas';

// Alle bekannten Pfade der Datenbank (Anhang B + docs/altapp-analyse.md, Abschnitt 5).

export const APP_DOCS = {
  'app/profile': profileSchema,
  'app/course': courseSchema,
  'app/assess': assessSchema,
  'app/radar': radarSchema,
  'app/pool': poolSchema,
  'app/chat': chatSchema,
  'app/lookup': lookupSchema,
  'app/schema': schemaDocSchema,
} as const satisfies Record<string, ZodType>;

export const COLLECTIONS = {
  vocab: vocabSchema,
  grammar: grammarSchema,
  lesson: lessonSchema,
  log: logSchema,
  daily: dailySchema,
  feed: feedSchema,
  writing: writingSchema,
  chunk: chunkSchema,
  scene: sceneSchema,
  preply: preplySchema,
  articles: articleSchema,
  reading: readingSchema,
  lpool: lpoolSchema,
  wprompt: wpromptSchema,
  // Neu ab Phase 3 (Plan §3.1): Monatsdokumente für Gespräche und Business-Einheiten.
  talk: talkSchema,
  biz: bizSchema,
} as const satisfies Record<string, ZodType>;

export type AppDocPath = keyof typeof APP_DOCS;
export type CollectionName = keyof typeof COLLECTIONS;

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];
export const APP_DOC_PATHS = Object.keys(APP_DOCS) as AppDocPath[];

/**
 * Pfade, die nur der Claude-Tagesauftrag schreibt (Kap. 6.9, Kap. 9 Regel 4).
 * Der Schreibpfad der App verweigert jeden Schreibzugriff darauf.
 */
export const READ_ONLY_COLLECTIONS: readonly CollectionName[] = ['daily', 'feed'];

const SEGMENT_RE = /^[A-Za-z0-9_\-.~:@+]+$/;

/** Dokumentpfad nach der Grammatik aus contract/db.d.ts (gerade Segmentzahl, erlaubte Zeichen). */
export function isDocPath(path: string): boolean {
  const segs = path.split('/');
  return (
    segs.length % 2 === 0 &&
    segs.length <= 16 &&
    new TextEncoder().encode(path).length <= 1000 &&
    segs.every((s) => s !== '.' && s !== '..' && SEGMENT_RE.test(s) && new TextEncoder().encode(s).length <= 200)
  );
}

export function collectionOf(path: string): string {
  const i = path.indexOf('/');
  return i === -1 ? path : path.slice(0, i);
}

export function isReadOnlyPath(path: string): boolean {
  const c = collectionOf(path);
  return (READ_ONLY_COLLECTIONS as readonly string[]).includes(c) && path.split('/').length === 2;
}

export function schemaForPath(path: string): ZodType | null {
  if (Object.hasOwn(APP_DOCS, path)) return APP_DOCS[path as AppDocPath];
  const segs = path.split('/');
  if (segs.length !== 2) return null;
  const c = segs[0] as CollectionName;
  return Object.hasOwn(COLLECTIONS, c) ? COLLECTIONS[c] : null;
}
