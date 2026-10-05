import { getWriter } from '../../../data';
import { atlasDoc, atlasOp, type AtlasEntry } from '../../../domain/atlas/atlas';
import { logError } from '../../../platform/diagnostics';

/** Atlas-Eintrag als Karte anlegen (nur wenn es sie noch nicht gibt; nie ersetzen). `true`, wenn geschrieben wurde. */
export async function addAtlasCard(e: AtlasEntry, today: string, nowMs: number): Promise<boolean> {
  const writer = getWriter();
  const made = atlasDoc(e, today, nowMs);
  if (!writer || !made) return false;
  try {
    let wrote = false;
    await writer.transform(`vocab/${made.id}`, (cur) => {
      const op = atlasOp(cur, made);
      wrote = op !== null;
      return op;
    });
    return wrote;
  } catch (err) {
    logError('atlas:add', err, e.w);
    return false;
  }
}
