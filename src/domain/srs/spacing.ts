import type { FsrsStored } from '../../data/schemas';
import { addDays, dayKey, dayKeyNoon, daysBetween as daysBetweenKeys, isDayKey, learningDayStart } from '../date';
import { stageOf } from './ladder';
import { FREE_ANSWER, FREE_MIN_GRADE } from './variety';

// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, Emrah 21.10.2026: voller Umbau). Rein und ohne Seiteneffekte.
//
//  1. Tag 0: Am Einführungstag zählt „Leicht“ als „Gut“, und nur ein FREIER richtiger Abruf (getippt, ohne Auswahl, ohne Stütze, ohne Tipp)
//     beendet die Lernphase. Aufdecken, Auswahl und die Lücke mit Anfangsbuchstaben halten die Karte im letzten Lernschritt (10 Min.).
//  2. Abstands-Deckel (nach FSRS, kürzt nur): ≤ 1 Tag, bis an einem späteren Tag als dem Einführungstag ein freier Abruf gelang; ≤ 3 Tage bis
//     2 solche Tage; ≤ 7 bis 3; danach ≤ 21, bis die Karte „Fest“ ist ODER der freie Abruf nach ≥ 21 Tagen Pause gelungen ist (`longGapProven`):
//     Danach hat der Deckel nichts mehr zu beweisen – sonst hinge eine Karte ohne zweiten Satz für immer an 21 Tagen.
//     Erkennen und Aufdecken heben den Abstand nie über den Deckel. Die Stufe zählt als Mindest-Beleg (`evidenceDays`): Das Tor der freien Tage
//     verlangt für Stufe 4 zwei und für Stufe 5 drei freie Tage, und der Verlauf hat höchstens 12 Einträge – so fallen gereifte Karten
//     nicht auf 1–3 Tage zurück, nur weil ihr Verlauf alte Belege verloren hat.
//  3. Erster Abruf nach dem Einführungstag („Gestern-Check“) und die beiden Abrufe am Tag 0 (`recallStep`).
//
// FSRS selbst (Ziel 0,9), die Dämpfung (`weight.ts`), die Tagesbremse und das Tor der freien Tage bleiben, wie sie sind.

type Doc = Readonly<Record<string, unknown>>;

/** Deckel in Tagen je Zahl der späteren Tage mit freiem Abruf (0, 1, 2, ab 3). */
export const CAP_STEPS = [1, 3, 7, 21] as const;
/** Pause (Lerntage) vor einem freien Abruf, der für „Fest“ zählt. */
export const LONG_GAP_DAYS = 21;
/** Erster Lerntag der Regeln aus Wort-Lernen 2 (Fest mit langer Pause). Soll dem Tag entsprechen, an dem der Stand live geht. */
export const KERN_FROM = '2026-10-22';
/** Lernschritt, in dem eine Karte am Tag 0 bleibt, wenn kein freier Abruf sie beendet hat. */
export const DAY0_HOLD_MS = 10 * 60_000;

const REVIEW = 2;
const LEARNING = 1;

type Row = { t: number; g: number | null; x: string | null; u: boolean; ci: boolean; known: boolean };

/** Alte Einträge ohne `x` (nur `m`): getippt (`type`) und eigener Satz (`produce`) waren frei (wie `cardStatus.ts`). */
const LEGACY_FREE: Readonly<Record<string, string>> = { type: 'type', produce: 'produce' };

