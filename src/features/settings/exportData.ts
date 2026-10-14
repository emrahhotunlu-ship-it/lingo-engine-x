import { getDb } from '../../platform/capabilities';
import { saveFile, type SaveOutcome } from '../../platform/downloads';
import { logError } from '../../platform/diagnostics';
import { readLegacyLocal } from '../../platform/legacyLocal';
import { loadLazyBackup, loadSnapshot, type DataSnapshot, type LazyBackup } from '../../data/snapshot';
import { dayKey } from '../../domain/date';
import { useSettings } from '../../app/settings';
import { translate } from '../../i18n';
import { useLive } from '../../data/live';
import { mergedVocab } from '../../domain/overview';
import { ankiCsv } from '../../domain/progress/ankiCsv';

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
  // Träge Sammlung „Lesen“ (Texte der Artikel) in begrenzter Größe dazu; was nicht passt, wird im Export vermerkt (nie still weggelassen).
  const documents: Record<string, Record<string, unknown>> = Object.fromEntries(snap.raw);
  // Die Sicherung hängt nicht an diesem neuen, trägen Teil: scheitert das Lesen von `read/`, wird ohne Lesen-Dokumente gesichert und das vermerkt.
  let lazy: LazyBackup = { docs: {}, omitted: [], textBytes: 0 };
  let readBackupFailed = false;
  try {
    lazy = await loadLazyBackup(db);
  } catch (err) {
    readBackupFailed = true;
    logError('export:read', err, 'read');
  }
  Object.assign(documents, lazy.docs);
  const readOmitted = lazy.omitted;
  const schema = snap.raw.get('app/schema');
  const payload = {
    app: 'lingo-engine-x',
    exportedAt: new Date().toISOString(),
    schemaVersion: schema && typeof schema.version === 'number' ? schema.version : 0,
    documentCount: Object.keys(documents).length,
    documents,
  };
  if (readOmitted.length) Object.assign(payload, { readTextsOmitted: readOmitted });
  if (readBackupFailed) Object.assign(payload, { readBackupFailed: true });
  // Noch nicht übertragene Kopien der alten App in diesem Browser gehören mit in die Sicherung.
  const browserCopies = readLegacyLocal();
  if (Object.keys(browserCopies.dirty).length) Object.assign(payload, { browserCopies });
  // Dateiname in der Oberflächensprache („sicherung" bzw. „backup").
  const word = translate(useSettings.getState().lang, 'backupFileWord');
  return saveFile(`lingo-engine-x-${word}-${dayKey(Date.now())}.json`, JSON.stringify(payload, null, 1));
}

/** CSV für Anki (N98): alle sichtbaren Karten mit Ursprungssatz; liest nur den Live-Stand. */
export async function exportAnkiCsv(): Promise<SaveOutcome | 'empty'> {
  const vocab = useLive.getState().collections.vocab ?? new Map<string, Record<string, unknown>>();
  const { text, rows } = ankiCsv(mergedVocab(vocab));
  if (!rows) return 'empty';
  return saveFile(`lingo-engine-x-anki-${dayKey(Date.now())}.csv`, text);
}
