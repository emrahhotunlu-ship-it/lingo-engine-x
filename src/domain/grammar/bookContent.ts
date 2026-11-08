import { z } from 'zod';
import bookRaw from '../../content/grammar/book.json?raw';
import { logError } from '../../platform/diagnostics';
import { topicById } from '../content';
import type { GrammarTask } from '../learn/types';
import { legacyTaskKey } from './key';
import { TaskWhySchema } from './patternTypes';

// Inhalte des Grammatik-Buchs (Übung A/B, content/grammar/book.json) – eigene Datei ohne Abhängigkeit von tasks.ts, damit auch die
// Tagesrunden (`allSeedTasks`) die Buch-Aufgaben nutzen können (Emrah 08.11.2026: Lücken und Auswahl für alle 47 Themen).

export const BookTaskSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  pat: z.string().min(1),
  part: z.enum(['A', 'B']),
  type: z.enum(['gap', 'mc']),
  prompt: z.string().includes('___'),
  hint: z.string().nullish(),
  answer: z.string().min(1),
  accepted: z.array(z.string()).default([]),
  options: z.array(z.string()).length(3).optional(),
  why: TaskWhySchema,
});
const BookFileSchema = z.object({ v: z.literal(1), tasks: z.array(BookTaskSchema) });
export type BookTask = z.infer<typeof BookTaskSchema>;

let cache: readonly BookTask[] | null = null;
/** Alle Buch-Aufgaben (A und B), optional eines Themas. Eine kaputte Datei liefert eine leere Liste (protokolliert). */
export function bookTasks(topic?: string): readonly BookTask[] {
  if (!cache) {
    try {
      const r = BookFileSchema.safeParse(JSON.parse(bookRaw));
      if (!r.success) logError('grammar:book', r.error, 'book.json');
      cache = r.success ? r.data.tasks.filter((t) => !!topicById(t.topic)) : [];
    } catch (err) {
      logError('grammar:book', err, 'book.json');
      cache = [];
    }
  }
  return topic ? cache.filter((t) => t.topic === topic) : cache;
}

/** Buch-Aufgabe als Aufgabe der Runde (Lücke bzw. Auswahl; die Begründung trägt die Fehler-Karte ohne Claude). */
export function bookToTask(b: BookTask): GrammarTask {
  return {
    key: legacyTaskKey(b.prompt),
    topic: b.topic,
    type: b.type,
    prompt: b.prompt,
    answer: b.answer,
    accepted: [...b.accepted],
    options: b.type === 'mc' && b.options ? [...b.options] : null,
    hint: b.hint ?? null,
    expl: { de: b.why.ok.de, en: b.why.ok.en },
    src: 'seed',
    ref: `content/grammar/book#${b.id}`,
    errorT: null,
    pat: b.pat,
    why: b.why,
  };
}

