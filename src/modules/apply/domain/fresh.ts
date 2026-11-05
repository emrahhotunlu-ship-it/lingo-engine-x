import { addDays, daysBetween } from '../shared';
import type { WriteKind } from './count';

// Keine schnelle Wiederholung (W5 K14, Lehrer-Prüfung F3): dieselbe Mail, Situation oder derselbe Artikel kommt frühestens nach 14 Tagen wieder. Grundlage sind
// die schon gespeicherten Ergebnisse in `out/<Monat>` (Eintrag `theme` = Kennung des Materials, `d` = Lerntag); es entsteht kein neues Dokument. Rein.
// - Einträge von HEUTE zählen nicht: so bleibt die Wahl über den ganzen Lerntag dieselbe (Kap. 15: nichts würfelt sich neu), auch nach dem Prüfen.
// - Fehlt Neues, kommt das am längsten nicht gezeigte (bei Gleichstand das erste der festen Reihenfolge).

type Doc = Readonly<Record<string, unknown>>;

export const FRESH_DAYS = 14;

/** Arten in `out/<Monat>` je Disziplin (Schreiben speichert wie die Wochen-Mail als `c1mail`). */
const OUT_KINDS: Readonly<Record<WriteKind, readonly string[]>> = { reply: ['reply'], write: ['c1mail'], summary: ['summary'] };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monatsdokumente, die die letzten 14 Tage abdecken (heute und der Monat vor 14 Tagen), als Lerntage für `outPath`. */
export const historyDays = (day: string): string[] => [day, addDays(day, -FRESH_DAYS)];

/** Material-Kennung → letzter Lerntag VOR `day`, an dem es in dieser Disziplin geprüft wurde. Unlesbares wird übersprungen. */
export function lastShown(outDocs: ReadonlyArray<Doc | null | undefined>, kind: WriteKind, day: string): Map<string, string> {
  const kinds = new Set(OUT_KINDS[kind]);
  const last = new Map<string, string>();
  for (const doc of outDocs) {
    const items = doc && Array.isArray(doc.items) ? (doc.items as unknown[]) : [];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Doc;
      if (typeof o.k !== 'string' || !kinds.has(o.k)) continue;
      if (typeof o.theme !== 'string' || !o.theme || typeof o.d !== 'string' || !DAY_RE.test(o.d) || o.d >= day) continue;
      const cur = last.get(o.theme);
      if (!cur || o.d > cur) last.set(o.theme, o.d);
    }
  }
  return last;
}

/** Das erste Material der festen Reihenfolge, das seit mindestens 14 Tagen nicht dran war; sonst das am längsten nicht gezeigte. `null` ohne Material. */
export function pickFresh<T>(cands: readonly T[], idOf: (t: T) => string, last: ReadonlyMap<string, string>, day: string, gap: number = FRESH_DAYS): T | null {
  let oldest: { t: T; d: string } | null = null;
  for (const t of cands) {
    const d = last.get(idOf(t));
    if (!d || daysBetween(d, day) >= gap) return t;
    if (!oldest || d < oldest.d) oldest = { t, d };
  }
  return oldest?.t ?? null;
}

/** Feste Reihenfolge eines Vorrats für einen Lerntag: ab einer Stelle, die der Tag bestimmt, der Reihe nach rundherum. */
export function rotate<T>(list: readonly T[], start: number): T[] {
  if (!list.length) return [];
  const s = ((start % list.length) + list.length) % list.length;
  return [...list.slice(s), ...list.slice(0, s)];
}
