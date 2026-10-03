import type { DbErrCode } from '../types';

// Entwicklungs-Adapter: eine Datenbank im Speicher, die den Vertrag aus
// contract/db.d.ts nachbildet (Pfadgrammatik, set/update/delete, acquire,
// onSnapshot, where/orderBy/limit, Grenzen). Nur für Dev-Server und Tests –
// nie Teil des Produktions-Builds.

type Json = Record<string, unknown>;
type DocEntry = { data: Json; frozen: DocumentSnapshot; version: number };
type Lease = { holder: string; expires: number };

export type MemoryDbOptions = {
  /** Anfangsbestand: Pfad → Dokument. */
  seed?: Record<string, Json>;
  /** Künstliche Latenz je Aufruf in ms. */
  latencyMs?: number;
  /** Jeder Schreibaufruf schlägt mit diesem Code fehl (Fehlerpfade testen). */
  failWrites?: DbErrCode;
  /** Jedes Abonnement endet sofort mit diesem Code (abgebrochene Verbindung testen). */
  failSubscriptions?: DbErrCode;
  /** Nur die ersten N Abonnements scheitern lassen (Neu-Abonnieren testen). */
  failSubscriptionsTimes?: number;
  /** Bestand bei jeder Änderung hierhin melden (z. B. sessionStorage). */
  onChange?: (all: Record<string, Json>) => void;
};

export type MemoryDbHandle = {
  db: DB;
  dump(): Record<string, Json>;
  load(all: Record<string, Json>): void;
  writes(): ReadonlyArray<{ op: 'set' | 'update' | 'delete'; path: string }>;
  setFailWrites(code: DbErrCode | undefined): void;
  /** Phase 5: Die nächsten `times` Schreibvorgänge auf `path` scheitern mit `code`. */
  failWritesTo(path: string, code: DbErrCode, times?: number): void;
  activeSubscriptions(): number;
  /** Laufende Abos je Ziel (Dokumentpfad bzw. `<Sammlung>/*`), eines je Eintrag, sortiert – für „ein Abo je Dokument“. */
  activePaths(): string[];
  /** Phase 6 (Plan §13): Höchststand gleichzeitiger Abonnements seit dem Start. */
  peakSubscriptions(): number;
};

const SEGMENT_RE = /^[A-Za-z0-9_\-.~:@+]+$/;
const MAX_DOC_BYTES = 256 * 1024;
const MAX_DEPTH = 32;
const MAX_DOCS = 5000;
const MAX_SUBSCRIPTIONS = 64;
const encoder = new TextEncoder();

class DbFailure {
  constructor(
    readonly code: DbErrCode,
    readonly message: string,
  ) {}
}

function splitPath(path: string, kind: 'document' | 'collection'): string[] {
  if (typeof path !== 'string' || path.length === 0) throw new TypeError(`${kind} path must be a non-empty string`);
  if (encoder.encode(path).length > 1000) throw new TypeError('path longer than 1000 bytes');
  const segs = path.split('/');
  if (segs.length > 16) throw new TypeError('path has more than 16 segments');
  for (const s of segs) {
    if (s === '' || s === '.' || s === '..' || !SEGMENT_RE.test(s)) throw new TypeError(`invalid path segment "${s}"`);
    if (encoder.encode(s).length > 200) throw new TypeError('path segment longer than 200 bytes');
  }
  const even = segs.length % 2 === 0;
  if (kind === 'document' && !even) throw new TypeError(`document path needs an even number of segments, got ${segs.length}`);
  if (kind === 'collection' && even) throw new TypeError(`collection path needs an odd number of segments, got ${segs.length}`);
  return segs;
}

function isPlainObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function depthOf(v: unknown, d = 0): number {
  if (Array.isArray(v)) return v.reduce<number>((m, x) => Math.max(m, depthOf(x, d + 1)), d + 1);
  if (isPlainObject(v)) return Object.values(v).reduce<number>((m, x) => Math.max(m, depthOf(x, d + 1)), d + 1);
  return d;
}

