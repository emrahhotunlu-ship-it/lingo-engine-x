import type { Writer } from '../../data/writer';
import { mergeLegacyLocal, type RescueItem } from './rescue';

// Ergänzt eine vorgemerkte Kopie der alten App – frisch gegen die Datenbank abgeglichen, in
// einem Schritt der Schreib-Warteschlange (writer.transform). Genutzt von der Umstellung und
// vom späteren Nachtragen in weiteren Browsern.

export function applyRescueItem(item: RescueItem, writer: Writer): Promise<'created' | 'updated' | 'unchanged'> {
  return writer.transform(item.path, (current) => {
    const d = mergeLegacyLocal(item.path, current, item.local);
    if (d.kind === 'create') return { set: d.data };
    if (d.kind === 'merge') return { update: d.patch };
    return null;
  });
}
