import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { reviewError } from '../../domain/grammar/errors';
import { addRepairs, readRepairs, repairId, reviewRepair, type NewRepair, type RepairItem } from '../../domain/repair/repair';
import { fixedProblems } from '../../domain/text/correctness';
import { logError, logWarn } from '../../platform/diagnostics';

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

/** Reparatur-Sätze anlegen (z. B. aus Sag es, Gespräch, Schreiben). true = gespeichert oder nichts zu tun (alle schon da); false = nicht geschrieben (keine Datenbank, Fehler, unerwarteter Aufbau). */
export async function saveRepairs(input: readonly NewRepair[]): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !input.length) return false;
  // Selbstprüfung der besseren Fassung (Auswertung 15.10.2026): Was die KI als „richtig“ liefert, aber selbst noch einen eindeutigen Fehler hat, wird nicht
  // als Vorbild gespeichert (sonst übt Emrah den Fehler ein). Lehrer-Texte (Preply, Unterricht) stammen nicht von der KI und bleiben ungeprüft.
  const add = input.filter((a) => {
    if (a.src === 'teacher' || a.src === 'preply' || a.src === 'lesson') return true;
    const problem = fixedProblems(a.right)[0];
    if (!problem) return true;
    logWarn('repair:selfcheck', { code: 'unsure_fix', message: `bessere Fassung nicht gespeichert: ${problem.id}` });
    return false;
  });
  if (!add.length) return true;
  // Unerwarteter Aufbau: nichts geschrieben, also auch nicht „gespeichert“ melden (data-guard P40, Sollte 4).
  let blocked = false;
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      blocked = !writable(cur);
      if (blocked) {
        logError('repair:save', new Error('app/repair unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      const next = addRepairs(readRepairs(cur), add, Date.now());
      return next ? opFor(cur, next) : null;
    });
    return !blocked;
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

/**
 * Gemeldete Claude-Fehlersätze (Lernplattform 3.0 P46/P47) aus der Wiederholung nehmen: Der Eintrag wird `done` (erledigt), nie gelöscht.
 * `wrongs` sind die falschen Sätze, aus denen die Einträge entstanden sind (die Kennung ist daraus abgeleitet); nur Einträge der genannten
 * Herkunft (`src`). `true` = geschrieben oder schon markiert; `false` = Eintrag nicht gefunden, Dokument gesperrt oder Fehler (der Satz bleibt dann sichtbar).
 */
export async function retireRepairs(wrongs: readonly string[], src: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer || !wrongs.length) return false;
  const ids = new Set(wrongs.map((w) => repairId(w.trim())));
  try {
    await writer.transform(REPAIR_PATH, (cur) => {
      if (!cur || !writable(cur)) return null;
      let changed = false;
      const next = readRepairs(cur).map((e) => {
        if (!ids.has(e.id) || e.src !== src || e.done === true) return e;
        changed = true;
        return { ...e, done: true };
      });
      return changed ? opFor(cur, next) : null;
    });
    return true;
  } catch (err) {
    logError('repair:retire', err);
    return false;
  }
}

/**
 * „Kann ich nicht nachvollziehen“ (Paket FK): Der Fehlersatz wird dauerhaft aus der Wiederholung genommen. Es ist nur ein Merker (`unclear` =
 * Zeitpunkt) am Eintrag, nichts wird gelöscht, Box und Fälligkeit bleiben, und die Antwort zählt nie als falsch. Ein unerwarteter Aufbau wird
 * nie angefasst. `true` = geschrieben oder schon markiert; `false` = Eintrag nicht gefunden, Dokument gesperrt oder Fehler (der Satz bleibt dann sichtbar).
 */
export async function markUnclear(target: { store: 'repair' | 'grammar'; id: string; topic?: string; errorT?: number }): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const t = Date.now();
  try {
    if (target.store === 'grammar') {
      if (!target.topic || target.errorT === undefined) return false;
      const path = `grammar/${target.topic}`;
      let ok = false;
      await writer.transform(path, (cur) => {
        if (!cur || !validateDoc(path, cur).ok || !Array.isArray(cur.errors)) return null;
        let found = false;
        let changed = false;
        const next = (cur.errors as Array<Record<string, unknown>>).map((e) => {
          if (e.t !== target.errorT) return e;
          found = true;
          if (typeof e.unclear === 'number') return e;
          changed = true;
          return { ...e, unclear: t };
        });
        ok = found;
        return changed ? { update: { errors: next } } : null;
      });
      return ok;
    }
    let ok = false;
    await writer.transform(REPAIR_PATH, (cur) => {
      if (!cur || !writable(cur)) return null;
      let found = false;
      let changed = false;
      const next = readRepairs(cur).map((e) => {
        if (e.id !== target.id) return e;
        found = true;
        if (typeof e.unclear === 'number') return e;
        changed = true;
        return { ...e, unclear: t };
      });
      ok = found;
      return changed ? opFor(cur, next) : null;
    });
    return ok;
  } catch (err) {
    logError('repair:unclear', err, target.id);
    return false;
  }
}
