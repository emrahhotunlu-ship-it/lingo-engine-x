import { dayKey, daysBetween } from '../date';
import { actDifferences, vectorOf } from '../srs/actBrief';
import { canHideTarget } from '../srs/actTask';
import type { TrainCard } from '../srs/types';
import type { ActEntry } from './actDoc';

// Messung „einsatzbereit“ (Wörter aktivieren, Stufe 2; docs/umbau/aktivierung.md „Messung“). Ein Wort gilt als einsatzbereit, wenn
//  - die Karte mindestens Stufe 4 hat,
//  - es mindestens zwei von Claude geprüfte, richtige Aktivierungen gibt, die sich in mindestens drei Merkmalen unterscheiden (Lage, Gegenüber, Textsorte, Ton,
//    Zeitform, Besonderheit), von denen eine ohne gezeigtes Wort war (A4),
//  - diese beiden mindestens 14 Tage auseinanderliegen und
//  - die letzte richtige Aktivierung höchstens so viele Tage zurückliegt wie das Intervall der Karte plus 7 (mindestens 60): Eine reife Karte kommt nur alle paar
//    Monate dran und fiele sonst ohne Vergessen aus der Zahl (Lernwissenschaft M5).
// Ein kleiner Fehler (Zeitform, Präposition …), bei dem das Hauptwort richtig benutzt war, zählt; ein Fehler in Wortwahl, Kollokation oder falschem Freund nicht.
// Wörter, die im Deutschen gleich lauten (Compliance), lassen sich bei A4 nicht verdecken: dort entfällt die Bedingung „ohne gezeigtes Wort“.
// Ungeprüfte Sätze (Claude nicht erreichbar) zählen nie. Bei Kombi-Aufgaben und Kundenmails zählt auch das Partnerwort, wenn Claude es als richtig benutzt ausweist.
// Reine Funktionen; die Zahl wird aus `act/…` berechnet und nie gespeichert.

export const READY_MIN_STAGE = 4;
export const READY_MIN_DIFFERENT = 3;
export const READY_MIN_GAP_DAYS = 14;
export const READY_MAX_AGE_DAYS = 60;
/** Zuschlag auf das Intervall der Karte für die Altersgrenze. */
export const READY_AGE_SLACK_DAYS = 7;
/** Fehlerklassen, die das Zielwort selbst betreffen können: Ein „kleiner Fehler“ dieser Art zählt nicht als richtige Benutzung. */
const WORD_ERRORS: ReadonlySet<string> = new Set(['word_choice', 'collocation', 'false_friend']);

/** Wie viele Tage darf die letzte richtige Aktivierung zurückliegen? Mindestens 60, bei langem Intervall der Karte mehr. */
export function readyMaxAge(card: Partial<Pick<TrainCard, 'fsrs'>>): number {
  const f = card.fsrs;
  const interval = f && typeof f.last === 'number' && Number.isFinite(f.last) && f.due > f.last ? Math.round((f.due - f.last) / 86_400_000) : Math.round(f?.stability ?? 0);
  return Math.max(READY_MAX_AGE_DAYS, interval + READY_AGE_SLACK_DAYS);
}
/** Trefferquoten werden erst ab so vielen geprüften Aktivierungen je Gruppe gezeigt. */
export const RATE_MIN_N = 5;

/** Zählt dieser Eintrag als geprüfte, richtige Aktivierung dieser Karte? */
export function qualifies(e: ActEntry, cardKey: string): boolean {
  if (e.k !== 1) return false;
  if (e.c === cardKey) return e.v === 'c' || (e.v === 'm' && !(e.et && WORD_ERRORS.has(e.et)));
  return !!e.ts?.some(([k, v]) => k === cardKey && v === 'c');
}

/** Ist das Wort dieser Karte einsatzbereit? `today` = Lerntag. */
export function isReady(card: Pick<TrainCard, 'key' | 'stage' | 'hidden'> & Partial<Pick<TrainCard, 'kind' | 'de' | 'def' | 'lemma' | 'fsrs'>>, entries: readonly ActEntry[], today: string): boolean {
  if (card.hidden || card.stage < READY_MIN_STAGE) return false;
  const good = entries.filter((e) => qualifies(e, card.key)).sort((a, b) => a.t - b.t);
  if (good.length < 2) return false;
  const last = good.at(-1) as ActEntry;
  if (daysBetween(last.d, today) > readyMaxAge(card)) return false;
  // Lässt sich das Wort bei A4 gar nicht verdecken, entfällt die Bedingung „einmal ohne gezeigtes Wort“.
  const hideable = card.lemma === undefined || canHideTarget({ kind: card.kind ?? 'vocab', de: card.de ?? null, def: card.def ?? null, lemma: card.lemma }, 'de');
  for (let i = 0; i < good.length; i++) {
    for (let j = i + 1; j < good.length; j++) {
      const a = good[i] as ActEntry;
      const b = good[j] as ActEntry;
      if (hideable && !a.ns && !b.ns) continue;
      if (daysBetween(a.d, b.d) < READY_MIN_GAP_DAYS) continue;
      const va = vectorOf(a.a);
      const vb = vectorOf(b.a);
      if (va && vb && actDifferences(va, vb) >= READY_MIN_DIFFERENT) return true;
    }
  }
  return false;
}

export function readyCount(cards: ReadonlyArray<Parameters<typeof isReady>[0]>, entries: readonly ActEntry[], today: string): number {
  let n = 0;
  for (const c of cards) if (isReady(c, entries, today)) n++;
  return n;
}

export type ActRates = {
  /** Aktivierungen mit gezeigtem Wort (A1–A3, A5): geprüft, davon richtig. */
  shown: { n: number; ok: number };
  /** Aktivierungen ohne gezeigtes Wort (A4). */
  hidden: { n: number; ok: number };
};

/** Begleitwert: Trefferquote mit und ohne Vorgabe (nur von Claude geprüfte Aktivierungen). */
export function activationRates(entries: readonly ActEntry[]): ActRates {
  const out: ActRates = { shown: { n: 0, ok: 0 }, hidden: { n: 0, ok: 0 } };
  for (const e of entries) {
    if (e.k !== 1) continue;
    const g = e.ns ? out.hidden : out.shown;
    g.n++;
    if (e.v === 'c') g.ok++;
  }
  return out;
}

/** Prozent als Zahl, `null` bei zu wenig Daten (< `RATE_MIN_N`). */
export const ratePct = (g: { n: number; ok: number }): number | null => (g.n >= RATE_MIN_N ? Math.round((g.ok / g.n) * 100) : null);

/** Lerntag eines Zeitstempels (Hilfe für Tests und Anzeige). */
export const dayOf = (t: number): string => dayKey(t);
