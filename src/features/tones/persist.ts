import { getWriter } from '../../data';
import { tonesPath, upsertToneItem, type ToneItem } from '../../domain/tones/tones';
import { logError } from '../../platform/diagnostics';
import { nextT, recordActivity } from '../progress/persist';

// Schreibwege von „Eine Botschaft, drei Tonlagen“ (Lernberatung 27.09., Vorschlag 8):
// - `tones/<Monat>`: der Eintrag (idempotent über `id`);
// - Abschluss: ein Log-Eintrag `type:'tones'` und das Rundenende `act:'tones'` über den
//   GEMEINSAMEN Puffer (phase2-plan D5). Freiwillig: zählt als Extra, nie zu einem Pflichtkanal.
// Reparatur-Sätze schreibt `features/repair/store.ts` (`saveRepairs`, Quelle `tone`).

export async function saveToneItem(item: ToneItem): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(tonesPath(item.day), (cur) => upsertToneItem(cur, item));
    return true;
  } catch (err) {
    logError('tones:save', err, item.id);
    return false;
  }
}

/** Abschluss eintragen (Log, Zähler, `act.tones`). `title` = Sachverhalt in der Oberflächensprache. */
export function recordTonesDone(item: ToneItem, title: string): Promise<boolean> {
  return recordActivity(
    { t: nextT(), ok: true, lang: item.lang, type: 'tones', id: item.msg, m: 'tones', q: title, n: 3, ms: item.ms, ctx: 'tones' },
    { day: item.day, act: 'tones', partial: false, n: 1, right: 1, activeMs: item.ms, countAs: 1 },
  );
}
