import { z } from 'zod';
import { MEMORY_FACT_MAX, MEMORY_PER_SOURCE, cleanFact } from '../domain/memory/memory';
import { block, clip, header, langName } from './common';
import type { PromptTemplate, UiLang } from './types';

// memory-extract@1 (Backlog B5, markt DU5): Nach einem Gespräch zieht Claude bis zu 5 kurze Fakten
// über den Lerner (Termine, Menschen, Projekte, Vorlieben), die in späteren Gesprächen helfen. Nur auf
// Knopfdruck („Merken“), `quick`, fünf Minuten zwischengespeichert. Die Fakten stehen in der
// Oberflächensprache (Sprachtreue, Kap. 10) und landen in `app/memory` (sichtbar und löschbar).

export type MemoryExtractVars = {
  uiLang: UiLang;
  /** Gesprächsverlauf als Zeilen „Learner: …“ / „Coach: …“, ≤ TRANSCRIPT_MAX Zeichen. */
  transcript: string;
  /** Schon gemerkte Fakten (keine Dubletten). */
  known: readonly string[];
};
export type MemoryExtractOut = { facts: string[] };

export const MEMORY_TRANSCRIPT_MAX = 8_000;
const ID = 'memory-extract';
const VERSION = 1;

export const MEMORY_EXTRACT_EXAMPLE = '{"facts":["…","…"]}';

const factSchema = z.preprocess((v) => (typeof v === 'string' ? cleanFact(v) : v), z.string().min(3).max(MEMORY_FACT_MAX));

const schemaFor = (): z.ZodType<MemoryExtractOut> =>
  z.object({
    // Mehr als 5 Fakten: kürzen statt verwerfen (die ersten zählen).
    facts: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, MEMORY_PER_SOURCE) : v), z.array(factSchema).max(MEMORY_PER_SOURCE)),
  });

export const memoryExtract: PromptTemplate<MemoryExtractVars, MemoryExtractOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: true,
  build(v) {
    const known = v.known.slice(0, 20).map((f) => `- ${clip(f, MEMORY_FACT_MAX)}`);
    return [
      header({ id: ID, version: VERSION }),
      'You help an English coach remember the learner (a German-speaking professional, B2 aiming for C1) between conversations.',
      `From the conversation below, pick at most ${MEMORY_PER_SOURCE} short facts about the LEARNER that will help in later conversations:`,
      'upcoming events with dates, people and roles they deal with, projects, goals, preferences, recurring difficulties they mention.',
      'Only facts the learner said or clearly confirmed. No facts about the coach, no grammar corrections, no guesses, no sensitive details (health, passwords, money amounts).',
      `Write each fact as one short sentence in ${langName(v.uiLang)} (max. ${MEMORY_FACT_MAX} characters). Keep English names and terms as they are.`,
      'If nothing is worth remembering, return an empty list.',
      known.length ? `Already remembered (do not repeat):\n${known.join('\n')}` : 'Already remembered: (nothing yet)',
      'Conversation:',
      '<<<',
      block(v.transcript, MEMORY_TRANSCRIPT_MAX),
      '>>>',
      'Reply with only one JSON object:',
      MEMORY_EXTRACT_EXAMPLE,
    ].join('\n');
  },
  schema: () => schemaFor(),
};
