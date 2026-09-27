import { getWriter } from '../../data';
import { sayPath, upsertSayItem, type SayItem } from '../../domain/say/sayDoc';
import { logError } from '../../platform/diagnostics';
import { nextT, recordActivity } from '../progress/persist';

// Schreibwege von „Sag es“ (Lernberatung 27.09., V1/V2):
// - `say/<Monat>`: der Eintrag (idempotent über `id`) – nach der ersten Prüfung und am Ende;
// - Abschluss: ein Log-Eintrag `type:'say'` und das Rundenende `act:'say'` über den GEMEINSAMEN
//   Puffer (phase2-plan D5) – `act[tag].say ≥ 1` erfüllt den Pflichtkanal `ch:say`.
// Reparatur-Sätze schreibt `features/repair/store.ts` (`saveRepairs`).

export async function saveSayItem(item: SayItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(sayPath(item.day), (cur) => upsertSayItem(cur, item));
    return true;
  } catch (err) {
    logError('say:save', err, item.id);
    return false;
  }
}

/** Abschluss eintragen (Log, Zähler, `act.say`). `title` = Situation in der Oberflächensprache. */
export function recordSayDone(item: SayItem, title: string): Promise<boolean> {
  const passes = item.a2 ? 2 : 1;
  return recordActivity(
    { t: nextT(), ok: true, lang: item.lang, type: 'say', id: item.sit, m: 'say', q: title, n: passes, ms: item.ms, ctx: 'say' },
    { day: item.day, act: 'say', partial: false, n: 1, right: 1, activeMs: item.ms, countAs: 1 },
  );
}
