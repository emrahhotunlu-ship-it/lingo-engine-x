import { addDays } from '../date';
import { dowOf } from '../week/plan';

// Wörter pro Minute im 45-Sekunden-Durchgang (Neubau N73, Lehrer I2): lokal berechnet, ohne KI.
// Vergleich Dienstag ↔ Freitag: dieselbe Frage A der Woche, 45-s-Runde vom Dienstag derselben
// Kalenderwoche. Rein und getestet.

type Doc = Record<string, unknown>;

/** Wörter/Min. einer Runde (0 ohne Wörter oder Zeit). */
export function wpmOf(words: number, ms: number): number {
  if (words <= 0 || ms <= 0) return 0;
  return Math.round(words / (Math.max(ms, 5_000) / 60_000));
}

/** Die 45-s-Runde eines Eintrags (letzte Runde mit `sec: 45`). */
export function wpm45(item: Doc): number | null {
  const rounds = Array.isArray(item.rounds) ? (item.rounds as Doc[]) : [];
  const r = [...rounds].reverse().find((x) => x.sec === 45);
  return r && typeof r.wpm === 'number' && r.wpm > 0 ? r.wpm : null;
}

/** Dienstag derselben Kalenderwoche (Mo–So) – nur ab Mittwoch sinnvoll, sonst `null`. */
export function tuesdayOf(day: string): string | null {
  const dow = dowOf(day);
  return dow > 2 ? addDays(day, 2 - dow) : null;
}

/**
 * Wörter/Min. vom Dienstag derselben Woche: jüngster Eintrag des Dienstags mit derselben Frage,
 * sonst mit irgendeiner Frage. `docs` = die Monatsdokumente `fluency/<Monat>` (tolerant gelesen).
 */
export function tuesdayWpm(docs: readonly (Doc | null | undefined)[], day: string, q: string): number | null {
  const tue = tuesdayOf(day);
  if (!tue) return null;
  const items: Doc[] = [];
  for (const d of docs) if (d && Array.isArray(d.items)) for (const x of d.items as unknown[]) if (x && typeof x === 'object' && (x as Doc).day === tue) items.push(x as Doc);
  const byT = (a: Doc, b: Doc) => (typeof b.t === 'number' ? b.t : 0) - (typeof a.t === 'number' ? a.t : 0);
  const same = items.filter((i) => i.q === q).sort(byT);
  for (const i of [...same, ...items.sort(byT)]) {
    const w = wpm45(i);
    if (w !== null) return w;
  }
  return null;
}
