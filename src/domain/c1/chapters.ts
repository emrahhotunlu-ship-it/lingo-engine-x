import programRaw from '../../content/c1/program.json?raw';
import { logError } from '../../platform/diagnostics';
import { TOPICS } from '../content';
import { ProgramFileSchema, type ProgramChapter } from './programTypes';

// Die sieben Kapitel des C1-Programms (Lernplattform 3.0 §4.1, P31). Die Datei ist als Text eingebettet und wird erst beim ersten Gebrauch
// geparst. Ist sie ungültig, wird das protokolliert und das Programm ist leer (die Oberfläche zeigt dann nichts statt etwas Falschem).

let cache: readonly ProgramChapter[] | null = null;
let pending: Readonly<Record<string, { de: string; en: string }>> = {};

/** Die Kapitel in Reihenfolge (leer, wenn `program.json` ungültig ist). */
export function programChapters(): readonly ProgramChapter[] {
  if (cache) return cache;
  try {
    const r = ProgramFileSchema.safeParse(JSON.parse(programRaw));
    if (!r.success) logError('c1:program', r.error, 'program.json');
    cache = r.success ? r.data.chapters : [];
    pending = r.success ? r.data.pending : {};
  } catch (err) {
    logError('c1:program', err, 'program.json');
    cache = [];
  }
  return cache;
}

/** Kapitel nach Kennung (`k1` bis `k7`) oder Nummer (1 bis 7). */
export function chapterById(id: string | number): ProgramChapter | null {
  return programChapters().find((c) => (typeof id === 'number' ? c.n === id : c.id === id)) ?? null;
}

/** Index (0-basiert) des Kapitels, zu dem ein Thema gehört; `-1`, wenn das Thema in keinem Kapitel steht. */
export function chapterIndexOf(topic: string): number {
  return programChapters().findIndex((c) => c.topics.includes(topic));
}

/** Gibt es zu dem Thema schon Inhalte? Neue Themen des Programms (Platzhalter) fehlen in den Inhalten bis P36/P37. */
export function topicExists(topic: string): boolean {
  return TOPICS.some((t) => t.id === topic);
}

/** Themen eines Kapitels, zu denen es schon Inhalte gibt, in Lehrreihenfolge. */
export function liveTopics(ch: ProgramChapter): string[] {
  return ch.topics.filter(topicExists);
}

/** Alle Themen des Programms in Kapitelreihenfolge (auch Platzhalter). */
export function programTopics(): string[] {
  return programChapters().flatMap((c) => c.topics);
}

/** Anzeigename eines Platzhalter-Themas (Thema, das es noch nicht gibt); `null`, wenn keiner hinterlegt ist. */
export function pendingName(topic: string, lang: 'de' | 'en'): string | null {
  programChapters();
  return pending[topic]?.[lang] ?? null;
}
