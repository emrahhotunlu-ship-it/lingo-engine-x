import { addDays, dayKey, daysBetween } from '../date';
import { CATALOG } from '../srs/modes';
import { lapsesOf } from '../srs/lapses';
import { introDayOf, isFreeForm, KERN_FROM, LONG_GAP_DAYS, rowsOf } from '../srs/spacing';
import { FREE_MIN_GRADE } from '../srs/variety';
import type { TrainCard } from '../srs/types';

// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, „Messbar“): sechs Kennzahlen aus dem gespeicherten Verlauf (`hist`, höchstens 12 Einträge je Karte).
// Rein und nur lesend. Täglich ins Diagnose-Protokoll (`session.ts` → `reportWordKern`) und in Worten unter „Messwerte dahinter“.
// Grenzen: Der Verlauf hält nur die letzten 12 Antworten je Karte; ältere Belege fallen heraus. Die Zahlen beschreiben deshalb die letzten Wochen, nicht die ganze Geschichte.

type Card = Pick<TrainCard, 'doc' | 'kind' | 'isNew' | 'hidden'>;
type Row = ReturnType<typeof rowsOf>[number];

/** Zeitfenster der Quoten (Lerntage). */
export const WK_WINDOW_DAYS = 28;
/** Längeres Fenster für seltene Ereignisse (Abruf nach langer Pause, Tage bis „Sicher“). */
export const WK_LONG_WINDOW_DAYS = 90;
/** Ab so vielen Messpunkten nennt die Anzeige eine Quote. */
export const WK_MIN_N = 5;
/** „Folgetag frei“: der erste Abruf nach dem Einführungstag zählt nur, wenn er höchstens so viele Lerntage danach liegt. */
export const WK_NEXT_DAY_MAX = 2;
/** „Problemwort“: so oft (oder öfter) vergessen. */
export const PROBLEM_LAPSES = 2;

/** Ziele aus dem Plan (Diagnose und Anzeige). */
export const WK_TARGETS = { nextDay: 0.7, chunkFirst: 0.55, longGap: 0.85, medianSafeDays: 14, problemShare: 0.05, freeToRecog: 2 } as const;

/** Erkennen: Auswahl, Markieren und Aufdecken (Selbsturteil). */
const RECOG: ReadonlySet<string> = new Set([...CATALOG.filter((d) => d.input === 'choice' || d.input === 'spot').map((d) => d.ex as string), 'flip']);

export type Rate = { n: number; ok: number; share: number | null };
export type WordKernStats = {
  /** Erster Abruf an einem Tag nach dem Einführungstag (höchstens 2 Lerntage danach, nur Karten mit gespeichertem `intro` ab `KERN_FROM`), frei: Anteil richtig. */
  nextDay: Rate;
  /** Erste freie Antwort je Wendung: Anteil richtig. */
  chunkFirst: Rate;
  /** Freie Antworten nach ≥ 21 Tagen Pause: Anteil richtig. */
  longGap: Rate;
  /** Median der Tage vom Einführungstag bis zum 2. Tag mit freiem richtigem Abruf („Sicher“); `n` = erreichte Karten. */
  medianSafe: { days: number | null; n: number };
  /** Gelernte Karten mit mindestens 2 Rückfällen. */
  problem: { n: number; of: number; share: number | null };
  /** Freie Antworten gegen Antworten im Erkennen (Fenster 28 Tage). */
  ratio: { free: number; recog: number; value: number | null };
};

