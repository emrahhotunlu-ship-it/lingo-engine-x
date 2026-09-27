import { getWriter } from '../../data';
import { fluencyPath, upsertFluencyItem, type FluencyItem } from '../../domain/fluency/fluencyDoc';
import { logError } from '../../platform/diagnostics';
import { nextT, recordActivity } from '../progress/persist';

// Schreibwege von Flüssigkeit 90 – 60 – 45 (Lernberatung 27.09., V6):
// - `fluency/<Monat>`: der Eintrag (idempotent über `id`) – nach den drei Runden und nach der Rückmeldung;
// - Abschluss nach der dritten Runde: ein Log-Eintrag `type:'fluency'` und das Rundenende
//   `act:'fluency'` über den GEMEINSAMEN Puffer. Freiwillig: `fluency` ist nie ein Pflichtkanal.
// Reparatur-Sätze schreibt `features/repair/store.ts` (`saveRepairs`, Quelle `fluency`).

export async function saveFluencyItem(item: FluencyItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(fluencyPath(item.day), (cur) => upsertFluencyItem(cur, item));
    return true;
  } catch (err) {
    logError('fluency:save', err, item.id);
    return false;
  }
}

/** Abschluss eintragen (Log, Zähler, `act.fluency`). `title` = Frage auf Englisch. */
export function recordFluencyDone(item: FluencyItem, title: string): Promise<boolean> {
  const n = item.rounds.length;
  return recordActivity(
    { t: nextT(), ok: true, lang: item.lang, type: 'fluency', id: item.q, m: 'fluency', q: title, n, ms: item.ms, ctx: 'fluency' },
    { day: item.day, act: 'fluency', partial: n < 3, n, right: n, activeMs: item.ms, countAs: 1 },
  );
}
