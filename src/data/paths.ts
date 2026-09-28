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
  repairSchema,
  patternsSchema,
  readingSchema,
  sceneSchema,
  schemaDocSchema,
  talkSchema,
  saySchema,
  fluencySchema,
  meetingSchema,
  tonesSchema,
  bizSchema,
  vocabSchema,
  weeklySchema,
  wpromptSchema,
  writingSchema,
  archiveSchema,
  decksSchema,
  weekSchema,
  outSchema,
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
  // Neu ab Phase 6: Wochenberichte (Plan §6.2).
  'app/weekly': weeklySchema,
  // Neu (Lernberatung 27.09., V2): Reparatur-Sätze aus Sag es, Gespräch, Schreiben.
  'app/repair': repairSchema,
  // Neu (Lernberatung 27.09., V3): persönliche Deutsch-Fallen (Fehlermuster).
  'app/patterns': patternsSchema,
  // Neubau (docs/neubau/plan.md §4.10): Stapel (P3) und Wochenthema (P1).
  'app/decks': decksSchema,
  'app/week': weekSchema,
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
  // Neu (Lernberatung 27.09., V1/V2): „Sag es“ als Monatsdokumente.
  say: saySchema,
  // Neu (Lernberatung 27.09., V6/V4): Flüssigkeit 90 – 60 – 45 und „Mein nächster Termin“ als Monatsdokumente.
  fluency: fluencySchema,
  meeting: meetingSchema,
  // Neu (Lernberatung 27.09., Vorschlag 8): „Eine Botschaft, drei Tonlagen“ als Monatsdokumente.
  tones: tonesSchema,
  // Neu ab Phase 7 (Plan §12.3): ausgelagerte Profiljahre.
  archive: archiveSchema,
  // Neubau (docs/neubau/plan.md §4.10): Ergebnisse der neuen Übungen als Monatsdokumente (P7).
  out: outSchema,
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
