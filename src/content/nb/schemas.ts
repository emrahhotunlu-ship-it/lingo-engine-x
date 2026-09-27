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

// ------------------------------------------------------------------ Soll-Inhalte (N107–N109)

const themeId = z.string().regex(/^t(0[1-9]|1[0-6])$/);
const level = z.enum(['casual', 'neutral', 'formal']);

/** Wortbildung (W5): Grundwort, Wortfamilie, Satz mit Lücke, Wortart. */
export const wordFormationSchema = z.object({
  id: z.string().regex(/^w\d{2}$/),
  base: text,
  family: z.array(text).min(2),
  gap: z.string().includes('___'),
  answers: z.array(text).min(1),
  pos: z.enum(['noun', 'adjective', 'adverb', 'verb']),
  why: bi,
});

/** Register-Leiter (W6): locker · neutral · formell, Satz auf eine andere Stufe bringen. */
export const registerSchema = z.object({
  id: z.string().regex(/^r\d{2}$/),
  levels: z.object({ casual: text, neutral: text, formal: text }),
  de: text,
  sentence: text,
  from: level,
  to: level,
  answers: z.array(text).min(1),
});

/** Phrasal Verbs (W4): Mail (formell) ↔ Call (gesprochen), jeweils erlaubte Fassungen. */
export const phrasalSchema = z.object({
  id: z.string().regex(/^p\d{2}$/),
  formal: text,
  phrasal: text,
  de: text,
  mail: z.array(text).min(1),
  call: z.array(text).min(1),
});

/** Überleitungen (W8): kurze Rede mit Lücken (`___`) an den Übergängen. */
export const transitionSchema = z.object({
  id: z.string().regex(/^d\d{2}$/),
  theme: themeId,
  text,
  gaps: z.array(z.object({ answers: z.array(text).min(1), fn: bi })).min(2).max(4),
});

/** Heißer Stuhl (I9): harte Frage nach der Präsentation, Musterantwort. */
export const hotSeatSchema = z.object({ id: z.string().regex(/^h\d{2}$/), theme: themeId, q: text, de: text, model: text, tip: bi });

/** Zeit gewinnen (I13): harte Frage, 2–3 passende Einstiege. */
export const buyTimeSchema = z.object({ id: z.string().regex(/^g\d{2}$/), q: text, de: text, starters: z.array(text).min(2).max(3) });

/** Wortbetonung (P1): Silben, betonte Silbe (0-basiert). */
export const stressSchema = z.object({
  id: z.string().regex(/^s\d{2}$/),
  word: text,
  syll: z.array(text).min(2),
  stress: z.number().int().min(0),
  de: text,
  pos: z.enum(['noun', 'verb', 'adjective']).optional(),
});

/** Zahlen, Daten, Beträge (P4): gezeigt, gesprochen (erste Fassung = Muster für die Sprachausgabe). */
export const numberSchema = z.object({
  id: z.string().regex(/^z\d{2}$/),
  kind: z.enum(['money', 'percent', 'date', 'time', 'quarter', 'number', 'fraction', 'year']),
  show: text,
  say: z.array(text).min(1),
  note: bi,
});

export type WordFormation = z.infer<typeof wordFormationSchema>;
export type RegisterItem = z.infer<typeof registerSchema>;
export type PhrasalItem = z.infer<typeof phrasalSchema>;
export type TransitionItem = z.infer<typeof transitionSchema>;
export type HotSeatItem = z.infer<typeof hotSeatSchema>;
export type BuyTimeItem = z.infer<typeof buyTimeSchema>;
export type StressItem = z.infer<typeof stressSchema>;
export type NumberItem = z.infer<typeof numberSchema>;

export type ThemeText = z.infer<typeof themeTextSchema>;
export type TextQuestion = z.infer<typeof questionSchema>;
export type Colloc = z.infer<typeof collocSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type Objection = z.infer<typeof objectionSchema>;
export type InboxMail = z.infer<typeof inboxSchema>;
export type BizScene = z.infer<typeof sceneSchema>;
