import { patchC1, type PatchResult } from '../../domain/c1/c1doc';
import { isTaskReport, reportId } from '../../domain/c1/report';
import { logWarn } from '../../platform/diagnostics';

// UX-Neuanfang D (02.11.2026): „Aufgabe melden“ in Grammatik und Anwenden. Die Kennung der Aufgabe (`gr:<Aufgabe>` bzw. `c1:<Aufgabe>`)
// kommt in die vorhandene Liste `app/c1.bad` (Ring von 300, doppelte Meldungen ändern nichts, nie gelöscht). Dort findet sie die
// Lehrkraft-Prüfung; dass die Antwort nicht zählt, regelt der Aufrufer (zentral `learnRecorder.grammar`). Kein neuer Datenbank-Pfad.
// Kapazität (data-guard 02.11.): `app/c1` darf höchstens 30 KB groß werden. Deshalb ist jede Kennung kurz (≤ 32 Zeichen: Anfang der
// Aufgabe + Prüfsumme, die die Lehrkraft-Prüfung aus der Aufgabenkennung nachrechnet) und es gibt höchstens `TASK_REPORTS_MAX`
// Aufgaben-Meldungen. Ist die Grenze erreicht, verdrängt eine neue Meldung die älteste Aufgaben-Meldung (data-guard 02.11.: nie still
// verwerfen); Klinik-/Mail-Meldungen bleiben dabei immer unberührt.

export const TASK_REPORTS_MAX = 100;
export { isTaskReport, reportId, TASK_REPORT_PREFIXES } from '../../domain/c1/report';

/** Aufgabe als gemeldet vermerken. Fehler protokolliert `patchC1` selbst. */
export function reportTask(id: string, now: number = Date.now()): Promise<PatchResult> {
  const rid = reportId(id);
  return patchC1((doc) => addTaskReport(doc, rid), now);
}

/** Rein: Meldung anhängen; ab `TASK_REPORTS_MAX` weicht die älteste Aufgaben-Meldung (Reihenfolge im Ring = Meldezeit). `null` = schon gemeldet. */
export function addTaskReport<D extends { bad: string[] }>(doc: D, rid: string): D | null {
  if (doc.bad.includes(rid)) return null;
  if (doc.bad.filter(isTaskReport).length < TASK_REPORTS_MAX) return { ...doc, bad: [...doc.bad, rid] };
  const oldest = doc.bad.find(isTaskReport);
  logWarn('c1:report', new Error(`${TASK_REPORTS_MAX} Aufgaben-Meldungen in app/c1.bad, älteste verdrängt`), oldest ?? rid);
  return { ...doc, bad: [...doc.bad.filter((x) => x !== oldest), rid] };
}