/** Verlauf, tolerant gelesen, älteste zuerst. */
export function rowsOf(doc: Doc): Row[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const out: Row[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    if (typeof o.t !== 'number' || !Number.isFinite(o.t)) continue;
    const x = typeof o.x === 'string' ? o.x : typeof o.m === 'string' ? (LEGACY_FREE[o.m] ?? null) : null;
    out.push({ t: o.t, g: typeof o.g === 'number' && Number.isFinite(o.g) ? o.g : null, x, u: o.u === 1, ci: typeof o.ci === 'number' && o.ci >= 0, known: o.m === 'known' || o.x === 'known' });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Eine Antwort, wie sie gerade gegeben wird (noch nicht im Verlauf). */
export type FreshAnswer = { t: number; ex: string; grade: number; colIndex?: number; hint?: number; unverified?: boolean };

/** Freier Abruf: getippt oder selbst gebildet, ohne Auswahl, ohne Stütze, geprüft; Treffer am Partnerwort zählt nicht für das Hauptwort. */
export const isFreeForm = (x: string | null, ci = false): boolean => x !== null && FREE_ANSWER.has(x) && !(x === 'colloc' && ci);
const rowFreeGood = (r: Row): boolean => !r.known && !r.u && r.g !== null && r.g >= FREE_MIN_GRADE && isFreeForm(r.x, r.ci);
/** Ist die Antwort, die gerade gegeben wird, ein guter freier Abruf (ohne Tipp)? */
export const freshFreeGood = (a: FreshAnswer): boolean =>
  !a.unverified && !(a.hint && a.hint > 0) && a.grade >= FREE_MIN_GRADE && isFreeForm(a.ex, a.colIndex !== undefined && a.colIndex >= 0);

/** Einführungstag: `intro`, sonst der Tag der ersten Antwort (ohne „Kenne ich“), sonst `null`. */
export function introDayOf(doc: Doc): string | null {
  if (isDayKey(doc.intro)) return doc.intro;
  const first = rowsOf(doc).find((r) => !r.known);
  return first ? dayKey(first.t) : null;
}

/**
 * Wie viele Lerntage NACH dem Einführungstag haben einen guten freien Abruf (`extra` = die Antwort, die gerade gegeben wird)?
 * Ein Wort einer Wendung als freie Lücke (`cloze_part`) zählt für höchstens einen Tag (wie beim Tor für Stufe 4).
 * Der Verlauf hat höchstens 12 Einträge: ältere Belege fallen heraus, der Deckel kann dann nur kürzer werden (nie länger).
 */
export function freeLaterDays(doc: Doc, extra?: FreshAnswer, introDay: string | null = introDayOf(doc)): number {
  const days = new Set<string>();
  const parts = new Set<string>();
  const add = (x: string | null, t: number) => {
    const d = dayKey(t);
    if (introDay !== null && d <= introDay) return;
    (x === 'cloze_part' ? parts : days).add(d);
  };
  for (const r of rowsOf(doc)) if (rowFreeGood(r)) add(r.x, r.t);
  if (extra && freshFreeGood(extra)) add(extra.ex, extra.t);
  const part = [...parts].find((d) => !days.has(d));
  return days.size + (part ? 1 : 0);
}

/** Freie Tage für den Deckel: Belege aus dem Verlauf, mindestens aber, was die Stufe garantiert (Tor: Stufe 4 = 2 Tage, Stufe 5 = 3 Tage). */
export function evidenceDays(doc: Doc, extra?: FreshAnswer, introDay: string | null = introDayOf(doc)): number {
  const st = doc.state === 'new' ? 0 : stageOf(doc);
  return Math.max(freeLaterDays(doc, extra, introDay), st >= 5 ? 3 : st >= 4 ? 2 : 0);
}

/**
 * Ist der freie Abruf nach ≥ 21 Lerntagen Pause belegt? Im Verlauf (guter freier Abruf, ≥ 21 Lerntage nach der Antwort davor) oder dauerhaft
 * über den ersten Fest-Tag `ff` ab `KERN_FROM` (seitdem verlangt „Fest“ genau diesen Beleg; der Verlauf hat höchstens 12 Einträge).
 */
export function longGapProven(doc: Doc): boolean {
  if (isDayKey(doc.ff) && doc.ff >= KERN_FROM) return true;
  const rows = rowsOf(doc);
  return rows.some((r, i) => i > 0 && r.x !== 'cloze_part' && rowFreeGood(r) && daysBetweenKeys(dayKey((rows[i - 1] as Row).t), dayKey(r.t)) >= LONG_GAP_DAYS);
}

/** Deckel in Tagen (ohne Ausnahme für „Fest“): 1, 3, 7 oder 21. */
export const capDaysOf = (freeDays: number): number => CAP_STEPS[Math.max(0, Math.min(CAP_STEPS.length - 1, Math.floor(freeDays)))] as number;

/** 04:00 Uhr (Beginn) des Lerntags `key`. */
export const dayStartOf = (key: string): number => learningDayStart(dayKeyNoon(key));

/** Fälligkeit nach dem Deckel: höchstens `capDays` Lerntage nach dem Lerntag von `nowMs` (04:00 Uhr). Nur Review-Karten; kürzt nur, verlängert nie. */
export function capDue(f: FsrsStored, nowMs: number, capDays: number): FsrsStored {
  if (f.state !== REVIEW) return f;
  const limit = dayStartOf(addDays(dayKey(nowMs), Math.max(1, capDays)));
  if (f.due <= limit) return f;
  return { ...f, due: limit, scheduledDays: Math.max(1, capDays) };
}

/**
 * Tag-0-Regel: Am Einführungstag beendet nur ein guter freier Abruf die Lernphase. Hätte FSRS die Karte nach Aufdecken, Auswahl, Stütze
 * oder Tipp in den Review-Zustand gehoben, bleibt sie im letzten Lernschritt (10 Min.). Stabilität und Schwierigkeit bleiben, wie FSRS sie rechnet.
 */
export function holdOnDay0(f: FsrsStored, nowMs: number, freeGood: boolean): FsrsStored {
  if (freeGood || f.state !== REVIEW) return f;
  return { ...f, state: LEARNING, learningSteps: 1, scheduledDays: 0, due: Math.round(nowMs + DAY0_HOLD_MS) };
}

/** Note am Einführungstag: „Leicht“ zählt als „Gut“ (das Kurzzeitgedächtnis ist kein Langzeitwissen). */
export const day0Grade = <G extends number>(grade: G, onIntroDay: boolean): G => (onIntroDay && grade === 4 ? (3 as G) : grade);

/**
 * Welcher Abruf ist heute dran (nur Runden im Modus „auto“/„Tippen“)?
 *  - `hint`  Tag 0, noch kein richtiger Abruf heute: Abruf 1 (Lücke mit Anfangsbuchstaben; Wendung: ein Wort bzw. Bausteine)
 *  - `free`  Tag 0, schon ein richtiger Abruf heute: Abruf 2 (freie Lücke, sonst Deutsch → Englisch)
 *  - `check` erster Abruf nach dem Einführungstag („Gestern-Check“): frei
 *  - `null`  gewöhnliche Leiter
 */
export type RecallStep = 'hint' | 'free' | 'check' | null;
export function recallStep(c: { isNew: boolean; doc: Doc }, day: string): RecallStep {
  if (c.isNew) return 'hint';
  const intro = introDayOf(c.doc);
  const rows = rowsOf(c.doc).filter((r) => !r.known);
  if (intro === day) return rows.some((r) => dayKey(r.t) === day && (r.g ?? 0) >= FREE_MIN_GRADE) ? 'free' : 'hint';
  if (intro === null || intro > day) return null;
  // Gestern-Check: seit dem Einführungstag keine Antwort an einem anderen Tag (auch nach „Kenne ich“, das erst am nächsten Tag zählt).
  return rows.every((r) => dayKey(r.t) === intro) ? 'check' : null;
}

/** War der Einführungstag genau der Vortag (Beschriftung „Gestern-Check“ statt „Erster Abruf“)? */
export const introWasYesterday = (doc: Doc, day: string): boolean => introDayOf(doc) === addDays(day, -1);

/**
 * „Kenne ich“ zählt erst am nächsten Lerntag: Die letzte Antwort war die bestandene Prüffrage (`m:'known'`) an einem früheren Tag,
 * und jetzt gelingt ein freier Abruf. Dann gilt die Karte als bekannt (Stufe 3), sonst lernt sie wie jede andere.
 */
export function knownConfirmed(doc: Doc, a: FreshAnswer): boolean {
  const last = rowsOf(doc).at(-1);
  return !!last && last.known && dayKey(last.t) < dayKey(a.t) && freshFreeGood(a);
}
