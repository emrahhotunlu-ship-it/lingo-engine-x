import { repairLogEntry } from '../../domain/progress/logPatch';
import type { RepairItem } from '../../domain/repair/repair';
import { nextT, recordRepairAnswer } from '../progress/persist';
import { recordRepair } from './store';

// Antwort auf einen Reparatur-Satz in der täglichen Wiederholung (Lernberatung 27.09., V2):
// Tagesprotokoll über die EINE Sammel-Warteschlange (zählt mit `ctx:'rev'` zu „Wiederholen“)
// und die Wiederholung in `app/repair` (Boxen 1/3/9). Karten und FSRS bleiben unberührt.

export type RepairAnswer = {
  item: Pick<RepairItem, 'id' | 'wrong' | 'right'>;
  ok: boolean;
  given: string;
  ms: number;
  day: string;
  lang: 'de' | 'en';
  ctx: 'rev' | 'xtra';
  /** Erste Antwort der Runde: sofort speichern. */
  first: boolean;
};

export function commitRepairAnswer(a: RepairAnswer): void {
  const entry = repairLogEntry({ t: nextT(), ok: a.ok, lang: a.lang, id: a.item.id, q: a.item.wrong, given: a.given, ans: a.item.right, g: a.ok ? 3 : 1, ms: Math.max(0, Math.round(a.ms)), ctx: a.ctx });
  recordRepairAnswer(entry, a.day, a.first);
  void recordRepair(a.item.id, a.ok);
}
