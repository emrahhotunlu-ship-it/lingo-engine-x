import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { getDb } from '../platform/capabilities';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import type { Db, DbErr, Unsub } from '../platform/types';
import { validateDoc } from './validate';

// Ansichtsgebundene Abos auf ganze Sammlungen (Plan §2.1): z. B. `scene` nur, solange Sprechen
// offen ist. Jede Sammlung hat höchstens EIN Abo, egal wie viele Bildschirme sie brauchen
// (Referenzzählung). Abonniert wird im useEffect mit leerer Abhängigkeitsliste, nie im Render
// (contract/db.d.ts). `unavailable` → genau einmal neu abonnieren (wie data/live.ts).

type Doc = Record<string, unknown>;

export type WatchedName = 'scene' | 'chunk';

type WatchState = {
  /** `undefined` = noch nicht geladen. */
  docs: Partial<Record<WatchedName, ReadonlyMap<string, Doc>>>;
  /** Kennungen mit ungültigem Aufbau je Sammlung (gemeldet, nicht angezeigt). */
  invalid: Partial<Record<WatchedName, ReadonlySet<string>>>;
  failed: Partial<Record<WatchedName, boolean>>;
};

export const useWatched = create<WatchState>(() => ({ docs: {}, invalid: {}, failed: {} }));

const RESUB = new Set(['unavailable']);
const TERMINAL = new Set(['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error']);

const active = new Map<WatchedName, { count: number; stop: () => void }>();

function open(name: WatchedName): () => void {
  const db = getDb();
  if (!db) return () => undefined;
  let stopped = false;
  let retried = false;
  let unsub: Unsub | null = null;
  const reported = new Set<string>();
  const start = () => {
    unsub = db.collection(name).onSnapshot(
      (qs) => {
        if (stopped) return;
        const map = new Map<string, Doc>();
        const bad = new Set<string>();
        for (const d of qs.docs) {
          const data = d.exists ? d.data() : undefined;
          if (!data) continue;
          const res = validateDoc(`${name}/${d.id}`, data);
          if (res.ok) map.set(d.id, res.value);
          else {
            bad.add(d.id);
            if (!reported.has(d.id)) {
              reported.add(d.id);
              logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, `${name}/${d.id}`);
            }
          }
        }
        retried = false;
        useWatched.setState((s) => ({ docs: { ...s.docs, [name]: map }, invalid: { ...s.invalid, [name]: bad }, failed: { ...s.failed, [name]: false } }));
      },
      (err) => {
        if (stopped) return;
        const { code = 'unavailable' } = describeError(err);
        if (!retried && (RESUB.has(code) || !TERMINAL.has(code))) {
          retried = true;
          logWarn('data:watch', err, `${name} – neu abonniert`);
          unsub?.();
          setTimeout(() => {
            if (!stopped) start();
          }, 250 + Math.random() * 500);
          return;
        }
        logError('data:watch', err, name);
        useWatched.setState((s) => ({ docs: { ...s.docs, [name]: s.docs[name] ?? new Map() }, failed: { ...s.failed, [name]: true } }));
      },
    );
  };
  start();
  return () => {
    stopped = true;
    unsub?.();
  };
}

/** Abo anmelden; die zurückgegebene Funktion meldet ab (das letzte Abmelden beendet das Abo). */
export function watchCollection(name: WatchedName): () => void {
  const cur = active.get(name);
  if (cur) cur.count++;
  else active.set(name, { count: 1, stop: open(name) });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const a = active.get(name);
    if (!a) return;
    a.count--;
    if (a.count <= 0) {
      a.stop();
      active.delete(name);
      useWatched.setState((s) => {
        const docs = { ...s.docs };
        delete docs[name];
        return { docs };
      });
    }
  };
}

/** Sammlung, solange die Komponente eingehängt ist. `undefined` = lädt noch. */
export function useCollection(name: WatchedName, enabled = true): ReadonlyMap<string, Doc> | undefined {
  useEffect(() => {
    if (!enabled) return;
    return watchCollection(name);
  }, [name, enabled]);
  return useWatched((s) => s.docs[name]);
}

/** Nur für Tests. */
export function resetWatched(): void {
  active.forEach((a) => a.stop());
  active.clear();
  useWatched.setState({ docs: {}, invalid: {}, failed: {} });
}

// ---------------------------------------------------------------- Abos auf Abruf (Phase 5, E5-19)
// Ein Dokument bzw. eine Sammlung, nur solange ein Bereich offen ist (Begleiter: `app/chat`,
// Preply-Bildschirm: `preply`). Genau ein `onSnapshot` je Abfrage, aus einem Effekt heraus – nie
// aus dem Render (db.d.ts). Jeder gelesene Datensatz wird mit zod geprüft; ungültige werden
// gemeldet und mit `ok: false` durchgereicht (nie überschrieben). Wie live.ts: `unavailable`/
// unbekannter Code → genau einmal neu abonnieren.


