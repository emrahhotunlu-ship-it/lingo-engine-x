import { getWriter } from '../../data';
import { addProd, type ProdInput } from '../../domain/c1/prod';
import { markBad, patchC1, type PatchResult } from '../../domain/c1/c1doc';
import { clinicOutItem, clinicProd, clinicRepairs, type ClinicRun } from '../../domain/tutor/clinic';
import { outPath, upsertOut, type OutItem } from '../../domain/nbdrill/outDoc';
import { logError } from '../../platform/diagnostics';
import { retireRepairs, saveRepairs } from '../repair/store';
import { markClinicWeek } from './clinicStore';

// Satz-Klinik speichern (Lernplattform 3.0 P46, KT T4). Drei getrennte, ergänzende Schreibvorgänge, jeder über `writer.transform`, nur bei Änderung,
// nie in ein ungültiges Dokument:
// 1. `out/<Monat>` (`k: 'clinic'`, Satz und Ergebnis, idempotent über `id`),
// 2. `app/repair` (höchstens 2 Fehlersätze, `src: 'clinic'`, fällig ab dem nächsten Lerntag),
// 3. `app/c1.prod[]` über `addProd` (K7; Einfügen und Übersetzer-Nutzung werden dort abgelehnt).
// Reihenfolge: Ergebnis zuerst; ein Absturz dazwischen verliert nur die späteren Teile, nie das Ergebnis. Jeder Teil meldet ehrlich, ob er geschrieben wurde.

export type ClinicSaveResult = {
  out: boolean;
  /** Anzahl der neu gespeicherten Fehlersätze (0, wenn keine entstanden sind). */
  repairs: number;
  /** `false`, wenn der Fehlersatz-Teil scheiterte (nicht geschrieben). */
  repairsOk: boolean;
  prod: PatchResult | 'ignored';
};

/** Eintrag in `out/<Monat>`; `true`, wenn geschrieben oder schon so vorhanden. */
export async function saveOutItem(item: OutItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(outPath(item.d), (cur) => upsertOut(cur, item));
    return true;
  } catch (err) {
    logError('tutor:out', err, item.id);
    return false;
  }
}

export async function saveClinic(run: ClinicRun): Promise<ClinicSaveResult> {
  const out = await saveOutItem(clinicOutItem(run));
  const repairs = clinicRepairs(run);
  const repairsOk = repairs.length ? await saveRepairs(repairs) : true;
  const input: ProdInput = clinicProd(run);
  const prod = await addProd(input, run.now);
  if (out) markClinicWeek(run.day);
  return { out, repairs: repairsOk ? repairs.length : 0, repairsOk, prod };
}

/** „Melden“: das Ergebnis gilt als gemeldet (`app/c1.bad`), die daraus entstandenen Fehlersätze werden erledigt (nie gelöscht). */
export async function reportClinic(run: ClinicRun, id: string): Promise<void> {
  await patchC1((doc) => markBad(doc, id), run.now);
  const wrongs = clinicRepairs(run).map((r) => r.wrong);
  if (wrongs.length) await retireRepairs(wrongs, 'clinic');
}
