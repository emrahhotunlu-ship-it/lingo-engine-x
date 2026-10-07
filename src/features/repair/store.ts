import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { reviewError } from '../../domain/grammar/errors';
import { addRepairs, readRepairs, reviewRepair, type NewRepair, type RepairItem } from '../../domain/repair/repair';
import { logError } from '../../platform/diagnostics';

// Schreibwege für `app/repair` (Lernberatung 27.09., V2): immer ein `transform` auf dem frischen
// Stand, nur ergänzen bzw. die eine Wiederholung eintragen. Nie gelöscht außer über die Kappung.

export const REPAIR_PATH = 'app/repair';

type Doc = Record<string, unknown>;

const opFor = (cur: Readonly<Doc> | undefined, items: RepairItem[]) => (cur ? { update: { items } } : { set: { items } });

/**
 * Regel 6 (Kap. 9): Ein unerwarteter Stand wird nie überschrieben. `items` muss eine Liste sein,
 * und jeder Eintrag muss lesbar sein – sonst wird nichts geschrieben (gemeldet über das Protokoll).
 */
function writable(cur: Readonly<Doc> | undefined): boolean {
  if (!cur || cur.items == null) return true;
  if (!Array.isArray(cur.items)) return false;
  return readRepairs(cur).length === cur.items.length;
}

/** Reparatur-Sätze anlegen (z. B. aus Sag es, Gespräch, Schreiben). true = gespeichert oder nichts zu tun. */
export async function saveRepairs(add: readonly NewRepair[]): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !add.length) return false;
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      if (!writable(cur)) {
        logError('repair:save', new Error('app/repair unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
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
export async function recordRepair(id: string, ok: boolean, near = false): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const t = Date.now();
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      if (!writable(cur)) {
        logError('repair:review', new Error('app/repair unerwarteter Aufbau – nicht geschrieben'), id);
        return null;
      }
      const next = reviewRepair(readRepairs(cur), id, ok, t, near);
      return next ? opFor(cur, next) : null;
    });
    return true;
  } catch (err) {
    logError('repair:review', err, id);
    return false;
  }
}

/**
 * Eine Wiederholung eines Grammatik-Fehlersatzes (`grammar/<thema>.errors`) eintragen: nur Box und Fälligkeit des einen Eintrags
 * (`reviewError`, Boxen 1/3/9 wie bisher). Thema-Beherrschung (`p`, `n`, `c`) bleibt unberührt – hier wird ein Satz umgeschrieben,
 * keine Grammatikaufgabe gelöst. Ein unerwarteter Aufbau wird nie angefasst.
 */
export async function recordGrammarError(topic: string, errorT: number, ok: boolean, given: string, near = false, variant = false): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `grammar/${topic}`;
  const t = Date.now();
  try {
    await writer.transform(path, (cur) => {
      if (!cur || !validateDoc(path, cur).ok) return null;
      const errors = Array.isArray(cur.errors) ? (cur.errors as Parameters<typeof reviewError>[0]) : [];
      const next = reviewError(errors, errorT, { ok, given, grade: ok ? 3 : 1, t, near, variant });
      return next ? { update: { errors: next } } : null;
    });
    return true;
  } catch (err) {
    logError('repair:grammar', err, path);
    return false;
  }
}
