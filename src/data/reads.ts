import type { Db } from '../platform/types';
import { logError } from '../platform/diagnostics';
import { APP_DOC_PATHS, COLLECTION_NAMES } from './paths';
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

/** Sortierung und Menge (Phase 4: `feed` nach `d` absteigend, die neuesten 21). */
export type ReadCollectionOptions = { orderBy?: string; dir?: 'asc' | 'desc'; limit?: number };

/** Eine ganze Sammlung (bzw. die ersten `limit` nach `orderBy`) einmal lesen (kein Abo). */
export async function readCollection(db: Db, name: string, opts: ReadCollectionOptions = {}): Promise<CollectionRead> {
  const q = await readOnce(name, () => {
    const base = db.collection(name);
    const ordered = opts.orderBy ? base.orderBy(opts.orderBy, opts.dir ?? 'asc') : base;
    return opts.limit ? ordered.limit(Math.max(1, Math.min(1000, Math.round(opts.limit)))).get() : ordered.get();
  });
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

// ---------------------------------------------------------------- Diagnose: Dokumente zählen (P7-1 d)
// Statt eines Voll-Schnappschusses mit Prüfung jedes Dokuments: je Sammlung ein `get()` und nur die
// Anzahl (db.d.ts kennt keine reine Zählung). Höchstens 4 Abfragen gleichzeitig, einmal je Öffnen.

export type DocCounts = { byCollection: Record<string, number>; chat: Doc | null; preply: number; possiblyTruncated: string[] };

export async function countDocuments(db: Db): Promise<DocCounts> {
  const byCollection: Record<string, number> = { app: 0 };
  const possiblyTruncated: string[] = [];
  let chat: Doc | null = null;
  const jobs: Array<() => Promise<void>> = [
    ...APP_DOC_PATHS.map((path) => async () => {
      const snap = await readOnce(path, () => db.doc(path).get());
      if (!snap.exists) return;
      byCollection.app = (byCollection.app ?? 0) + 1;
      if (path === 'app/chat') chat = snap.data() ?? null;
    }),
    ...COLLECTION_NAMES.map((name) => async () => {
      const q = await readOnce(name, () => db.collection(name).get());
      byCollection[name] = q.size;
      if (q.size === 1000) possiblyTruncated.push(name);
    }),
  ];
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => j()));
  return { byCollection, chat, preply: byCollection.preply ?? 0, possiblyTruncated };
}
