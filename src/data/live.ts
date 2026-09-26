import { create } from 'zustand';
import type { Db, Unsub } from '../platform/types';
import { logError } from '../platform/diagnostics';
import { validateDoc } from './validate';

// Laufende Ansicht auf die Dokumente, die die Oberfläche braucht. Jede Abfrage wird genau
// einmal abonniert (startLive beim Start, stopLive beim Beenden) – nie aus dem Render
// (contract/db.d.ts, onSnapshot). Jeder gelesene Datensatz wird mit zod geprüft.

type Doc = Record<string, unknown>;

export const LIVE_DOCS = ['app/profile', 'app/course', 'app/assess', 'app/schema'] as const;
export const LIVE_COLLECTIONS = ['vocab', 'grammar'] as const;
export type LiveDocPath = (typeof LIVE_DOCS)[number];
export type LiveCollection = (typeof LIVE_COLLECTIONS)[number];

type LiveState = {
  /** `error` = ein Abonnement ist endgültig abgebrochen (db.d.ts: nur ein neues onSnapshot hilft). */
  status: 'waiting' | 'ready' | 'error';
  errorCode?: string;
  /** `undefined` = noch nicht geladen, `null` = Dokument existiert nicht. */
  docs: Partial<Record<LiveDocPath, Doc | null>>;
  collections: Partial<Record<LiveCollection, ReadonlyMap<string, Doc>>>;
  invalid: Readonly<Record<string, string[]>>;
};

export const useLive = create<LiveState>(() => ({ status: 'waiting', docs: {}, collections: {}, invalid: {} }));

function markLoaded(): void {
  const s = useLive.getState();
  if (s.status === 'error') return;
  const all = LIVE_DOCS.every((p) => s.docs[p] !== undefined) && LIVE_COLLECTIONS.every((c) => s.collections[c] !== undefined);
  if (all && s.status !== 'ready') useLive.setState({ status: 'ready' });
}

function setInvalid(path: string, issues: string[] | null): void {
  const cur = useLive.getState().invalid;
  if (!issues && !(path in cur)) return;
  const next = { ...cur };
  if (issues) next[path] = issues;
  else delete next[path];
  useLive.setState({ invalid: next });
}

function failed(err: unknown, where: string): void {
  logError('data:live', err, where);
  const code = err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : 'unavailable';
  useLive.setState({ status: 'error', errorCode: code });
}

export function startLive(db: Db): () => void {
  const unsubs: Unsub[] = [];
  for (const path of LIVE_DOCS) {
    unsubs.push(
      db.doc(path).onSnapshot(
        (snap) => {
          const data = snap.exists ? snap.data() : undefined;
          let value: Doc | null = null;
          if (data) {
            const res = validateDoc(path, data);
            if (res.ok) {
              value = res.value;
              setInvalid(path, null);
            } else {
              setInvalid(path, res.issues);
              logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
            }
          }
          useLive.setState((s) => ({ docs: { ...s.docs, [path]: value } }));
          markLoaded();
        },
        (err) => failed(err, path),
      ),
    );
  }
  for (const name of LIVE_COLLECTIONS) {
    unsubs.push(
      db.collection(name).onSnapshot(
        (qs) => {
          const map = new Map<string, Doc>();
          for (const d of qs.docs) {
            const data = d.exists ? d.data() : undefined;
            if (!data) continue;
            const path = `${name}/${d.id}`;
            const res = validateDoc(path, data);
            if (res.ok) map.set(d.id, res.value);
            else setInvalid(path, res.issues);
          }
          useLive.setState((s) => ({ collections: { ...s.collections, [name]: map } }));
          markLoaded();
        },
        (err) => failed(err, name),
      ),
    );
  }
  return () => {
    unsubs.forEach((u) => u());
    useLive.setState({ status: 'waiting', docs: {}, collections: {}, invalid: {} });
  };
}
