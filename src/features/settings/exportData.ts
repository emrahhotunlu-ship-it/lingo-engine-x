import { getDb } from '../../platform/capabilities';
import { saveFile, type SaveOutcome } from '../../platform/downloads';
import { logError } from '../../platform/diagnostics';
import { loadSnapshot, type DataSnapshot } from '../../data/snapshot';
import { dayKey } from '../../domain/date';

// Datenexport als JSON (Kap. 6.14): alle Dokumente unverändert, Pfad → Inhalt.

export async function exportAll(snapshot?: DataSnapshot): Promise<SaveOutcome> {
  const db = getDb();
  if (!db) return 'unavailable';
  let snap = snapshot;
  if (!snap) {
    try {
      snap = await loadSnapshot(db);
    } catch (err) {
      logError('export:read', err);
      return 'error';
    }
  }
  const schema = snap.raw.get('app/schema');
  const payload = {
    app: 'lingo-engine-x',
    exportedAt: new Date().toISOString(),
    schemaVersion: schema && typeof schema.version === 'number' ? schema.version : 0,
    documentCount: snap.raw.size,
    documents: Object.fromEntries(snap.raw),
  };
  return saveFile(`lingo-engine-x-sicherung-${dayKey(Date.now())}.json`, JSON.stringify(payload, null, 1));
}
