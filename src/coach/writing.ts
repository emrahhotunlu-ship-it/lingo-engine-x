import { z } from 'zod';
import { WRITING_PROMPTS, type WritingPrompt, type WritingWord } from '../content/writing/prompts';
import { hash32, mulberry32, shuffle } from '../domain/random';
import type { InputItem } from './types';

// Schreibaufträge (docs/neustart.md §5 Nr. 13): Emrah schreibt einen kurzen Text, bekommt EINE
// KI-Korrektur auf Knopfdruck, jeder Fehler wird zur Reparatur-Aufgabe (coach/repair).
// Gespeichert wird je Monat ein Dokument `coach/writing-JJJJ-MM` mit festen Plätzen (w0 … w17):
// Der Schreibweg kennt kein Löschen, deshalb überschreibt der neueste Text den ältesten Platz.

/** Fehlerarten der Korrektur (fest, damit die Stolpersteine zählbar sind). */
export const WRITE_CATS = ['articles', 'prepositions', 'tenses', 'word-order', 'collocation', 'false-friend', 'spelling', 'register', 'vocabulary', 'other'] as const;
export type WriteCat = (typeof WRITE_CATS)[number];

export const WRITE_MAX_CHARS = 3000;
/** Ab so vielen Wörtern darf korrigiert werden (kürzere Texte wären eine verschenkte Anfrage). */
export const WRITE_MIN_SUBMIT = 8;
/** Plätze je Monatsdokument und Größenobergrenze (db.d.ts: 256 KiB je Dokument). */
export const WRITING_MONTH_SLOTS = 18;
export const WRITING_DOC_LIMIT = 200 * 1024;

export type WriteError = { orig: string; fix: string; why: string; cat: string };
export type WriteUpgrade = { weak: string; strong: string; why: string };

export type WriteReview = {
  corrected: string;
  errors: WriteError[];
  upgrades: WriteUpgrade[];
  /** Geschätztes Niveau des Textes, z. B. „B2+“ (leer, wenn nicht lesbar). */
  level: string;
  praise: string;
};

export type WritingEntry = {
  at: number;
  /** Lerntag JJJJ-MM-TT. */
  d: string;
  /** Aufgabe: Kennung (eingebaut), `in:<Beitrag>` (zum Input) und englischer Titel. */
  tid: string;
  title: string;
  /** Text und korrigierter Text (leer, wenn der Platz verdichtet wurde). */
  t: string;
  c: string;
  e: WriteError[];
  up: WriteUpgrade[];
  lv: string;
  pr: string;
  /** Wörter im Text. */
  n: number;
  /** Sprache der Erklärungen. */
  wl: 'de' | 'en';
};

const num = z.number().finite();
const errorSchema = z.looseObject({ orig: z.string(), fix: z.string(), why: z.string().default(''), cat: z.string().default('other') });
const upgradeSchema = z.looseObject({ weak: z.string(), strong: z.string(), why: z.string().default('') });
export const writingEntrySchema = z.looseObject({
  at: num,
  d: z.string(),
  tid: z.string().default(''),
  title: z.string().default(''),
  t: z.string().default(''),
  c: z.string().default(''),
  e: z.array(errorSchema).default([]),
  up: z.array(upgradeSchema).default([]),
  lv: z.string().default(''),
  pr: z.string().default(''),
  n: num.default(0),
  wl: z.enum(['de', 'en']).default('de'),
});

/** Monate: JJJJ-MM → Platz → Eintrag. */
export type WritingMonths = Readonly<Record<string, Readonly<Record<string, WritingEntry>>>>;

export const writingDocOf = (day: string): string => `coach/writing-${day.slice(0, 7)}`;

/** Wörter eines Textes (Zahlen und Wörter mit Apostroph oder Bindestrich zählen als eins). */
export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

// ------------------------------------------------------------------ Aufgaben

export type WriteTask = {
  id: string;
  /** Anzeige-Titel in der Oberflächensprache (eingebaute Aufgaben). */
  title: string;
  /** Englischer Titel (für Speicher und KI). */
  title_en: string;
  /** Aufgabe auf Englisch: geht an die KI. */
  task_en: string;
  /** Aufgabe auf Deutsch (eingebaute Aufgaben); bei Aufgaben zum Input baut die Oberfläche den Satz. */
  task_de: string;
  words: readonly WritingWord[];
  min: number;
  max: number;
  /** Aufgabe zu einem Input-Beitrag. */
  input?: { title: string };
};

export function taskFromPrompt(p: WritingPrompt, lang: 'de' | 'en'): WriteTask {
  return { id: p.id, title: lang === 'de' ? p.title : p.title_en, title_en: p.title_en, task_en: p.task_en, task_de: p.task_de, words: p.words, min: p.min, max: p.max };
}

/** „Schreib 3–4 Sätze dazu“: Aufgabe zu einem bewerteten Input-Beitrag. */
export function taskFromInput(item: InputItem): WriteTask {
  const title = item.title.replace(/["“”„]/g, "'").slice(0, 160);
  return {
    id: `in:${item.id}`.slice(0, 100),
    title,
    title_en: title,
    task_en: `Write 3-4 sentences about "${title}": what is the main point and what do you think about it? Try to use two of the key words.`,
    task_de: '',
    words: (item.words ?? []).slice(0, 6),
    min: 35,
    max: 100,
    input: { title },
  };
}

/** Wann welche Aufgabe zuletzt geschrieben wurde (ms; fehlt = nie). */
export function lastWritten(months: WritingMonths): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slots of Object.values(months)) for (const e of Object.values(slots)) if (e.tid && (out[e.tid] ?? 0) < e.at) out[e.tid] = e.at;
  return out;
}

