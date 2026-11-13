import { getDb, readDoc } from '../sharedUi';
import type { EvidenceCtx } from '../api';
// Zielwahl, Rückfluss und Verlauf im selben nachgeladenen Stück (`api.loadBridgeWords` / `api.reportBridgeUse` laden nur diese Datei).
export { bookBridgeUse, bridgeWordsOf } from '../data/bridge';
export { readVlogRecent } from '../data/history';

// P4 „Anwenden als Brücke“ (13.11.2026): Umgebung für `api.loadBridgeWords` und `api.reportBridgeUse`. Wie `evidenceCtx` (Schreibweg, Gerät, Bestand,
// Profil, eingefrorenes `vmod/day`), dazu ein träges Lesen einzelner Dokumente für den Verlauf (`vlog` ist nie abonniert). Nur nachgeladen.

type Doc = Record<string, unknown>;

export type BridgeCtx = EvidenceCtx & { read: (path: string) => Promise<Doc | null> };

/** `null` ohne Schreibweg. Ein fehlendes oder ungültiges Dokument liest sich als `null`. */
export async function bridgeCtx(): Promise<BridgeCtx | null> {
  // Nachgeladen wie in `api.reportEvidence`: so bleibt `evidenceCtx` EIN Stück und wird nicht zwischen zwei Stücken geteilt.
  const { evidenceCtx } = await import('./evidenceCtx');
  const ctx = await evidenceCtx();
  if (!ctx) return null;
  const read = async (path: string): Promise<Doc | null> => {
    const db = getDb();
    if (!db) return null;
    const d = await readDoc(db, path);
    return d.status === 'valid' ? d.doc : null;
  };
  return { ...ctx, read };
}
