import { dayKey } from '../date';
import { logWarn } from '../../platform/diagnostics';
import { FREE_ANSWER, FREE_MIN_GRADE } from './variety';
import type { TrainCard } from './types';
import { wordKernLine, wordKernStats } from '../metrics/wordKern';

// Diagnosewerte zum Paket WL (19.10.2026), nur Lesen: Kommt der Satzwechsel an, und staut sich das Tor?

type Row = { t: number; x?: string; g?: number; s?: string; u?: number };
const rowsOf = (c: Pick<TrainCard, 'doc'>): Row[] =>
  (Array.isArray(c.doc.hist) ? (c.doc.hist as unknown[]) : []).filter((h): h is Row => !!h && typeof h === 'object' && typeof (h as Row).t === 'number').sort((a, b) => a.t - b.t);

/**
 * „Tor-Stau“: Karten auf Stufe 3 mit mindestens 4 freien Versuchen im Verlauf, von denen kein einziger „Gut“ oder besser war (nur Note 2 oder schlechter).
 * Sie kommen nicht auf Stufe 4, obwohl sie oft versucht werden.
 */
export function gateJam(cards: readonly Pick<TrainCard, 'stage' | 'doc' | 'hidden'>[]): number {
  let n = 0;
  for (const c of cards) {
    if (c.hidden || c.stage !== 3) continue;
    const free = rowsOf(c).filter((r) => typeof r.x === 'string' && FREE_ANSWER.has(r.x) && r.u !== 1);
    if (free.length >= 4 && free.every((r) => (r.g ?? 0) < FREE_MIN_GRADE)) n++;
  }
  return n;
}

/** Anteil der Wiederholungen ab Lerntag 2 (Antwort an einem Tag nach dem ersten Verlaufstag) mit einem anderen Satz als bei der Antwort davor. `null` ohne Messpunkte. */
export function sentenceChangeShare(cards: readonly Pick<TrainCard, 'doc'>[]): { share: number | null; n: number } {
  let n = 0;
  let changed = 0;
  for (const c of cards) {
    const rows = rowsOf(c).filter((r) => typeof r.s === 'string' && r.s);
    if (rows.length < 2) continue;
    const first = dayKey((rows[0] as Row).t);
    for (let i = 1; i < rows.length; i++) {
      const cur = rows[i] as Row;
      if (dayKey(cur.t) === first) continue;
      n++;
      if (cur.s !== (rows[i - 1] as Row).s) changed++;
    }
  }
  return { share: n ? changed / n : null, n };
}

let reportedFor = '';
/** Schreibt beide Werte einmal je Lerntag ins Diagnose-Protokoll (nur Zahlen, keine Inhalte). */
export function reportWlDiagnostics(cards: readonly TrainCard[], day: string): void {
  if (reportedFor === day) return;
  reportedFor = day;
  const jam = gateJam(cards);
  const sc = sentenceChangeShare(cards);
  logWarn('wl', { code: 'wl_stats', message: `Tor-Stau: ${jam} Karten · Satzwechsel ab Tag 2: ${sc.share === null ? 'keine Messwerte' : `${Math.round(sc.share * 100)} % von ${sc.n}`}` });
}

let kernReportedFor = '';
/** Wort-Lernen 2, Paket „Kern“: die sechs Kennzahlen (`metrics/wordKern.ts`) einmal je Lerntag ins Diagnose-Protokoll (nur Zahlen, keine Inhalte). */
export function reportWordKern(cards: readonly TrainCard[], day: string): void {
  if (kernReportedFor === day) return;
  kernReportedFor = day;
  logWarn('wl', { code: 'wk_stats', message: wordKernLine(wordKernStats(cards, day)) });
}
