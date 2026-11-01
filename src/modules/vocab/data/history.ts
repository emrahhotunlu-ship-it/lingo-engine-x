import { addDays, dayKey, logError } from '../shared';
import { isVlogTuple, type VlogTuple } from '../domain/vlog';
import { VLOG_INDEX_PATH, vlogIdsInRange, vlogIdsOf, vlogPath } from '../domain/vlogIndex';

// Großpaket A S6: Verlauf lesen (Wort-Seite N5, Übersicht M18, „Junge Wörter früher“). `vlog` ist träge (vlogIndex.ts): es wird nur gelesen,
// was den Zeitraum berührt, Dokument für Dokument über `read`. Ein fehlendes oder kaputtes Dokument liest sich leer (protokolliert).

type Doc = Record<string, unknown>;
export type ReadDoc = (path: string) => Promise<Doc | null>;

/** Alle gültigen Tupel der Lerntage `from`–`to` (rückgängig gemachte Einträge, `null`, fehlen). */
export async function readVlogRange(read: ReadDoc, from: string, to: string): Promise<VlogTuple[]> {
  const ix = await read(VLOG_INDEX_PATH);
  const ids = vlogIdsInRange(vlogIdsOf(ix), from, to);
  const docs = await Promise.allSettled(ids.map((id) => read(vlogPath(id))));
  const out: VlogTuple[] = [];
  docs.forEach((r, k) => {
    if (r.status === 'rejected') {
      logError('vocab:history', r.reason, vlogPath(ids[k]!));
      return;
    }
    const e = r.value?.e;
    if (!e || typeof e !== 'object') return;
    for (const v of Object.values(e as Record<string, unknown>)) {
      if (!isVlogTuple(v)) continue;
      const d = dayKey(v[0]);
      if (d >= from && d <= to) out.push(v);
    }
  });
  return out.sort((a, b) => a[0] - b[0]);
}

/** Die letzten `days` Lerntage bis heute. */
export function readVlogRecent(read: ReadDoc, nowMs: number, days: number): Promise<VlogTuple[]> {
  const today = dayKey(nowMs);
  return readVlogRange(read, addDays(today, -(days - 1)), today);
}
