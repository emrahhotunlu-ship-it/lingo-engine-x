import { getWriter } from '../../data';
import { releaseUnitOp } from '../../domain/lexicon/unitHeld';
import { logError } from '../../platform/diagnostics';

/** „Doch lernen“ für eine ruhende Lesekarte: `lu` ergänzen, über den einen Schreibweg (frischer Stand, nichts löschen). */
export async function releaseHeldUnit(path: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(path, (cur) => releaseUnitOp(path, cur, Date.now()));
    return true;
  } catch (err) {
    logError('tutor:held-unit', err, path);
    return false;
  }
}
