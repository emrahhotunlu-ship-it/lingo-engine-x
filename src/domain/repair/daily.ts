import { dueRepairs, readRepairs, type RepairItem } from './repair';

// Reparatur-Sätze in der täglichen Wiederholung (Lernberatung 27.09., V2): höchstens
// REPAIR_PER_DAY je Lerntag, älteste Fälligkeit zuerst; heute schon geübte zählen gegen die
// Grenze und kommen nicht noch einmal. Rein und getestet.

type Doc = Record<string, unknown>;

export const REPAIR_PER_DAY = 4;

/** Kennungen der heute schon geübten Reparatur-Sätze (Protokolleinträge `type:'repair'`). */
export function repairsDoneToday(entries: ReadonlyArray<{ type?: unknown; id?: unknown }>): Set<string> {
  const out = new Set<string>();
  for (const e of entries) if (e.type === 'repair' && typeof e.id === 'string' && e.id) out.add(e.id);
  return out;
}

/** Nur die Pflicht-Wiederholungen von heute (ohne die freiwillige Runde unter Anwenden, `ctx:'xtra'`). */
export function repairsDutyToday(entries: ReadonlyArray<{ type?: unknown; id?: unknown; ctx?: unknown }>): Set<string> {
  return repairsDoneToday(entries.filter((e) => e.ctx !== 'xtra'));
}

/**
 * Reparatur-Sätze für die heutige Runde (`limit` = höchstens so viele, z. B. offene Pflicht).
 * `doneToday` = nichts doppelt; `dutyDone` = was gegen die Tagesgrenze zählt (Standard: dasselbe).
 */
export function pickDailyRepairs(doc: Readonly<Doc> | null | undefined, nowMs: number, doneToday: ReadonlySet<string>, limit = REPAIR_PER_DAY, dutyDone: ReadonlySet<string> = doneToday): RepairItem[] {
  const room = Math.max(0, Math.min(limit, REPAIR_PER_DAY - dutyDone.size));
  if (!room) return [];
  return dueRepairs(readRepairs(doc ?? undefined), nowMs)
    .filter((e) => !doneToday.has(e.id))
    .slice(0, room);
}

/** Übersicht für „Dein Stand“: offen (noch nicht sicher) und sicher (Box 3 erreicht). */
export function repairStats(doc: Readonly<Doc> | null | undefined): { open: number; safe: number } {
  const list = readRepairs(doc ?? undefined);
  const safe = list.filter((e) => e.done === true).length;
  return { open: list.length - safe, safe };
}
