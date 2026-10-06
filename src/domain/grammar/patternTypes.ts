import { z } from 'zod';
import type { TaskWhy } from '../explain/types';

// Datenmodell der Grammatik-Muster (Lernplattform 2.0, docs/umbau/lernplattform-2.md §3.2–§3.5).
// Ein Muster ist die kleinste Lerneinheit: Formel, Signalwörter, Beispiele, typischer Fehler Deutscher mit
// deutscher Ursache, Kontrast und Verständnisfrage. Jede Aufgabe zeigt auf genau ein Muster (`pat`).

const Bi = z.object({ de: z.string().min(1), en: z.string().min(1) });
/** Muster-Kennung, z. B. `mc.wish-past`. Wird nie geändert (steht in `pats`, Fehlereinträgen und `pattern-map.json`). */
export const PatternId = z.string().regex(/^[a-z0-9]{2,6}\.[a-z0-9-]{2,32}$/);
const Ctx = z.enum(['meeting', 'mail', 'talk']);

export const PatternSchema = z.object({
  id: PatternId,
  /** „wish + Past Perfect · Bedauern über früher“ */
  name: Bi,
  /** Formel; Fachwörter zweisprachig (Sprachtreue, Kap. 10). */
  form: Bi,
  /** Wofür, 1–2 Sätze. */
  use: Bi,
  /** Echte Signalwörter im Satz, keine Formeln. */
  signals: z.array(z.string()).max(8),
  ex: z.array(z.object({ en: z.string(), de: z.string().optional(), ctx: Ctx })).min(2).max(3),
  /** Typischer Fehler mit deutscher Ursache. */
  trap: z.object({ bad: z.string(), good: z.string(), cause: Bi }),
  contrast: z.object({ with: z.string(), a: z.string(), b: z.string(), diff: Bi }).optional(),
  /** Verständnisfrage (concept checking question). */
  ccq: z.array(z.object({ s: z.string(), q: Bi, a: z.boolean() })).min(1).max(2),
  /** Leitfrage für den Tipp und den Zweitversuch, verrät die Lösung nicht. */
  nudge: Bi,
  usNote: Bi.optional(),
});

export const TopicPatternsSchema = z.object({
  topic: z.string(),
  canDo: Bi,
  order: z.array(PatternId).min(1),
  /** Einführung über mehrere Tage: höchstens 2 Muster je Schritt. */
  introPlan: z.array(z.array(PatternId).min(1).max(2)).min(1),
  decide: z.object({ de: z.array(z.string()).min(2).max(3), en: z.array(z.string()).min(2).max(3) }),
  patterns: z.array(PatternSchema).min(1).max(8),
});

export const WhyRuleSchema = z.object({
  if: z.array(z.string()).optional(),
  not: z.array(z.string()).optional(),
  opt: z.string().optional(),
  tap: z.string().optional(),
  pat: z.string().optional(),
  de: z.string().max(140),
  en: z.string().max(140),
});
export const TaskWhySchema = z.object({ ok: Bi, wrong: z.array(WhyRuleSchema).max(4) }) satisfies z.ZodType<TaskWhy>;

/** Zuordnung vorhandener Aufgaben (§3.3). Schlüssel: `${topic}|${legacyTaskKey(prompt)}`. */
export const PatternMapSchema = z.record(
  z.string(),
  z.object({
    pat: PatternId,
    why: TaskWhySchema.optional(),
    /** Beinahe-Doppel: Schlüssel der Hauptaufgabe. */
    dup: z.string().optional(),
  }),
);

/** Neue Aufgabenarten (§3.4). */
const Base = { id: z.string(), topic: z.string(), pat: PatternId, why: TaskWhySchema };
export const V2TaskSchema = z.discriminatedUnion('type', [
  z.object({
    ...Base,
    type: z.literal('kwt'),
    /** Ausgangssatz */
    from: z.string(),
    /** SCHLÜSSELWORT, unverändert und ausgeschrieben */
    key: z.string().regex(/^[A-Z]+$/),
    /** Rahmensatz mit genau einer Lücke */
    frame: z.string().includes('___'),
    answer: z.string(),
    accepted: z.array(z.string()).default([]),
    /** Erlaubte Wortzahl in der Lücke (von, bis). */
    words: z.tuple([z.number().int().min(1), z.number().int().max(6)]),
  }),
  z.object({
    ...Base,
    type: z.literal('find'),
    prompt: z.string(),
    /** Wortbereich [von, bis] (0-basiert, einschließlich) oder `null` = fehlerfrei. */
    err: z.tuple([z.number().int(), z.number().int()]).nullable(),
    /** Ersatz für den Bereich (leer = streichen). Fehlt bei fehlerfreien Sätzen. */
    answer: z.string().optional(),
    /** Der ganze richtige Satz (Anzeige und Prüfung); fehlt bei fehlerfreien Sätzen. */
    fixed: z.string().optional(),
    accepted: z.array(z.string()).default([]),
  }),
  z.object({
    ...Base,
    type: z.literal('meaning'),
    a: z.string(),
    b: z.string(),
    q: Bi,
    answer: z.enum(['a', 'b', 'both']),
  }),
]);
export const V2FileSchema = z.object({ v: z.literal(1), tasks: z.array(V2TaskSchema) });

/** Pfad, Kapitel und Kontrastfamilien (§3.5). */
export const PathFileSchema = z.object({
  chapters: z.array(z.object({ id: z.string(), name: Bi, topics: z.array(z.string()).min(1) })).length(7),
  families: z.array(z.array(z.string()).min(2).max(4)),
});

/** Stillgelegte Aufgaben (§3.9): Schlüssel `${topic}|${legacyTaskKey}`. */
export const RetiredFileSchema = z.object({
  v: z.literal(1),
  retired: z.array(z.object({ key: z.string(), reason: z.string(), note: Bi.optional() })),
});

export type Pattern = z.infer<typeof PatternSchema>;
export type TopicPatterns = z.infer<typeof TopicPatternsSchema>;
export type PatternMap = z.infer<typeof PatternMapSchema>;
export type V2Task = z.infer<typeof V2TaskSchema>;
export type KwtTask = Extract<V2Task, { type: 'kwt' }>;
export type FindTask = Extract<V2Task, { type: 'find' }>;
export type MeaningTask = Extract<V2Task, { type: 'meaning' }>;
export type PathFile = z.infer<typeof PathFileSchema>;
