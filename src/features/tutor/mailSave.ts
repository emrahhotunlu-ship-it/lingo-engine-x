import { markBad, patchC1, type C1Doc, type PatchResult } from '../../domain/c1/c1doc';
import { addProd, markProdUnsure } from '../../domain/c1/prod';
import { normWs, type Edit } from '../../domain/tutor/edits';
import { mailOutItem, mailProd, mailRepairs, type MailRun } from '../../domain/tutor/mail';
import { retireRepairs, saveRepairs } from '../repair/store';
import { saveOutItem } from './clinicSave';
import { markMailWeek } from './clinicStore';

// Wochen-Mail speichern (Lernplattform 3.0 P47, KT T6). Wie bei der Satz-Klinik drei getrennte, ergänzende Schreibvorgänge (`writer.transform`, nur bei
// Änderung, nie in ein ungültiges Dokument): `out/<Monat>` (`k: 'c1mail'`, der Text und das Ergebnis; eine Überarbeitung ersetzt denselben Eintrag),
// `app/repair` (höchstens 5 Fehlersätze, `src: 'write'`) und `app/c1.prod[]` (K7). Fehlersätze und K7-Eintrag gibt es nur bei der ERSTEN Prüfung eines Textes:
// Überarbeiten soll helfen, aber nicht die Genauigkeitszahl schönen.

/** Mehrere Kennungen in `bad` eintragen (Ring); `null`, wenn nichts neu ist. */
const addBad = (doc: C1Doc, ids: readonly string[]): C1Doc | null => {
  let cur = doc;
  for (const id of ids) cur = markBad(cur, id) ?? cur;
  return cur === doc ? null : cur;
};

export type MailSaveResult = {
  out: boolean;
  /** Anzahl der angelegten Fehlersätze (0, wenn keine entstanden sind). */
  repairs: number;
  repairsOk: boolean;
  prod: PatchResult | 'ignored' | 'skipped' | 'weekDone';
};

export async function saveMail(run: MailRun): Promise<MailSaveResult> {
  const out = await saveOutItem(mailOutItem(run));
  const repairs = mailRepairs(run);
  const repairsOk = repairs.length ? await saveRepairs(repairs) : true;
  const input = mailProd(run);
  const prod = input ? await addProd(input, run.now) : 'skipped';
  if (out) markMailWeek(run.day);
  return { out, repairs: repairsOk ? repairs.length : 0, repairsOk, prod };
}

/** „Melden“ des ganzen Ergebnisses: gemeldet (`app/c1.bad`), die Fehlersätze daraus werden erledigt (nie gelöscht). */
export async function reportMail(run: MailRun, id: string): Promise<void> {
  // Die Kennung des Textes in `bad` nimmt den K7-Eintrag aus der Zählung (`prodRate`); `id` (je Prüfung) bleibt als Meldung stehen.
  await patchC1((doc) => addBad(doc, [run.id, id]), run.now);
  const wrongs = mailRepairs(run).map((r) => r.wrong);
  if (wrongs.length) await retireRepairs(wrongs, 'write');
}

/** „Stelle melden“: nur diese Stelle; der Fehlersatz, in dem sie steht, wird erledigt. */
export async function reportMailEdit(run: MailRun, edit: Edit, id: string): Promise<void> {
  // Eine gemeldete Stelle macht die Fehlerzahl dieses Textes unsicher: der K7-Eintrag trägt `u: true` (nur additiv) und zählt nie für „erfüllt“.
  await patchC1((doc) => {
    const withBad = addBad(doc, [id]) ?? doc;
    const next = markProdUnsure(withBad, run.id) ?? withBad;
    return next === doc ? null : next;
  }, run.now);
  const from = normWs(edit.from);
  const wrongs = mailRepairs(run)
    .filter((r) => normWs(r.wrong).includes(from))
    .map((r) => r.wrong);
  if (wrongs.length) await retireRepairs(wrongs, 'write');
}
