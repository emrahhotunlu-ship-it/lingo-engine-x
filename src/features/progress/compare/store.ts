import { getWriter } from '../../../data';
import { addRun, COMPARE_PATH, compareWritable, readCompare, withVerdict, type CompareRun, type CompareVerdict } from '../../../domain/compare/compare';
import { logError } from '../../../platform/diagnostics';

// Schreibwege für `app/compare` (Backlog B1): immer ein transform auf dem frischen Stand; ein
// unerwarteter Aufbau wird nie überschrieben (Kap. 9, Regel 6). Kein Löschen.

type Doc = Record<string, unknown>;
const opFor = (cur: Readonly<Doc> | undefined, items: CompareRun[]) => (cur ? { update: { v: 1, items } } : { set: { v: 1, items } });

/** Einen Lauf speichern (derselbe Monat wird ersetzt). */
export async function saveCompareRun(run: CompareRun): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(COMPARE_PATH, (cur) => {
      if (!compareWritable(cur)) {
        logError('compare:save', new Error('app/compare unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      return opFor(cur, addRun(readCompare(cur), run));
    });
    return true;
  } catch (err) {
    logError('compare:save', err, run.month);
    return false;
  }
}

/** Claudes Urteil an den Lauf des Monats hängen. */
export async function saveCompareVerdict(month: string, verdict: CompareVerdict): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(COMPARE_PATH, (cur) => {
      if (!cur || !compareWritable(cur)) return null;
      const next = withVerdict(readCompare(cur), month, verdict);
      return next ? { update: { items: next } } : null;
    });
    return true;
  } catch (err) {
    logError('compare:verdict', err, month);
    return false;
  }
}
