import { markBad, patchC1, type PatchResult } from '../../domain/c1/c1doc';
import { hash32 } from '../../domain/random';
import { logWarn } from '../../platform/diagnostics';

// UX-Neuanfang D (02.11.2026): „Aufgabe melden“ in Grammatik und Anwenden. Die Kennung der Aufgabe (`gr:<Aufgabe>` bzw. `c1:<Aufgabe>`)
// kommt in die vorhandene Liste `app/c1.bad` (Ring von 300, doppelte Meldungen ändern nichts, nie gelöscht). Dort findet sie die
// Lehrkraft-Prüfung; dass die Antwort nicht zählt, regelt der Aufrufer (zentral `learnRecorder.grammar`). Kein neuer Datenbank-Pfad.
// Kapazität (data-guard 02.11.): `app/c1` darf höchstens 30 KB groß werden. Deshalb ist jede Kennung kurz (≤ 32 Zeichen: Anfang der
// Aufgabe + Prüfsumme, die die Lehrkraft-Prüfung aus der Aufgabenkennung nachrechnet) und es gibt höchstens `TASK_REPORTS_MAX`
// Aufgaben-Meldungen; danach wird nur noch protokolliert, damit Klinik-/Mail-Meldungen nie aus dem Ring gedrängt werden.

export const TASK_REPORTS_MAX = 100;
export const TASK_REPORT_PREFIXES = ['gr:', 'c1:'] as const;
const MAX_LEN = 32;

export const isTaskReport = (id: string): boolean => TASK_REPORT_PREFIXES.some((p) => id.startsWith(p));

/** Kurze, stabile Kennung: unverändert bis 32 Zeichen, sonst Anfang + `#` + Prüfsumme (Basis 36) der vollen Kennung. */
export function reportId(id: string): string {
  if (id.length <= MAX_LEN) return id;
  const h = hash32(id).toString(36);
  return `${id.slice(0, MAX_LEN - 1 - h.length)}#${h}`;
}

/** Aufgabe als gemeldet vermerken. Fehler protokolliert `patchC1` selbst. */
export function reportTask(id: string, now: number = Date.now()): Promise<PatchResult> {
  const rid = reportId(id);
  return patchC1((doc) => {
    if (doc.bad.filter(isTaskReport).length < TASK_REPORTS_MAX) return markBad(doc, rid);
    logWarn('c1:report', new Error(`schon ${TASK_REPORTS_MAX} Aufgaben-Meldungen in app/c1.bad, nur protokolliert`), rid);
    return null;
  }, now);
}
