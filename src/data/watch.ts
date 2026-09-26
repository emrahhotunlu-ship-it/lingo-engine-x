import { useEffect } from 'react';
import { create } from 'zustand';
import { getDb } from '../platform/capabilities';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import type { Unsub } from '../platform/types';
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
