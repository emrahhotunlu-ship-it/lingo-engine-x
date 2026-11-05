import { getDb, getWriter, readDoc, useLive } from '../sharedUi';
import type { EvidenceCtx } from '../api';
import { VMOD_DAY_PATH } from '../registry';
import { deviceId } from './device';

// M0 (docs/umbau/module/plan.md, Nachtrag architect Nr. 3): Umgebung eines Belegs für `api.reportEvidence`, damit andere Bereiche nur den Beleg
// melden. Liegt bei der Oberfläche, weil sie Live-Daten und Schreibweg über sharedUi braucht; `api.ts` lädt sie nur nach (Isolationstest).

type Doc = Record<string, unknown>;

/** Schreibweg, Gerät, Bestand (Wörter und Wendungen), Profil und das eingefrorene `vmod/day`. `null` ohne Schreibweg. */
export async function evidenceCtx(): Promise<EvidenceCtx | null> {
  const writer = getWriter();
  if (!writer) return null;
  const s = useLive.getState();
  const docs: [string, Doc][] = [];
  for (const [id, doc] of s.collections.vocab ?? []) docs.push([`vocab/${id}`, doc]);
  for (const [id, doc] of s.collections.chunk ?? []) docs.push([`chunk/${id}`, doc]);
  const db = getDb();
  const day = db ? await readDoc(db, VMOD_DAY_PATH) : null;
  return { writer, device: deviceId(), docs, profile: s.docs['app/profile'] ?? null, dayDoc: day?.status === 'valid' ? day.doc : null };
}