const rate = (n: number, ok: number): Rate => ({ n, ok, share: n ? ok / n : null });
const verifiedFree = (r: Row): boolean => !r.known && !r.u && !r.h && isFreeForm(r.x, r.ci);
/** Antworten, die eine Pause nicht unterbrechen (wie `spacing.ts`): Partnerwort-Fehler und „Welches Wort passt?“. */
const breaksPause = (r: Row): boolean => !r.ci && r.x !== 'contrast';
const good = (r: Row): boolean => (r.g ?? 0) >= FREE_MIN_GRADE;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function wordKernStats(cards: readonly Card[], today: string): WordKernStats {
  const from = addDays(today, -WK_WINDOW_DAYS);
  const fromLong = addDays(today, -WK_LONG_WINDOW_DAYS);
  let nd = 0;
  let ndOk = 0;
  let cf = 0;
  let cfOk = 0;
  let lg = 0;
  let lgOk = 0;
  let free = 0;
  let recog = 0;
  let learned = 0;
  let problem = 0;
  const safeDays: number[] = [];
  for (const c of cards) {
    if (c.hidden) continue;
    if (!c.isNew) {
      learned++;
      if (lapsesOf(c.doc) >= PROBLEM_LAPSES) problem++;
    }
    const rows = rowsOf(c.doc).filter((r) => !r.known);
    const intro = introDayOf(c.doc);
    if (intro !== null) {
      // Prüfung Lernwissenschaft S10: nur Karten, deren Einführungstag der neue Code gespeichert hat, und nur ein Abruf kurz danach.
      const first = intro >= KERN_FROM ? rows.find((r) => dayKey(r.t) > intro) : undefined;
      if (first && dayKey(first.t) >= from && daysBetween(intro, dayKey(first.t)) <= WK_NEXT_DAY_MAX && verifiedFree(first)) {
        nd++;
        if (good(first)) ndOk++;
      }
      const days = [...new Set(rows.filter((r) => verifiedFree(r) && good(r)).map((r) => dayKey(r.t)))].sort();
      const second = days[1];
      if (second && second >= fromLong) safeDays.push(Math.max(0, daysBetween(intro, second)));
    }
    if (c.kind === 'chunk') {
      const f = rows.find(verifiedFree);
      if (f && dayKey(f.t) >= from) {
        cf++;
        if (good(f)) cfOk++;
      }
    }
    let prev: Row | undefined;
    for (const r of rows) {
      const d = dayKey(r.t);
      if (d >= from) {
        if (verifiedFree(r)) free++;
        else if (r.x !== null && RECOG.has(r.x)) recog++;
      }
      if (prev && d >= fromLong && verifiedFree(r) && r.x !== 'cloze_part' && daysBetween(dayKey(prev.t), d) >= LONG_GAP_DAYS) {
        lg++;
        if (good(r)) lgOk++;
      }
      if (breaksPause(r)) prev = r;
    }
  }
  return {
    nextDay: rate(nd, ndOk),
    chunkFirst: rate(cf, cfOk),
    longGap: rate(lg, lgOk),
    medianSafe: { days: median(safeDays), n: safeDays.length },
    problem: { n: problem, of: learned, share: learned ? problem / learned : null },
    ratio: { free, recog, value: recog ? free / recog : null },
  };
}

const pct = (r: Rate): string => (r.share === null ? 'keine Messwerte' : `${Math.round(r.share * 100)} % von ${r.n}`);

/** Eine Zeile fürs Diagnose-Protokoll (nur Zahlen, keine Inhalte). */
export function wordKernLine(s: WordKernStats): string {
  return [
    `Folgetag frei (≤ 2 Lerntage, neue Karten): ${pct(s.nextDay)} (Ziel ≥ 70 %)`,
    `erste freie Antwort Wendung: ${pct(s.chunkFirst)} (Ziel ≥ 55 %)`,
    `frei nach ≥ 21 Tagen: ${pct(s.longGap)} (Ziel ≥ 85 %)`,
    `Median bis Sicher: ${s.medianSafe.days === null ? 'keine Messwerte' : `${s.medianSafe.days} Tage bei ${s.medianSafe.n}`} (Ziel ≤ 14)`,
    `Problemwörter: ${s.problem.share === null ? 'keine Messwerte' : `${Math.round(s.problem.share * 100)} % (${s.problem.n} von ${s.problem.of})`} (Ziel < 5 %)`,
    `frei : Erkennen = ${s.ratio.free} : ${s.ratio.recog} (Ziel ≥ 2 : 1)`,
  ].join(' · ');
}
