import { addDays, logWarn } from '../shared';
import { readRoutinePath } from './paths';
import { parseRoutineDoc } from './routine';

// Lesetür für das Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md: „Artikel zusammenfassen“): der neueste geprüfte Artikel der Routine aus den
// letzten Tagen als schlichter Text. Liest nur `read/r-<Tag>` (je ein `get`, nie die Sammlung) und schreibt nichts. Ein Lesefehler oder ein unbrauchbares
// Dokument überspringt nur diesen Tag.

type Doc = Record<string, unknown>;
export type RecentReader = (path: string) => Promise<Doc | undefined>;
export type RecentArticle = { id: string; day: string; title: string; text: string };

/** Tage zurück (heute und die drei Tage davor). */
export const RECENT_DAYS_BACK = 3;

/** Der neueste Artikel (erster gültiger Eintrag des jüngsten Tages), `null` = keiner. Absätze durch eine Leerzeile getrennt. */
export async function loadRecentArticle(read: RecentReader, today: string, daysBack: number = RECENT_DAYS_BACK): Promise<RecentArticle | null> {
  for (let back = 0; back <= daysBack; back++) {
    const day = addDays(today, -back);
    let doc: Doc | undefined;
    try {
      doc = await read(readRoutinePath(day));
    } catch (err) {
      logWarn('read:recent', err, readRoutinePath(day));
      continue;
    }
    const parsed = parseRoutineDoc(doc, day);
    if (!parsed.ok) continue;
    const item = parsed.items[0];
    if (!item) continue;
    const text = item.paras
      .map((p) => p.map((s) => s.e.trim()).filter(Boolean).join(' '))
      .filter(Boolean)
      .join('\n\n');
    if (text) return { id: item.id, day, title: item.title, text };
  }
  return null;
}
