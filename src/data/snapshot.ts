import type { Db } from '../platform/types';
import { logError, logWarn } from '../platform/diagnostics';
import { fitTextBudget, READ_BACKUP_TEXT_BUDGET_BYTES, readBackupPlan, docBytes } from '../modules/read/registry';
import { APP_DOC_PATHS, EAGER_COLLECTION_NAMES, collectionOf } from './paths';
import { validateDoc } from './validate';

// Einmaliges Lesen der ganzen Datenbank (für Trockenlauf, Umstellung und Export).
// Laufende Ansichten abonnieren dagegen gezielt einzelne Dokumente (src/data/live.ts).

type Doc = Record<string, unknown>;

export type DataSnapshot = {
  /** Alle gelesenen Dokumente, Pfad → Inhalt (unverändert, wie gespeichert). */
  raw: ReadonlyMap<string, Doc>;
  /** Geprüfte Dokumente, Pfad → Inhalt (unbekannte Felder bleiben erhalten). */
  valid: ReadonlyMap<string, Doc>;
  invalid: ReadonlyArray<{ path: string; issues: string[] }>;
  /** Anzahl je Sammlung bzw. `app`. */
  counts: Readonly<Record<string, { total: number; valid: number }>>;
  /** Sammlungen, deren Abfrage genau 1000 Dokumente lieferte (mögliche Kappung). */
  possiblyTruncated: readonly string[];
};

export function snapshotFromRecord(all: Record<string, Doc>, possiblyTruncated: string[] = []): DataSnapshot {
  const raw = new Map<string, Doc>();
  const valid = new Map<string, Doc>();
  const invalid: Array<{ path: string; issues: string[] }> = [];
  const counts: Record<string, { total: number; valid: number }> = {};
  for (const path of Object.keys(all).sort()) {
    const data = all[path];
    if (!data) continue;
    raw.set(path, data);
    const c = collectionOf(path);
    const bucket = (counts[c] ??= { total: 0, valid: 0 });
    bucket.total++;
    const res = validateDoc(path, data);
    if (res.ok) {
      valid.set(path, res.value);
      bucket.valid++;
    } else {
      invalid.push({ path, issues: res.issues });
    }
  }
  return { raw, valid, invalid, counts, possiblyTruncated };
}

const KNOWN_TERMINAL = new Set(['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error']);

/** Lesen: bei `unavailable` oder unbekanntem Code genau einmal nach kurzer Pause wiederholen (db.d.ts). */
export async function readOnce<T>(what: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined;
    if (typeof code === 'string' && KNOWN_TERMINAL.has(code)) throw err;
    logWarn('data:read', err, `${what} – einmal wiederholt`);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    return op();
  }
}

async function inBatches<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function loadSnapshot(db: Db): Promise<DataSnapshot> {
  const all: Record<string, Doc> = {};
  const truncated: string[] = [];
  await inBatches(APP_DOC_PATHS, 4, async (path) => {
    const snap = await readOnce(path, () => db.doc(path).get());
    const data = snap.exists ? snap.data() : undefined;
    if (data) all[path] = data;
  });
  await inBatches(EAGER_COLLECTION_NAMES, 3, async (name) => {
    const q = await readOnce(name, () => db.collection(name).get());
    // Genau 1.000 Treffer sehen nach einer Kappung aus; mehr oder weniger sind vollständig.
    if (q.size === 1000) {
      truncated.push(name);
      logError('data:snapshot', { code: 'possibly_truncated', message: `${name}: ${q.size} Dokumente` }, name);
    }
    for (const d of q.docs) {
      const data = d.exists ? d.data() : undefined;
      if (data) all[`${name}/${d.id}`] = data;
    }
  });
  return snapshotFromRecord(all, truncated);
}

export type LazyBackup = {
  /** Gesicherte Dokumente der trägen Sammlung `read`: Pfad → Inhalt. */
  docs: Record<string, Doc>;
  /** Tagesdokumente (Artikeltexte), die nicht mehr ins Größenbudget passten (neueste zuerst gesichert). */
  omitted: string[];
  /** Summe der Größe der gesicherten Artikeltexte in Bytes. */
  textBytes: number;
};

/**
 * Sicherung der trägen Sammlung `read` in begrenzter Größe (Plan `lesen-plan.md` §11 Nachtrag L3): Einstellungen und Monatsindizes
 * (Titel, Lesezustand) immer, Artikeltexte neueste zuerst, solange sie ins Budget passen. Was nicht passt, steht in `omitted`
 * (der Export meldet es, es wird nie still weggelassen). Die Dokumente in der Datenbank bleiben unberührt.
 * Wirft bei Lesefehlern (nach dem einen Wiederholversuch von `readOnce`).
 */
export async function loadLazyBackup(db: Db, textBudget: number = READ_BACKUP_TEXT_BUDGET_BYTES): Promise<LazyBackup> {
  const docs: Record<string, Doc> = {};
  const p = await readOnce('read/p', () => db.doc('read/p').get());
  const pData = p.exists ? p.data() : undefined;
  if (!pData) return { docs, omitted: [], textBytes: 0 };
  const plan = readBackupPlan(pData);
  docs['read/p'] = pData;
  await inBatches(plan.index.filter((x) => x !== 'read/p'), 4, async (path) => {
    const snap = await readOnce(path, () => db.doc(path).get());
    const data = snap.exists ? snap.data() : undefined;
    if (data) docs[path] = data;
  });
  // Artikeltexte: neueste zuerst, in kleinen Gruppen; sobald das Budget erreicht ist, wird nicht weiter geladen.
  const included: Array<{ path: string; bytes: number; data: Doc }> = [];
  const missing = new Set<string>();
  let used = 0;
  let i = 0;
  for (; i < plan.texts.length; i += 4) {
    const group = plan.texts.slice(i, i + 4);
    const got = await Promise.all(
      group.map(async (path) => {
        const snap = await readOnce(path, () => db.doc(path).get());
        const data = snap.exists ? snap.data() : undefined;
        if (!data) missing.add(path);
        return data ? { path, bytes: docBytes(data), data } : null;
      }),
    );
    let stop = false;
    for (const g of got) {
      if (!g) continue;
      const fit = fitTextBudget([{ path: g.path, bytes: g.bytes }], textBudget - used);
      if (fit.included.length === 0) {
        stop = true;
        break;
      }
      used += g.bytes;
      included.push(g);
    }
    if (stop) break;
  }
  for (const g of included) docs[g.path] = g.data;
  const done = new Set(included.map((g) => g.path));
  const omitted = plan.texts.filter((path) => !done.has(path) && !missing.has(path));
  if (omitted.length > 0) logWarn('data:backup', { code: 'read_texts_omitted', message: `${omitted.length} Lesetage ohne Artikeltexte (Größenbudget)` }, 'read');
  return { docs, omitted, textBytes: used };
}

/** Alle Dokumente einer Sammlung (geprüft), Kennung → Inhalt. */
export function collectionDocs(s: DataSnapshot, name: string): Map<string, Doc> {
  const out = new Map<string, Doc>();
  const prefix = `${name}/`;
  for (const [p, d] of s.valid) if (p.startsWith(prefix)) out.set(p.slice(prefix.length), d);
  return out;
}

export function totalDocuments(s: DataSnapshot): number {
  return s.raw.size;
}
