import type { Db } from '../platform/types';
import { logError } from '../platform/diagnostics';
import { readOnce } from './snapshot';
import { validateDoc } from './validate';

// Einmaliges Lesen einer Sammlung (Phase 4, Plan §2.2/F24): genau ein `get()` je Aufruf,
// bei `unavailable` einmal wiederholt (readOnce). Jedes Dokument wird mit zod geprüft;
// ungültige werden gemeldet und nicht geliefert – nie überschrieben, nie gelöscht.

type Doc = Record<string, unknown>;

export type CollectionRead = {
  /** Geprüfte Dokumente in Abfrage-Reihenfolge, Kennung → Inhalt. */
  docs: ReadonlyMap<string, Doc>;
  /** Pfade mit ungültigem Aufbau (gemeldet, ausgelassen). */
  invalid: readonly string[];
};

export type ReadCollectionOptions = { orderBy?: string; dir?: 'asc' | 'desc'; limit?: number };

export async function readCollection(db: Db, name: string, opts: ReadCollectionOptions = {}): Promise<CollectionRead> {
  const q = await readOnce(name, () => {
    let query: ReturnType<Db['collection']> | ReturnType<ReturnType<Db['collection']>['orderBy']> = db.collection(name);
    if (opts.orderBy) query = query.orderBy(opts.orderBy, opts.dir ?? 'asc');
    if (opts.limit) query = query.limit(Math.max(1, Math.min(1000, Math.round(opts.limit))));
    return query.get();
  });
  const docs = new Map<string, Doc>();
  const invalid: string[] = [];
  for (const d of q.docs) {
    const data = d.exists ? d.data() : undefined;
    if (!data) continue;
    const path = `${name}/${d.id}`;
    const res = validateDoc(path, data);
    if (res.ok) docs.set(d.id, res.value);
    else {
      invalid.push(path);
      logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
    }
  }
  return { docs, invalid };
}

/** Ein einzelnes Dokument einmal lesen (geprüft). `null` = fehlt, `undefined` = ungültig. */
export async function readDoc(db: Db, path: string): Promise<Doc | null | undefined> {
  const snap = await readOnce(path, () => db.doc(path).get());
  const data = snap.exists ? snap.data() : undefined;
  if (!data) return null;
  const res = validateDoc(path, data);
  if (res.ok) return res.value;
  logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
  return undefined;
}
