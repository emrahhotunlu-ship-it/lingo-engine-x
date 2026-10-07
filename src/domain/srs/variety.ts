import { hash32 } from '../random';
import type { ExerciseId } from './types';

// Varianz beim Befestigen (V1, Emrah 07.10.2026, „Mehrfachkombination“): Wörter, Wendungen und Muster sollen beim Wiederholen in
// wechselnder Abfrageform und in wechselnden Sätzen vorkommen (Interleaving, Variation of Practice, Encoding Variability).
// Verlauf je Karte: die letzten Einträge von `hist` tragen die Form (`x`) und neu den Satz (`s`, kurzer Hash). Beides additiv, `hist`
// bleibt auf 12 Einträge begrenzt (A6.6), nichts wird gelöscht. Rein.

/** Schlüssel eines Satzes im Verlauf: kurzer Hash des normalisierten Satzes (≤ 7 Zeichen). */
export function sentKey(sentence: string): string {
  const n = sentence
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `s${hash32(n).toString(36)}`;
}

/** Formenfamilien: Abfragen, die im Kern dasselbe verlangen, zählen für die Vielfalt als eine Form. */
const FAMILY: Readonly<Partial<Record<ExerciseId, string>>> = {
  mc_en: 'pick-meaning',
  ctx_mc: 'pick-meaning',
  listen_mc: 'pick-meaning',
  mc_de: 'pick-word',
  match: 'pick-word',
  // Lücke mit Stütze (Anfangsbuchstabe, Bausteine) und freie Lücke sind verschiedene Anforderungen (Stütze gegen freier Abruf).
  cloze_hint: 'gap-hint',
  tiles: 'gap-hint',
  cloze: 'gap',
  speed: 'gap',
  colloc_gap: 'colloc',
  colloc: 'colloc',
};
export const familyOf = (ex: string): string => FAMILY[ex as ExerciseId] ?? ex;

/** Einträge des Verlaufs, die keine Abfrageform sind (Aufdecken und „Kenne ich“ sagen nichts über die Vielfalt). */
const NOT_A_FORM: ReadonlySet<string> = new Set(['flip', 'known']);

export type Variety = {
  /** Formen (Übungsarten) der letzten Antworten, die neueste zuletzt. */
  forms: string[];
  /** Sätze der letzten Antworten (Schlüssel `sentKey`), der neueste zuletzt. Nur Einträge, die einen Satz tragen. */
  sents: string[];
};

/** Verlauf einer Karte, tolerant gelesen (alte Einträge ohne `x` oder `s` fehlen einfach). */
export function varietyOf(doc: Readonly<Record<string, unknown>>): Variety {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const rows = raw
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && typeof (h as Record<string, unknown>).t === 'number')
    .sort((a, b) => (a.t as number) - (b.t as number));
  const forms = rows.flatMap((h) => (typeof h.x === 'string' && !NOT_A_FORM.has(h.x) ? [h.x] : []));
  const sents = rows.flatMap((h) => (typeof h.s === 'string' && h.s ? [h.s] : []));
  return { forms, sents };
}

/** Mindestzahl verschiedener Formenfamilien, bevor eine Karte „Fest“ wird (Auswahl-Vorliebe, ändert die Fest-Definition nicht). */
export const FEST_MIN_FORMS = 3;

/** Wie viele verschiedene Formenfamilien kamen in den gespeicherten Antworten vor? */
export const distinctForms = (v: Variety): number => new Set(v.forms.map(familyOf)).size;

/**
 * Aufschlag auf die Rangzahl einer Art (kleiner = eher dran) für die Vielfalt:
 *  - dieselbe Art wie zuletzt: nie (die Wahl schließt sie vorher aus, solange es eine andere gibt),
 *  - dieselbe Familie wie zuletzt: +0,08
 *  - Art unter den letzten 4 Formen schon dabei: +0,1 (eine lange nicht gesehene Art kommt eher dran)
 *  - ab Stufe 4 mit weniger als `FEST_MIN_FORMS` Familien: eine neue Familie bekommt zusätzlich −0,15 (Vorbereitung auf „Fest“).
 */
export function varietyBias(ex: string, v: Variety, stage: number): number {
  let b = 0;
  const last = v.forms.at(-1);
  if (last && familyOf(last) === familyOf(ex)) b += 0.08;
  if (v.forms.slice(-4).includes(ex)) b += 0.1;
  if (stage >= 4 && distinctForms(v) < FEST_MIN_FORMS && !v.forms.map(familyOf).includes(familyOf(ex))) b -= 0.15;
  return b;
}

/**
 * Unter gleich geeigneten Einträgen den am längsten nicht benutzten wählen (nie benutzt zuerst, der zuletzt benutzte nie, solange es eine
 * Wahl gibt). Gleichstand: `tie`-ter der Kandidaten (z. B. `reps`, damit ohne Verlauf reihum gewechselt wird).
 */
export function leastRecent<T>(items: readonly T[], keyOf: (x: T) => string, used: readonly string[], tie = 0): T | undefined {
  if (!items.length) return undefined;
  const age = (x: T): number => used.lastIndexOf(keyOf(x));
  const min = Math.min(...items.map(age));
  const cands = items.filter((x) => age(x) === min);
  return cands[Math.abs(tie) % cands.length];
}
