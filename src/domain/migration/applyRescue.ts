import type { Writer } from '../../data/writer';
import { mergeLegacyLocal, type RescueDecision, type RescueItem } from './rescue';

// Ergänzt eine vorgemerkte Kopie der alten App – frisch gegen die Datenbank abgeglichen, in
// einem Schritt der Schreib-Warteschlange (writer.transform). Genutzt von der Umstellung und
// vom späteren Nachtragen in weiteren Browsern.
//
// Ob die Kopie danach als erledigt gilt, entscheidet NUR dieser frische Abgleich – nie der
// ältere Stand aus Trockenlauf oder Prüfung. Das Dokument kann sich seitdem geändert haben
// (anderes Gerät, anderer Tab); dann wird gemeldet statt still abgehakt (Kap. 9, Regel 6).

export type RescueOutcome =
  | { handled: true; result: 'created' | 'updated' | 'unchanged' }
  | { handled: false; reason: 'partial' | 'not_merged' | 'db_invalid' };

export async function applyRescueItem(item: RescueItem, writer: Writer, nowMs: number): Promise<RescueOutcome> {
  const seen: { decision?: RescueDecision } = {};
  const result = await writer.transform(item.path, (current) => {
    const d = mergeLegacyLocal(item.path, current, item.local, nowMs);
    seen.decision = d;
    if (d.kind === 'create') return { set: d.data };
    if (d.kind === 'merge') return { update: d.patch };
    return null;
  });
  const d = seen.decision;
  if (!d) return { handled: false, reason: 'not_merged' };
  if (d.kind === 'create') return { handled: true, result };
  if (d.kind === 'merge') return d.rest ? { handled: false, reason: 'partial' } : { handled: true, result };
  if (d.reason === 'unchanged') return { handled: true, result: 'unchanged' };
  return { handled: false, reason: d.reason };
}
