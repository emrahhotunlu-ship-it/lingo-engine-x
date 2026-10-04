// Messwerte in der Diagnose (plan.md N95, leistung.md §4 Nr. 10): `lx:boot` (Bundle ausgewertet),
// `lx:live` (Abos geliefert und geprüft), `lx:status` (Heute lesbar) als Zeitpunkt seit dem Laden,
// `lx:card` (Weiter → nächste Karte) als Dauer der letzten Messung. Emrah sieht am iPhone echte
// Werte und kann sie kopieren oder per Kommentar mitschicken.

export const PERF_NAMES = ['lx:boot', 'lx:live', 'lx:status', 'lx:card'] as const;
export type PerfName = (typeof PERF_NAMES)[number];
export type PerfRow = { name: PerfName; ms: number | null };

type Entries = Pick<Performance, 'getEntriesByName'>;

function durationOf(e: PerformanceEntry | undefined): number | null {
  if (!e) return null;
  if (e.entryType === 'measure') return e.duration;
  const detail = (e as PerformanceMark).detail as unknown;
  if (detail && typeof detail === 'object' && typeof (detail as { ms?: unknown }).ms === 'number') return (detail as { ms: number }).ms;
  return null;
}

/** Liest die vier Messpunkte; fehlt einer (z. B. noch keine Karte gezeigt), ist `ms` `null`. */
export function readPerfMarks(perf: Entries | null = typeof performance !== 'undefined' ? performance : null): PerfRow[] {
  return PERF_NAMES.map((name) => {
    if (!perf) return { name, ms: null };
    if (name === 'lx:card') {
      const measures = perf.getEntriesByName(name, 'measure');
      const marks = perf.getEntriesByName(name, 'mark');
      const ms = durationOf(measures[measures.length - 1]) ?? durationOf(marks[marks.length - 1]);
      return { name, ms: ms === null ? null : Math.round(ms * 10) / 10 };
    }
    const first = perf.getEntriesByName(name, 'mark')[0];
    return { name, ms: first ? Math.round(first.startTime) : null };
  });
}

/** Eine Zeile zum Kopieren: `lx:boot=412ms lx:live=600ms lx:status=1346ms lx:card=12ms`. */
export function perfText(rows: readonly PerfRow[]): string {
  return rows.map((r) => `${r.name}=${r.ms === null ? '–' : `${r.ms}ms`}`).join(' ');
}
