import type { DutyId } from './types';

// Pflichtpunkte, die es nach dem Umbau „Fokus Wörter und Grammatik“ nicht mehr gibt (Gesamtkonzept
// Kap. 6, „Pflicht/Serie am Umstellungstag“): ein am Umstellungstag schon eingefrorener Tagesplan kann
// sie noch tragen (Kurs-Lektion, Input-Block, „Sag es“, Diktat, Sprint). Sie werden als „entfällt“
// gezählt, nicht als offen – sonst bliebe die Pflicht dieses einen Tages unerfüllbar und die Serie risse.
// Rein; wird erst in W2 in `pflicht.ts` eingehängt.

const RETIRED = new Set<string>(['lesson', 'ch:u-in', 'ch:say', 'ch:dictate', 'ch:sprint']);

/** Gibt es diesen Pflichtpunkt nach dem Umbau nicht mehr? */
export const isRetiredDuty = (id: DutyId): boolean => RETIRED.has(id);

/** Teilt die Pflichtliste eines gespeicherten Plans in weiter geltende und entfallene Punkte. */
export function retireDuties(duty: readonly DutyId[]): { kept: DutyId[]; retired: DutyId[] } {
  const kept: DutyId[] = [];
  const retired: DutyId[] = [];
  for (const d of duty) (isRetiredDuty(d) ? retired : kept).push(d);
  return { kept, retired };
}
