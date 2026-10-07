import { z } from 'zod';

// Form von `content/c1/program.json` (Lernplattform 3.0 §4.1, P31): die sieben Kapitel des C1-Programms. Reiner Inhalt, kein Nutzerdatum.

const Bi = z.object({ de: z.string().min(1), en: z.string().min(1) });

export const ProgramChapterSchema = z.object({
  id: z.string().regex(/^k[1-7]$/),
  /** Nummer 1 bis 7 (Reihenfolge im Programm). */
  n: z.number().int().min(1).max(7),
  name: Bi,
  /** Alle Themen des Kapitels in Lehrreihenfolge, auch die, die es noch nicht gibt (Platzhalter bis P36/P37). */
  topics: z.array(z.string()).min(1),
  /** „Abgeschlossen heißt …“. */
  done: Bi,
  /** Filter für das Wortpaket: Einträge von `pack.json` mit diesem `ch`. */
  pack: z.object({ ch: z.number().int().min(1).max(7) }),
  /** Prüfungsfokus: welche Teile von Use of English das Kapitel besonders übt (1 bis 4). */
  exam: z.object({ parts: z.array(z.number().int().min(1).max(4)).min(1), focus: Bi }),
  /** Kapitel-Notiz für den Lehrer (Englisch, zum Kopieren). */
  note: z.string().min(1),
  /** Modellrechnung in Wochen (keine Messung). */
  weeks: z.number().positive(),
  /** Einsatz-Satz („Wozu brauchst du das?“): kommt mit P42 nach Prüfung durch den Englischlehrer. */
  use: Bi.optional(),
});

export const ProgramFileSchema = z.object({ v: z.literal(1), chapters: z.array(ProgramChapterSchema).length(7) });

export type ProgramChapter = z.infer<typeof ProgramChapterSchema>;
export type ProgramFile = z.infer<typeof ProgramFileSchema>;