/**
 * Eingebaute Aufgabe des Tages: noch nie geschriebene zuerst, dann die am längsten nicht geschriebene.
 * Fest je Tag und Wahl (kein Würfeln beim Neuzeichnen); `skip` = „andere Aufgabe“.
 */
export function pickPrompt(day: string, last: Readonly<Record<string, number>>, skip = 0): WritingPrompt {
  const order = shuffle(WRITING_PROMPTS, mulberry32(hash32(`write-${day}`)));
  const sorted = [...order].sort((a, b) => (last[a.id] ?? 0) - (last[b.id] ?? 0));
  return sorted[((skip % sorted.length) + sorted.length) % sorted.length] ?? WRITING_PROMPTS[0]!;
}

/** Schlüsselwörter, die im Text vorkommen (ganze Wörter, ohne Beachtung der Großschreibung). */
export function usedWords(text: string, words: readonly WritingWord[]): Set<string> {
  const low = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ')} `;
  const used = new Set<string>();
  for (const w of words) {
    const stem = w.en.toLowerCase();
    // Beugung zulassen (negotiate → negotiated): Wortanfang genügt bei Wörtern ab fünf Buchstaben.
    const base = stem.length >= 5 && !stem.includes(' ') ? stem.slice(0, stem.length - 1) : stem;
    if (low.includes(` ${stem} `) || (base !== stem && low.includes(` ${base}`))) used.add(w.en);
  }
  return used;
}

// ------------------------------------------------------------------ Speichern

export function buildEntry(a: { now: number; day: string; task: WriteTask; text: string; review: WriteReview; lang: 'de' | 'en' }): WritingEntry {
  return {
    at: a.now,
    d: a.day,
    tid: a.task.id,
    title: a.task.title_en.slice(0, 160),
    t: a.text,
    c: a.review.corrected,
    e: a.review.errors,
    up: a.review.upgrades,
    lv: a.review.level,
    pr: a.review.praise,
    n: wordCount(a.text),
    wl: a.lang,
  };
}

const encoder = new TextEncoder();
const sizeOf = (slots: Record<string, WritingEntry>): number => encoder.encode(JSON.stringify({ e: slots })).length;

/**
 * Platz für einen neuen Text im Monatsdokument. Der Schreibweg löscht nie: Ist der Monat voll, wird
 * der älteste Platz überschrieben; wird das Dokument zu groß, verlieren die ältesten Texte ihren
 * Volltext (`t`, `c`), ihre Fehlerliste bleibt. Liefert genau die zu schreibenden Plätze.
 */
export function planWritingSave(month: Readonly<Record<string, WritingEntry>> | undefined, entry: WritingEntry, limitBytes = WRITING_DOC_LIMIT): Record<string, WritingEntry> {
  const cur: Record<string, WritingEntry> = { ...(month ?? {}) };
  let slot = '';
  for (let i = 0; i < WRITING_MONTH_SLOTS; i++) {
    if (!cur[`w${i}`]) {
      slot = `w${i}`;
      break;
    }
  }
  if (!slot) slot = Object.entries(cur).sort((a, b) => a[1].at - b[1].at)[0]?.[0] ?? 'w0';
  const patch: Record<string, WritingEntry> = { [slot]: entry };
  const merged: Record<string, WritingEntry> = { ...cur, [slot]: entry };
  if (sizeOf(merged) > limitBytes) {
    const oldest = Object.entries(merged)
      .filter(([k, e]) => k !== slot && (e.t || e.c))
      .sort((a, b) => a[1].at - b[1].at);
    for (const [k, e] of oldest) {
      const slim = { ...e, t: '', c: '' };
      merged[k] = slim;
      patch[k] = slim;
      if (sizeOf(merged) <= limitBytes) break;
    }
  }
  return patch;
}

/** Alle Texte, neueste zuerst. */
export function writingEntries(months: WritingMonths): WritingEntry[] {
  return Object.values(months)
    .flatMap((slots) => Object.values(slots))
    .sort((a, b) => b.at - a.at);
}

/** Letzte Niveau-Schätzungen, älteste zuerst (für die schlichte Anzeige im Fahrplan). */
export function levelHistory(months: WritingMonths, n = 5): string[] {
  return writingEntries(months)
    .filter((e) => e.lv)
    .slice(0, n)
    .reverse()
    .map((e) => e.lv);
}

export function parseWritingMonth(data: Record<string, unknown>): { slots: Record<string, WritingEntry>; invalid: string[] } {
  const slots: Record<string, WritingEntry> = {};
  const invalid: string[] = [];
  const raw = data.e;
  if (raw && typeof raw === 'object') {
    for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
      const r = writingEntrySchema.safeParse(value);
      if (r.success) slots[slot] = r.data;
      else invalid.push(slot);
    }
  }
  return { slots, invalid };
}