function checkBody(data: unknown): Json {
  if (!isPlainObject(data)) throw new DbFailure('invalid_argument', 'document body must be a plain object');
  const json = JSON.stringify(data);
  if (encoder.encode(json).length > MAX_DOC_BYTES) throw new DbFailure('invalid_argument', 'document exceeds 256 KiB');
  if (depthOf(data) > MAX_DEPTH) throw new DbFailure('invalid_argument', 'document deeper than 32 levels');
  return JSON.parse(json) as Json;
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.freeze(v);
    for (const x of Object.values(v as object)) deepFreeze(x);
  }
  return v;
}

function mergeDeep(target: Json, patch: Json): Json {
  const out: Json = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] = isPlainObject(v) && isPlainObject(cur) ? mergeDeep(cur, v) : v;
  }
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
}

function matches(value: unknown, op: string, arg: unknown): boolean {
  switch (op) {
    case '==':
      return JSON.stringify(value) === JSON.stringify(arg);
    case '!=':
      return value !== undefined && JSON.stringify(value) !== JSON.stringify(arg);
    case '<':
      return value !== undefined && compare(value, arg) < 0;
    case '<=':
      return value !== undefined && compare(value, arg) <= 0;
    case '>':
      return value !== undefined && compare(value, arg) > 0;
    case '>=':
      return value !== undefined && compare(value, arg) >= 0;
    case 'in':
      return Array.isArray(arg) && arg.some((x) => JSON.stringify(x) === JSON.stringify(value));
    case 'not-in':
      return Array.isArray(arg) && value !== undefined && !arg.some((x) => JSON.stringify(x) === JSON.stringify(value));
    case 'array-contains':
      return Array.isArray(value) && value.some((x) => JSON.stringify(x) === JSON.stringify(arg));
    default:
      throw new DbFailure('invalid_argument', `unknown operator ${op}`);
  }
}

type QuerySpec = {
  path: string;
  filters: Array<{ field: string; op: string; value: unknown }>;
  order?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
};