export type DocWatch = { exists: boolean; data: Doc | undefined; ok: boolean; issues: string[] };
export type CollectionWatch = { docs: ReadonlyMap<string, Doc>; invalid: readonly string[] };

function resilient(key: string, open: (onError: (e: DbErr) => void) => Unsub, onFail: (code: string) => void): () => void {
  let stopped = false;
  let retried = false;
  let unsub: Unsub | null = null;
  const onError = (err: DbErr) => {
    if (stopped) return;
    const { code = 'unavailable' } = describeError(err);
    if (!retried && (code === 'unavailable' || !TERMINAL.has(code))) {
      retried = true;
      logWarn('data:watch', err, `${key} – neu abonniert`);
      unsub?.();
      setTimeout(() => {
        if (!stopped) unsub = open(onError);
      }, 250 + Math.random() * 500);
      return;
    }
    logError('data:watch', err, key);
    onFail(code);
  };
  unsub = open(onError);
  return () => {
    stopped = true;
    unsub?.();
  };
}

/** Ein Dokument beobachten. Liefert die Abmelde-Funktion. */
export function watchDoc(db: Db, path: string, cb: (w: DocWatch) => void, onFail: (code: string) => void = () => undefined): () => void {
  let reported = false;
  return resilient(
    path,
    (onError) =>
      db.doc(path).onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : undefined;
        if (!data) {
          cb({ exists: false, data: undefined, ok: true, issues: [] });
          return;
        }
        const res = validateDoc(path, data);
        if (!res.ok && !reported) {
          reported = true;
          logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
        }
        cb({ exists: true, data: res.ok ? res.value : data, ok: res.ok, issues: res.ok ? [] : res.issues });
      }, onError),
    onFail,
  );
}

/** Eine Sammlung beobachten; ungültige Dokumente werden gemeldet und ausgelassen. */
export function watchCollectionDocs(db: Db, name: string, cb: (w: CollectionWatch) => void, onFail: (code: string) => void = () => undefined): () => void {
  const reported = new Set<string>();
  return resilient(
    name,
    (onError) =>
      db.collection(name).onSnapshot((qs) => {
        const docs = new Map<string, Doc>();
        const invalid: string[] = [];
        for (const d of qs.docs) {
          const data = d.exists ? d.data() : undefined;
          if (!data) continue;
          const path = `${name}/${d.id}`;
          const res = validateDoc(path, data);
          if (res.ok) docs.set(d.id, res.value);
          else {
            invalid.push(d.id);
            if (!reported.has(path)) {
              reported.add(path);
              logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
            }
          }
        }
        cb({ docs, invalid });
      }, onError),
    onFail,
  );
}

// ---------------------------------------------------------------- Beiträge des Tagesauftrags (Phase 4, F24)
// `feed` sortiert nach `d` absteigend, die neuesten 21 Dokumente – genau EIN onSnapshot, nur solange
// Entdecken offen ist. `feed/*` wird nie geschrieben (Kap. 9, Regel 4; der Writer verweigert es).

export const FEED_LIMIT = 21;
export type FeedDocs = ReadonlyArray<{ id: string; doc: Doc }>;

/** Gültige Beiträge in Abfrage-Reihenfolge; ungültige werden gemeldet und ausgelassen. */
export function watchFeed(db: Db, next: (docs: FeedDocs) => void, onFail: (code: string) => void = () => undefined): () => void {
  const reported = new Set<string>();
  return resilient(
    'feed',
    (onError) =>
      db
        .collection('feed')
        .orderBy('d', 'desc')
        .limit(FEED_LIMIT)
        .onSnapshot((qs) => {
          const out: Array<{ id: string; doc: Doc }> = [];
          for (const d of qs.docs) {
            const data = d.exists ? d.data() : undefined;
            if (!data) continue;
            const path = `feed/${d.id}`;
            const res = validateDoc(path, data);
            if (res.ok) out.push({ id: d.id, doc: res.value });
            else if (!reported.has(path)) {
              reported.add(path);
              logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
            }
          }
          next(out);
        }, onError),
    onFail,
  );
}

// ---------------------------------------------------------------- Dokument-Abo als Hook (Phase 6, Plan E19)
// `app/radar` (Reiter „Fehler") und `app/weekly` (Reiter „Verlauf"): genau EIN onSnapshot je
// Hook-Instanz, nur solange der Reiter offen ist; im Effekt mit dem Pfad als stabiler Abhängigkeit.

export type DocWatchState = { status: 'loading' | 'ready' | 'error'; data: Doc | null; ok: boolean };

export function useDocWatch(path: string, enabled = true): DocWatchState {
  const [state, setState] = useState<DocWatchState>({ status: 'loading', data: null, ok: true });
  useEffect(() => {
    if (!enabled) return;
    const db = getDb();
    if (!db) return;
    return watchDoc(
      db,
      path,
      (w) => setState({ status: 'ready', data: w.exists ? (w.data ?? null) : null, ok: w.ok }),
      () => setState((s) => ({ ...s, status: 'error' })),
    );
  }, [path, enabled]);
  return state;
}
