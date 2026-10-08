import { daysBetween } from '../../date';
import { CHECK_GAP_DAYS, inCheckWindow } from '../checkSchedule';
import type { C1Check } from '../c1doc';

// C1-Check im Tagesablauf (Lernplattform 3.0 §2.4, P40). Rein. Keine eigene Planlogik: Ob heute Check-Tag ist, steht eingefroren im Plan (`u.c1`, P23).
// Hier wird nur gelesen, welche Pflichtpunkte der Check ersetzt (Schritt 2 und 3, solange offen) und ob die Karte auf Heute erscheint.

type Row = { id: string; block: number; state: string };

/** Schritte, die der Check am Check-Tag ersetzt. */
export const CHECK_REPLACES: readonly number[] = [2, 3];

/**
 * Pflichtpunkte, die der Check heute ersetzt: die offenen Zeilen von Schritt 2 und 3, wenn der Plan den Check-Tag trägt und „Heute nicht“ nicht
 * gewählt ist. `null` = heute kein Check-Tag (oder nichts mehr offen).
 */
export function checkDayDuties(o: { c1: unknown; rows: readonly Row[]; skipped: boolean; on: boolean }): string[] | null {
  if (!o.on || o.c1 !== 'check' || o.skipped) return null;
  const open = o.rows.filter((r) => CHECK_REPLACES.includes(r.block) && r.state !== 'done').map((r) => r.id);
  return open.length ? open : null;
}

/** Darf heute ein Check angeboten werden? Im Check-Fenster (letzte 7 Tage des Monats), mit Programm, Abstand ≥ 21 Tage zum letzten Check und freier Form. */
export function checkOffered(o: { day: string; programStarted: boolean; checks: readonly Pick<C1Check, 'd'>[]; formAvailable: boolean }): boolean {
  if (!o.programStarted || !o.formAvailable || !inCheckWindow(o.day)) return false;
  const last = o.checks.reduce<string | null>((a, c) => (a === null || c.d > a ? c.d : a), null);
  return last === null || daysBetween(last, o.day) >= CHECK_GAP_DAYS;
}
