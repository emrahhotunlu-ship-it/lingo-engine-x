import { useEffect, useState } from 'react';
import { readCollection, readDoc } from '../../data/reads';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';

// Einmal lesen, solange ein Reiter offen ist (Plan §6.1): `writing`, `talk`, `reading` für
// Weg nach C1 und Wochenbericht, `log/<tag>` × 30 erst beim Aufklappen der Messwerte. Kein Abo.

type Doc = Record<string, unknown>;
export type Once<T> = { status: 'loading' | 'ready' | 'error'; value: T };

export function useCollectionsOnce(names: readonly string[], enabled = true): Once<Record<string, Map<string, Doc>>> {
  const key = names.join('|');
  const [state, setState] = useState<Once<Record<string, Map<string, Doc>>>>({ status: 'loading', value: {} });
  useEffect(() => {
    if (!enabled) return;
    const db = getDb();
    if (!db) return;
    let alive = true;
    const list = key.split('|').filter(Boolean);
    Promise.all(list.map((n) => readCollection(db, n).then((r) => [n, r.valid] as const)))
      .then((pairs) => {
        if (alive) setState({ status: 'ready', value: Object.fromEntries(pairs) });
      })
      .catch((err: unknown) => {
        logWarn('progress:read', err, key);
        if (alive) setState({ status: 'error', value: {} });
      });
    return () => {
      alive = false;
    };
  }, [key, enabled]);
  return state;
}

export function useDocsOnce(paths: readonly string[], enabled = true): Once<Map<string, Doc>> {
  const key = paths.join('|');
  const [state, setState] = useState<Once<Map<string, Doc>>>({ status: 'loading', value: new Map() });
  useEffect(() => {
    if (!enabled) return;
    const db = getDb();
    if (!db) return;
    let alive = true;
    const list = key.split('|').filter(Boolean);
    const out = new Map<string, Doc>();
    // Höchstens 4 gleichzeitig (Plan §4.5).
    const run = async () => {
      for (let i = 0; i < list.length; i += 4) {
        const part = list.slice(i, i + 4);
        const docs = await Promise.all(part.map((p) => readDoc(db, p)));
        docs.forEach((r, k) => {
          if (r.status === 'valid') out.set(part[k] ?? '', r.doc);
        });
      }
    };
    run().then(
      () => {
        if (alive) setState({ status: 'ready', value: out });
      },
      (err: unknown) => {
        logWarn('progress:read', err, 'log');
        if (alive) setState({ status: 'error', value: out });
      },
    );
    return () => {
      alive = false;
    };
  }, [key, enabled]);
  return state;
}
