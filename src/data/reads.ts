import type { Db } from '../platform/types';
import { logError } from '../platform/diagnostics';
import { readOnce } from './snapshot';
import { validateDoc } from './validate';

// Einmaliges Lesen einzelner Dokumente und Sammlungen (Phase 2 D16: `lesson/<id>`, `app/pool`,
// `app/radar` und `daily/*` werden per `get()` gelesen, ohne Live-Abo). Jedes Dokument läuft
// durch `validateDoc`; ungültige werden gemeldet und getrennt geliefert, nie still verworfen.

type Doc = Record<string, unknown>;

export type ReadDoc =
  | { status: 'missing' }
  | { status: 'valid'; doc: Doc }
  | { status: 'invalid'; doc: Doc; issues: string[] };

/** Ein Dokument frisch lesen und prüfen. Wirft bei Lesefehlern (nach einem Wiederholversuch). */
export async function readDoc(db: Db, path: string): Promise<ReadDoc> {
  const snap = await readOnce(path, () => db.doc(path).get());
  const data = snap.exists ? snap.data() : undefined;
  if (!data) return { status: 'missing' };
  const res = validateDoc(path, data);
  if (res.ok) return { status: 'valid', doc: res.value };
  logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
  return { status: 'invalid', doc: data, issues: res.issues };
}

export type CollectionRead = {
  /** Kennung → geprüfter Inhalt. */
  valid: Map<string, Doc>;
  /** Kennungen mit ungültigem Aufbau (gemeldet, nicht verarbeitet). */
  invalid: string[];
  /** Genau 1.000 Treffer: vielleicht gekappt (db.d.ts). */
  possiblyTruncated: boolean;
};

/** Eine ganze Sammlung einmal lesen (kein Abo). */
export async function readCollection(db: Db, name: string): Promise<CollectionRead> {
  const q = await readOnce(name, () => db.collection(name).get());
  const valid = new Map<string, Doc>();
  const invalid: string[] = [];
  for (const d of q.docs) {
    const data = d.exists ? d.data() : undefined;
    if (!data) continue;
    const path = `${name}/${d.id}`;
    const res = validateDoc(path, data);
    if (res.ok) valid.set(d.id, res.value);
    else {
      invalid.push(d.id);
      logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
    }
  }
  const possiblyTruncated = q.size === 1000;
  if (possiblyTruncated) logError('data:read', { code: 'possibly_truncated', message: `${name}: ${q.size} Dokumente` }, name);
  return { valid, invalid, possiblyTruncated };
}
