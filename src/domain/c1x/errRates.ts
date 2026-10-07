import type { C1Item } from './types';

// Messwerte zu „Fehler finden“ (Lernplattform 3.0 P17, Quelle für K6): je Muster die Trefferquote (Fehler gefunden) und die Fehlalarmquote
// (fehlerfreien Satz als falsch angetippt). Rein: Eingabe sind die Protokolleinträge `log/<tag>.entries` (nur `k 'g'`, `c1k 'err'`) und die Aufgaben.

export type ErrLogEntry = { c1k?: string; cid?: string; pat?: string; pts?: [number, number] | number[]; ok?: boolean };
export type ErrRates = { pat: string; found: number; withError: number; hit: number | null; falseAlarms: number; clean: number; falseAlarm: number | null };

export function errRates(entries: readonly ErrLogEntry[], itemOf: (id: string) => C1Item | null): ErrRates[] {
  const by = new Map<string, { found: number; withError: number; fa: number; clean: number }>();
  for (const e of entries) {
    if (e.c1k !== 'err' || !e.cid || !Array.isArray(e.pts)) continue;
    const item = itemOf(e.cid);
    if (!item || item.kind !== 'err') continue;
    const pat = e.pat ?? item.pat;
    if (!pat) continue;
    const row = by.get(pat) ?? { found: 0, withError: 0, fa: 0, clean: 0 };
    const got = typeof e.pts[0] === 'number' ? e.pts[0] : 0;
    if (item.bad) {
      row.withError++;
      // Fundort gefunden = mindestens 1 Punkt (Fundort zählt 1, Korrektur 1).
      if (got >= 1) row.found++;
    } else {
      row.clean++;
      if (got < 2) row.fa++;
    }
    by.set(pat, row);
  }
  return [...by.entries()]
    .map(([pat, r]) => ({ pat, found: r.found, withError: r.withError, hit: r.withError ? r.found / r.withError : null, falseAlarms: r.fa, clean: r.clean, falseAlarm: r.clean ? r.fa / r.clean : null }))
    .sort((a, b) => a.pat.localeCompare(b.pat));
}
