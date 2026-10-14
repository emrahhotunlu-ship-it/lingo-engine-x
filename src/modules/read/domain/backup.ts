import { isDayKey } from '../shared';
import { readDaysOf } from './count';
import { monthOfDay, READ_PREFS_PATH, readDayPath, readMonthPath } from './paths';

// Sicherung der Sammlung `read` in begrenzter Größe (Plan §11 Nachtrag L3, Punkt für data-guard).
//
// Immer enthalten: `read/p` (Einstellungen) und alle Monatsindizes `read/m-…` (Titel und Lesezustand, ≈ 45 KB je Monat).
// Artikeltexte `read/d-…` nur, soweit sie in das Budget passen: neueste Tage zuerst, solange die Summe der JSON-Größen im Budget bleibt.
// Was nicht mehr passt, wird gezählt und gemeldet (nie still weggelassen). Die Dokumente selbst bleiben unangetastet in der Datenbank.

/** Obergrenze für die Artikeltexte in einer Sicherung (≈ 150 Artikel ≈ 50 Tage bei drei Artikeln täglich). */
export const READ_BACKUP_TEXT_BUDGET_BYTES = 1_500_000;

export type ReadBackupPlan = {
  /** Immer zu sichern: Einstellungen und Monatsindizes. */
  index: string[];
  /** Tagesdokumente, neueste zuerst (der Aufrufer liest sie der Reihe nach, bis das Budget erreicht ist). */
  texts: string[];
};

/** Welche Dokumente zur Sicherung gehören, aus `read/p`. */
export function readBackupPlan(prefs: Record<string, unknown> | undefined | null): ReadBackupPlan {
  const days = readDaysOf(prefs);
  const months = [...new Set(days.map(monthOfDay))];
  return { index: [READ_PREFS_PATH, ...months.map(readMonthPath)], texts: [...days].reverse().map(readDayPath) };
}

const encoder = new TextEncoder();
export const docBytes = (d: unknown): number => encoder.encode(JSON.stringify(d)).length;

/**
 * Nimmt Tagesdokumente (neueste zuerst) auf, solange das Budget reicht. Ein Dokument, das nicht mehr passt, beendet die Aufnahme
 * (ältere würden die Lücke nur unübersichtlich machen). Liefert, wie viele Tage fehlen.
 */
export function fitTextBudget(sizes: ReadonlyArray<{ path: string; bytes: number }>, budget = READ_BACKUP_TEXT_BUDGET_BYTES): { included: string[]; omitted: string[] } {
  const included: string[] = [];
  let used = 0;
  let i = 0;
  for (; i < sizes.length; i++) {
    const s = sizes[i]!;
    if (used + s.bytes > budget) break;
    used += s.bytes;
    included.push(s.path);
  }
  return { included, omitted: sizes.slice(i).map((s) => s.path) };
}

/**
 * Tage aus den Monatsindizes (`m-<Monat>.items[].day`), die zum Monat des Dokuments passen. Sicherheitsnetz für die Sicherung:
 * Fehlt ein Tag in `read/p.days` (Absturz nach dem Artikel, Wettlauf zweier Geräte), steht sein Text trotzdem in der Sicherung.
 */
export function daysFromMonthDocs(months: ReadonlyArray<{ month: string; data: Record<string, unknown> | undefined }>): string[] {
  const out = new Set<string>();
  for (const { month, data } of months) {
    const items = data && Array.isArray(data.items) ? (data.items as unknown[]) : [];
    for (const it of items) {
      const day = it && typeof it === 'object' ? (it as Record<string, unknown>).day : undefined;
      if (typeof day === 'string' && isDayKey(day) && monthOfDay(day) === month) out.add(day);
    }
  }
  return [...out].sort();
}

/** Die letzten `n` Monate (`JJJJ-MM`, neueste zuerst) ab einem Tag: für die Suche, wenn `read/p` fehlt. */
export function recentMonths(fromDay: string, n: number): string[] {
  const y = Number(fromDay.slice(0, 4));
  const m = Number(fromDay.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}
