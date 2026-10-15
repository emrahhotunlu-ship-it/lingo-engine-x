import { dayKey } from '../date';

// Belastung durch Rückfälle (Auswertung 15.10.2026, Punkt 6; Prüfung M4): Fallen von den WIEDERHOLUNGEN der letzten 7 Tage mindestens 25 % durch, wächst die
// Wiederholungslast schneller, als neue Wörter sie tragen. Dann gibt es einen Vorschlag, weniger neue Wörter am Tag einzustellen. Nie ein stilles Ändern der
// Einstellung. Rein, nur lesend.
//
// Eine Wiederholung ist eine Antwort auf eine Karte, die an einem FRÜHEREN Tag schon einmal richtig beantwortet war. Fehler am Einführungstag, in den Lernschritten
// desselben Tages und bei der ersten Begegnung zählen nicht: Junge Karten fallen bei fünf neuen Wörtern am Tag fast immer einmal durch, das ist kein Rückfall.

type Doc = Readonly<Record<string, unknown>>;

const DAY = 86_400_000;
/** Anteil der Wiederholungen mit Fehler (Rückfall), ab dem der Hinweis kommt. */
export const LAPSE_LOAD_SHARE = 0.25;
/** Mindestens so viele geübte Karten, sonst sagt der Anteil nichts. */
export const LAPSE_LOAD_MIN_CARDS = 8;
/** Mindestens so viele Wiederholungen im Fenster. */
export const LAPSE_LOAD_MIN_REVIEWS = 12;
/** Das Fenster der Auswertung in Tagen. */
export const LAPSE_LOAD_DAYS = 7;
// Kein Rückfall: Aufdecken-Hilfen der Einführung („Kenne ich“) und der Kontrast-Schritt (Verlauf, keine Abfrage der Karte). Aufdecken „Nochmal“ (`flip`) ist echtes Vergessen und zählt.
const NOT_A_REVIEW: ReadonlySet<string> = new Set(['known', 'contrast']);
// Fehler am Partnerwort einer Kollokation (`ci` = Index ≥ 0) sind kein Rückfall der Hauptkarte (Punkt 3). Die Pack-Lücke ohne `ci` (Index −1) ist einer.
const PARTNER_EX: ReadonlySet<string> = new Set(['colloc', 'colloc_gap']);

export type LapseLoad = { practiced: number; reviews: number; lapsed: number; share: number; high: boolean };

type Row = { t: number; g: number; x: string; partner: boolean };

function rowsOf(d: Doc): Row[] {
  if (!Array.isArray(d.hist)) return [];
  const out: Row[] = [];
  for (const h of d.hist as unknown[]) {
    if (!h || typeof h !== 'object') continue;
    const r = h as Record<string, unknown>;
    const t = typeof r.t === 'number' ? r.t : 0;
    const x = typeof r.x === 'string' ? r.x : '';
    if (t <= 0 || NOT_A_REVIEW.has(x)) continue;
    out.push({ t, g: typeof r.g === 'number' ? r.g : 0, x, partner: PARTNER_EX.has(x) && typeof r.ci === 'number' });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Wiederholungen der letzten 7 Tage und davon die Rückfälle. Eine Antwort zählt als Wiederholung, wenn die Karte vorher an einem früheren Tag richtig war
 * (Verlauf; ist der Verlauf gekürzt, gilt eine Karte mit Einführungsdatum vor dem Tag der Antwort als schon bekannt).
 */
export function lapseLoad(vocab: ReadonlyMap<string, Doc> | undefined, nowMs: number): LapseLoad {
  let practiced = 0;
  let reviews = 0;
  let lapsed = 0;
  for (const d of vocab?.values() ?? []) {
    if (d.hidden === true) continue;
    const rows = rowsOf(d);
    const intro = typeof d.intro === 'string' ? d.intro : '';
    let seen = false;
    rows.forEach((r, i) => {
      if (nowMs - r.t >= LAPSE_LOAD_DAYS * DAY || r.t > nowMs) return;
      seen = true;
      const day = dayKey(r.t);
      const earlierOk = rows.slice(0, i).some((p) => p.g >= 2 && dayKey(p.t) < day);
      const known = earlierOk || (i === 0 && intro !== '' && intro < day);
      if (!known) return;
      if (r.partner) return;
      reviews++;
      if (r.g === 1) lapsed++;
    });
    if (seen) practiced++;
  }
  const share = reviews ? lapsed / reviews : 0;
  return { practiced, reviews, lapsed, share, high: practiced >= LAPSE_LOAD_MIN_CARDS && reviews >= LAPSE_LOAD_MIN_REVIEWS && share >= LAPSE_LOAD_SHARE };
}

/** Der nächstkleinere erlaubte Wert für „neue Wörter pro Tag“ (nie 0), oder `null`, wenn es keinen gibt. */
export function lowerNewPerDay(current: number): number | null {
  const lower = [2, 5, 10].filter((o) => o < current);
  return lower.length ? (lower[lower.length - 1] ?? null) : null;
}
