import { z } from 'zod';

// zod-Schemas je Inhaltsart von `content/nb` (Plan §4.8). Streng: keine leeren Texte, feste Mengen.
// Die JSON-Inhalte werden erst bei Bedarf geparst (`load.ts`, Anhang A 5c).

const text = z.string().trim().min(1);
const bi = z.object({ de: text, en: text });

export const themePhraseSchema = z.object({ en: text, de: text, def: text });
export const themeSchema = z.object({
  id: z.string().regex(/^t(0[1-9]|1[0-6])$/),
  n: z.number().int().min(1).max(16),
  kind: z.enum(['job', 'bridge', 'life']),
  title: bi,
  task: bi,
  tool: text,
  focus: bi,
  trap: z.string().regex(/^f\d{2}$/),
  phrases: z.array(themePhraseSchema).length(5),
  keywords: z.array(text).min(3),
  fluencyQ: text,
  scene: text,
  goals: z.array(z.object({ kind: z.enum(['hedge', 'transition', 'phrase']), need: z.number().int().min(1).max(5) })).min(1).max(3),
});

export const trapSchema = z.object({
  id: z.string().regex(/^f\d{2}$/),
  group: z.enum(['false-friend', 'numbers-time', 'one-to-many', 'grammar', 'register']),
  title: bi,
  wrong: text,
  right: text,
  why: bi,
  hint: bi,
  drills: z.array(z.object({ wrong: text, right: z.array(text).min(1), de: text.optional() })).length(3),
  detect: z.array(text),
});

/** Themen-Text (Block 2, N53): 150–250 Wörter, Kernfrage, Frage „zwischen den Zeilen“, 3 Nachsprech-Sätze. */
export const questionSchema = z.object({
  q: bi,
  /** Auswahlantworten (Englisch); `answer` ist der Index der richtigen. */
  options: z.array(text).min(3).max(4),
  answer: z.number().int().min(0).max(3),
  /** Belegstelle: wörtliches Zitat aus dem Text. */
  quote: text,
  why: bi,
});
export const themeTextSchema = z.object({
  id: z.string().regex(/^x-t(0[1-9]|1[0-6])$/),
  theme: z.string().regex(/^t(0[1-9]|1[0-6])$/),
  genre: z.enum(['email', 'article', 'briefing', 'voicemail', 'post', 'story', 'memo']),
  title: text,
  text: text,
  core: questionSchema,
  between: questionSchema,
  /** 2–3 Wendungen zum Merken (wörtlich im Text). */
  notice: z.array(text).min(2).max(3),
  /** 3 Sätze zum Nachsprechen (wörtlich im Text). */
  shadow: z.array(text).length(3),
  /** Stelle, an der das Werkzeug der Woche benutzt wird (wörtlich im Text, Prüfung S3). */
  toolIn: text,
});

/** Kollokationen (W3, N101): Nomen + 2–4 Verben, typische Lehnübersetzung als Kontrast. */
export const collocSchema = z.object({
  id: z.string().regex(/^c\d{2}$/),
  noun: text,
  de: text,
  verbs: z.array(z.object({ v: text, de: text, ex: text })).min(2).max(4),
  /** Typische deutsche Lehnübersetzung (falsch) und die richtige Verbindung. */
  wrong: z.object({ phrase: text, right: text, note: bi }),
});

/** Satz-Umformung mit Schlüsselwort (G3, N102). `gap` ist Satz B mit „___“, `answers` die erlaubten Füllungen (3–6 Wörter). */
export const transformSchema = z.object({
  id: z.string().regex(/^u\d{2}$/),
  a: text,
  key: z.string().regex(/^[A-Z' ]+$/),
  gap: z.string().includes('___'),
  answers: z.array(text).min(1),
  why: bi,
});

/** Einwand (I3, N103): Muster anerkennen · nachfragen · antworten · absichern. */
export const objectionSchema = z.object({
  id: z.string().regex(/^o\d{2}$/),
  theme: z.string().regex(/^t(0[1-9]|1[0-6])$/),
  kind: z.enum(['price', 'send-info', 'competitor', 'timing', 'security', 'status-quo', 'authority', 'need', 'contract', 'risk']),
  line: text,
  de: text,
  model: z.object({ acknowledge: text, ask: text, answer: text, secure: text }),
  tip: bi,
});

/** Posteingang (L2, N104): Kundenmail mit verstecktem Anliegen und Musterantwort. */
export const inboxSchema = z.object({
  id: z.string().regex(/^m\d{2}$/),
  theme: z.string().regex(/^t(0[1-9]|1[0-6])$/),
  from: text,
  role: text,
  subject: text,
  body: text,
  /** Das eigentliche Anliegen (verdeckt). */
  hidden: bi,
  /** Was die Antwort leisten muss (2–4 Punkte). */
  must: z.array(bi).min(2).max(4),
  reply: text,
});

/** Business-Szene (N70): 3 Ziele, 3–5 Kriterien. */
export const sceneSchema = z.object({
  id: z.string().regex(/^b\d{2}$/),
  theme: z.string().regex(/^t(0[1-9]|1[0-6])$/),
  kind: z.enum(['sales', 'negotiation', 'meeting', 'phone', 'smalltalk', 'presentation', 'complaint', 'life']),
  title: bi,
  setting: bi,
  partner: z.object({ name: text, role: text, mood: text }),
  opener: text,
  goals: z.array(bi).length(3),
  criteria: z.array(bi).min(3).max(5),
});

export type ThemeText = z.infer<typeof themeTextSchema>;
export type TextQuestion = z.infer<typeof questionSchema>;
export type Colloc = z.infer<typeof collocSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type Objection = z.infer<typeof objectionSchema>;
export type InboxMail = z.infer<typeof inboxSchema>;
export type BizScene = z.infer<typeof sceneSchema>;
