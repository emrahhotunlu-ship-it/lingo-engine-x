import { dayKey } from '../date';
import { fmtOfCode } from './actBrief';
import type { ExerciseId } from './types';

// Grundbausteine der Aktivierung (Stufe 2), ohne schwere Abhängigkeiten – `applyReview.ts` (Schreiben des Kartenzählers `na`) und der Fahrplan
// benutzen sie gemeinsam. Eine Quelle für „Was ist eine Aktivierung?“ und „Wie viele hat die Karte geschafft?“.

/** Aktivierungs-Aufgaben außer „Eigener Satz“: A2 `act_scene`, A3 `act_rewrite`, A4 `act_impulse`, A5 `act_combo` und `act_mail`. */
export const ACT_EXERCISES: readonly ExerciseId[] = ['act_scene', 'act_rewrite', 'act_impulse', 'act_combo', 'act_mail'];
/** Alle Aktivierungen: „Eigener Satz“ (A1) und die Stufe-2-Aufgaben. EIN Zähler für die Tagesgrenze. */
export const ACTIVATION_EX: ReadonlySet<string> = new Set<string>(['produce', ...ACT_EXERCISES]);
export const isActivationEx = (ex: string): boolean => ACTIVATION_EX.has(ex);

type Doc = Readonly<Record<string, unknown>>;
const hist = (doc: Doc): Record<string, unknown>[] =>
  (Array.isArray(doc.hist) ? (doc.hist as unknown[]) : []).filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && typeof (h as Record<string, unknown>).t === 'number');

/**
 * Zeitpunkte und Noten der Aktivierungen im Verlauf (die letzten 12 Einträge), ältester zuerst. `u` = ungeprüft (`hist[].u: 1`): abgeschrieben, ohne Claude oder
 * mit Hilfe der Vorprüfung; so ein Eintrag zählt für den Abstand, aber nie für den Fahrplan (Lernwissenschaft H1).
 */
export function activationHist(doc: Doc): Array<{ t: number; g: number; u: boolean; a: unknown }> {
  return hist(doc)
    .filter((h) => typeof h.x === 'string' && ACTIVATION_EX.has(h.x))
    .map((h) => ({ t: h.t as number, g: typeof h.g === 'number' ? h.g : 0, u: h.u === 1, a: h.a }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Wie viele Aktivierungen hat die Karte geschafft (Note ≥ 2, von Claude geprüft, ohne Hilfe)? Der Zähler `na` auf der Karte ist abgeleitet (aus `act/…` neu berechenbar); ältere
 * Karten ohne `na` haben höchstens ihre „Eigener Satz“-Antworten im Verlauf. Es gilt das Größere.
 */
export function naOf(doc: Doc): number {
  const stored = typeof doc.na === 'number' && Number.isFinite(doc.na) ? Math.max(0, Math.floor(doc.na)) : 0;
  const fromHist = activationHist(doc).filter((h) => h.g >= 2 && !h.u).length;
  return Math.max(stored, fromHist);
}

/** Zeitpunkt und Note der letzten Aktivierung, `null` ohne. */
export function lastActivation(doc: Doc): { t: number; g: number } | null {
  return activationHist(doc).at(-1) ?? null;
}

/** Aktivierungen dieser Karten an einem Lerntag (alle Arten, alle Runden). EINE Zählung für die Tagesgrenze. */
export function activationsOn(docs: Iterable<Doc>, day: string): number {
  let n = 0;
  for (const d of docs) for (const h of activationHist(d)) if (dayKey(h.t) === day) n++;
  return n;
}

/**
 * Aufwand einer Aktivierung in Satz-Einheiten (Lernwissenschaft M3): Kundenmail 2, Kombi-Satz 1,5, alles andere 1. Das Tagesbudget zählt Einheiten statt Aufgaben,
 * damit zwei Kundenmails nicht unsichtbar zehn Minuten kosten.
 */
export function unitsOfCode(code: unknown): number {
  const f = fmtOfCode(code);
  return f === 'ml' ? 2 : f === 'kb' ? 1.5 : 1;
}

/** Satz-Einheiten der Aktivierungen dieser Karten an einem Lerntag. */
export function activationUnitsOn(docs: Iterable<Doc>, day: string): number {
  let n = 0;
  for (const d of docs) for (const h of activationHist(d)) if (dayKey(h.t) === day) n += unitsOfCode(h.a);
  return n;
}
