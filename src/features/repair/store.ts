import { getWriter } from '../../data';
import { addRepairs, readRepairs, reviewRepair, type NewRepair, type RepairItem } from '../../domain/repair/repair';
import { logError } from '../../platform/diagnostics';

// Schreibwege für `app/repair` (Lernberatung 27.09., V2): immer ein `transform` auf dem frischen
// Stand, nur ergänzen bzw. die eine Wiederholung eintragen. Nie gelöscht außer über die Kappung.

export const REPAIR_PATH = 'app/repair';

type Doc = Record<string, unknown>;

const opFor = (cur: Readonly<Doc> | undefined, items: RepairItem[]) => (cur ? { update: { items } } : { set: { items } });

/** Reparatur-Sätze anlegen (z. B. aus Sag es, Gespräch, Schreiben). true = gespeichert oder nichts zu tun. */
export async function saveRepairs(add: readonly NewRepair[]): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !add.length) return false;
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      const next = addRepairs(readRepairs(cur), add, Date.now());
      return next ? opFor(cur, next) : null;
    });
    return true;
  } catch (err) {
    logError('repair:save', err);
    return false;
  }
}

/** Eine Wiederholung eintragen (richtig/falsch). */
export async function recordRepair(id: string, ok: boolean): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const t = Date.now();
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      const next = reviewRepair(readRepairs(cur), id, ok, t);
      return next ? opFor(cur, next) : null;
    });
    return true;
  } catch (err) {
    logError('repair:review', err, id);
    return false;
  }
}