export function createMemoryDb(opts: MemoryDbOptions = {}): MemoryDbHandle {
  const docs = new Map<string, DocEntry>();
  const leases = new Map<string, Lease>();
  const writeLog: Array<{ op: 'set' | 'update' | 'delete'; path: string }> = [];
  const docListeners = new Map<string, Set<(s: DocumentSnapshot) => void>>();
  const queryListeners = new Set<{ spec: QuerySpec; fire: () => void }>();
  let failWrites = opts.failWrites;
  let subscriptionCount = 0;
  let peakSubscriptions = 0;
  let failedSubscriptions = 0;
  let version = 0;
  const meta: SnapshotMetadata = Object.freeze({ fromCache: false, hasPendingWrites: false });

  const delay = <T>(fn: () => T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(fn());
        } catch (err) {
          reject(err instanceof DbFailure ? { code: err.code, message: err.message } : err);
        }
      }, opts.latencyMs ?? 0);
    });

  const missing = (id: string): DocumentSnapshot =>
    Object.freeze({ id, exists: false, data: () => undefined, metadata: meta });

  function snapshotOf(path: string): DocumentSnapshot {
    const id = path.slice(path.lastIndexOf('/') + 1);
    return docs.get(path)?.frozen ?? missing(id);
  }

  function store(path: string, data: Json): void {
    const id = path.slice(path.lastIndexOf('/') + 1);
    const body = deepFreeze(data);
    const frozen: DocumentSnapshot = Object.freeze({ id, exists: true, data: () => body, metadata: meta });
    docs.set(path, { data: body, frozen, version: ++version });
  }

  function notify(path: string): void {
    const snap = snapshotOf(path);
    docListeners.get(path)?.forEach((fn) => fn(snap));
    const coll = path.slice(0, path.lastIndexOf('/'));
    queryListeners.forEach((l) => {
      if (l.spec.path === coll) l.fire();
    });
    if (opts.onChange) opts.onChange(dump());
  }

  const failPaths = new Map<string, { code: DbErrCode; times: number }>();
  function guardWrite(path?: string): void {
    if (failWrites) throw new DbFailure(failWrites, `simulated ${failWrites}`);
    const f = path ? failPaths.get(path) : undefined;
    if (f && path) {
      if (f.times <= 1) failPaths.delete(path);
      else failPaths.set(path, { code: f.code, times: f.times - 1 });
      throw new DbFailure(f.code, `simulated ${f.code} for ${path}`);
    }
  }

  function dump(): Record<string, Json> {
    const out: Record<string, Json> = {};
    for (const [p, e] of docs) out[p] = JSON.parse(JSON.stringify(e.data)) as Json;
    return out;
  }

  function runQuery(spec: QuerySpec): DocumentSnapshot[] {
    const prefix = spec.path + '/';
    let rows = [...docs.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map(([p, e]) => ({ id: p.slice(prefix.length), e }));
    for (const f of spec.filters) rows = rows.filter((r) => matches(r.e.data[f.field], f.op, f.value));
    if (spec.order) {
      const { field, dir } = spec.order;
      rows.sort((a, b) => {
        const va = a.e.data[field];
        const vb = b.e.data[field];
        if (va === undefined && vb !== undefined) return 1;
        if (vb === undefined && va !== undefined) return -1;
        const c = compare(va, vb);
        return dir === 'desc' ? -c : c;
      });
    } else {
      rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    if (spec.limit !== undefined) rows = rows.slice(0, spec.limit);
    return rows.map((r) => r.e.frozen);
  }

  function querySnapshot(list: DocumentSnapshot[], prev: DocumentSnapshot[] | null): QuerySnapshot {
    const changes: DocumentChange[] = [];
    if (!prev) {
      list.forEach((doc, i) => changes.push({ type: 'added', doc, oldIndex: -1, newIndex: i }));
    } else {
      const prevIdx = new Map(prev.map((d, i) => [d.id, i]));
      const nextIdx = new Map(list.map((d, i) => [d.id, i]));
      prev.forEach((d, i) => {
        if (!nextIdx.has(d.id)) changes.push({ type: 'removed', doc: d, oldIndex: i, newIndex: -1 });
      });
      list.forEach((d, i) => {
        const oi = prevIdx.get(d.id);
        if (oi === undefined) changes.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i });
        else if (prev[oi] !== d) changes.push({ type: 'modified', doc: d, oldIndex: oi, newIndex: i });
      });
    }
    return Object.freeze({
      docs: list,
      size: list.length,
      empty: list.length === 0,
      docChanges: () => changes,
      metadata: meta,
    });
  }

  function subscribeGuard(error?: (e: DbError) => void): boolean {
    const failCode = opts.failSubscriptions;
    if (failCode && (opts.failSubscriptionsTimes === undefined || failedSubscriptions++ < opts.failSubscriptionsTimes)) {
      setTimeout(() => error?.({ code: failCode, message: `simulated ${failCode}` }), 0);
      return false;
    }
    if (subscriptionCount >= MAX_SUBSCRIPTIONS) {
      setTimeout(() => error?.({ code: 'resource_exhausted', message: 'more than 64 subscriptions' }), 0);
      return false;
    }
    subscriptionCount++;
    peakSubscriptions = Math.max(peakSubscriptions, subscriptionCount);
    return true;
  }

  function makeQuery(spec: QuerySpec): Query {
    return {
      where(field, op, value) {
        if (spec.filters.length >= 10) throw new TypeError('at most 10 filters');
        return makeQuery({ ...spec, filters: [...spec.filters, { field, op, value }] });
      },
      orderBy(field, dir = 'asc') {
        return makeQuery({ ...spec, order: { field, dir } });
      },
      limit(n) {
        if (!Number.isInteger(n) || n < 1 || n > 1000) throw new TypeError('limit must be 1-1000');
        return makeQuery({ ...spec, limit: n });
      },
      get: () => delay(() => querySnapshot(runQuery(spec), null)),
      onSnapshot(next, error) {
        if (!subscribeGuard(error)) return () => undefined;
        let prev: DocumentSnapshot[] | null = null;
        let active = true;
        const fire = () => {
          if (!active) return;
          const list = runQuery(spec);
          if (prev && prev.length === list.length && prev.every((d, i) => d === list[i])) return;
          const snap = querySnapshot(list, prev);
          prev = list;
          next(snap);
        };
        const entry = { spec, fire };
        queryListeners.add(entry);
        setTimeout(fire, opts.latencyMs ?? 0);
        return () => {
          if (!active) return;
          active = false;
          subscriptionCount--;
          queryListeners.delete(entry);
        };
      },
    };
  }

  function makeCollection(path: string): CollectionReference {
    splitPath(path, 'collection');
    const q = makeQuery({ path, filters: [] });
    return {
      ...q,
      path,
      doc(id?: string) {
        const docId = id ?? `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        return makeDoc(`${path}/${docId}`);
      },
      async add(data) {
        const ref = makeDoc(`${path}/m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
        await ref.set(data);
        return ref;
      },
    };
  }

  function makeDoc(path: string): DocumentReference {
    const segs = splitPath(path, 'document');
    const id = segs[segs.length - 1] ?? '';
    return {
      id,
      path,
      get: () => delay(() => snapshotOf(path)),
      set: (data) =>
        delay(() => {
          guardWrite(path);
          const body = checkBody(data);
          if (!docs.has(path) && docs.size >= MAX_DOCS) throw new DbFailure('quota_exceeded', 'artifact database holds 5,000 documents');
          store(path, body);
          writeLog.push({ op: 'set', path });
          notify(path);
        }),
      update: (data) =>
        delay(() => {
          guardWrite(path);
          const patch = checkBody(data);
          const cur = docs.get(path);
          if (!cur) throw new DbFailure('invalid_argument', 'update requires an existing document');
          store(path, checkBody(mergeDeep(cur.data, patch)));
          writeLog.push({ op: 'update', path });
          notify(path);
        }),
      delete: () =>
        delay(() => {
          guardWrite();
          if (docs.delete(path)) {
            writeLog.push({ op: 'delete', path });
            notify(path);
          }
        }),
      acquire: (o) =>
        delay(() => {
          const now = Date.now();
          const ttl = Math.min(600000, Math.max(1000, o.ttlMs || 30000));
          const cur = leases.get(path);
          if (cur && cur.expires > now && cur.holder !== o.holder) {
            return { acquired: false, expiresAt: new Date(cur.expires).toISOString() };
          }
          leases.set(path, { holder: o.holder, expires: now + ttl });
          if (o.data) {
            const base = docs.get(path)?.data ?? {};
            store(path, checkBody(mergeDeep(base, o.data)));
            notify(path);
          }
          return {
            acquired: true,
            version: docs.get(path)?.version ?? 0,
            expiresAt: new Date(now + ttl).toISOString(),
            holder: o.holder,
          };
        }),
      onSnapshot(next, error) {
        if (!subscribeGuard(error)) return () => undefined;
        let active = true;
        let last: DocumentSnapshot | null = null;
        const fn = (s: DocumentSnapshot) => {
          if (!active || s === last) return;
          last = s;
          next(s);
        };
        let set = docListeners.get(path);
        if (!set) {
          set = new Set();
          docListeners.set(path, set);
        }
        set.add(fn);
        setTimeout(() => fn(snapshotOf(path)), opts.latencyMs ?? 0);
        return () => {
          if (!active) return;
          active = false;
          subscriptionCount--;
          docListeners.get(path)?.delete(fn);
        };
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }

  const db: DB = Object.freeze({
    doc: (path: string) => makeDoc(path),
    collection: (path: string) => makeCollection(path),
  });

  function load(all: Record<string, Json>): void {
    docs.clear();
    for (const [p, d] of Object.entries(all)) {
      splitPath(p, 'document');
      store(p, checkBody(d));
    }
  }

  if (opts.seed) load(opts.seed);

  return {
    db,
    dump,
    load,
    writes: () => writeLog,
    setFailWrites: (code) => {
      failWrites = code;
    },
    failWritesTo: (path, code, times = 1) => {
      failPaths.set(path, { code, times });
    },
    activeSubscriptions: () => subscriptionCount,
    activePaths: () =>
      [...[...docListeners.entries()].flatMap(([p, set]) => Array.from({ length: set.size }, () => p)), ...[...queryListeners].map((q) => `${q.spec.path}/*`)].sort(),
    peakSubscriptions: () => peakSubscriptions,
  };
}
