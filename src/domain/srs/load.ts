// Belastung durch Rückfälle (Auswertung 15.10.2026, Punkt 6): Fallen in den letzten 7 Tagen mindestens die Hälfte der geübten Karten wieder durch, wächst die
// Wiederholungslast schneller, als neue Wörter sie tragen. Dann gibt es einen Vorschlag, weniger neue Wörter am Tag einzustellen. Nie ein stilles Ändern der
// Einstellung. Rein, nur lesend.

type Doc = Readonly<Record<string, unknown>>;

const DAY = 86_400_000;
/** Anteil der geübten Karten mit mindestens einem Fehler, ab dem der Hinweis kommt. */
export const LAPSE_LOAD_SHARE = 0.5;
/** Mindestens so viele geübte Karten, sonst sagt der Anteil nichts. */
export const LAPSE_LOAD_MIN_CARDS = 8;
/** Das Fenster der Auswertung in Tagen. */
export const LAPSE_LOAD_DAYS = 7;
// Fehler am Partnerwort einer Kollokation sind kein Rückfall der Karte (Punkt 3) und zählen hier nicht mit.
const NOT_A_LAPSE: ReadonlySet<string> = new Set(['colloc', 'colloc_gap', 'flip', 'known', 'contrast']);

export type LapseLoad = { practiced: number; lapsed: number; share: number; high: boolean };

/** Karten, die in den letzten 7 Tagen geübt wurden, und davon die mit mindestens einem Fehler (`hist[].g === 1`). */
export function lapseLoad(vocab: ReadonlyMap<string, Doc> | undefined, nowMs: number): LapseLoad {
  let practiced = 0;
  let lapsed = 0;
  for (const d of vocab?.values() ?? []) {
    if (d.hidden === true || !Array.isArray(d.hist)) continue;
    let seen = false;
    let miss = false;
    for (const h of d.hist as unknown[]) {
      if (!h || typeof h !== 'object') continue;
      const r = h as Record<string, unknown>;
      const t = typeof r.t === 'number' ? r.t : 0;
      if (t <= 0 || nowMs - t >= LAPSE_LOAD_DAYS * DAY || t > nowMs) continue;
      const x = typeof r.x === 'string' ? r.x : '';
      if (x === 'known') continue;
      seen = true;
      if (r.g === 1 && !NOT_A_LAPSE.has(x)) miss = true;
    }
    if (seen) practiced++;
    if (miss) lapsed++;
  }
  const share = practiced ? lapsed / practiced : 0;
  return { practiced, lapsed, share, high: practiced >= LAPSE_LOAD_MIN_CARDS && share >= LAPSE_LOAD_SHARE };
}

/** Der nächstkleinere erlaubte Wert für „neue Wörter pro Tag“ (nie 0), oder `null`, wenn es keinen gibt. */
export function lowerNewPerDay(current: number): number | null {
  const lower = [2, 5, 10].filter((o) => o < current);
  return lower.length ? (lower[lower.length - 1] ?? null) : null;
}
