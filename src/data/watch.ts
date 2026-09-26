import type { Db, DbErr, Unsub } from '../platform/types';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import { validateDoc } from './validate';

// Abos auf Abruf (Phase 5, E5-19): ein Dokument bzw. eine Sammlung, nur solange ein Bereich
// offen ist (Begleiter: `app/chat`, Preply-Bildschirm: `preply`). Genau ein `onSnapshot` je
// Abfrage, aus einem Effekt heraus – nie aus dem Render (db.d.ts). Jeder gelesene Datensatz
// wird mit zod geprüft; ungültige werden gemeldet und mit `ok: false` durchgereicht (nie
// überschrieben). Wie live.ts: `unavailable`/unbekannter Code → genau einmal neu abonnieren.
//
// Eigene Datei statt Erweiterung von live.ts, damit parallele Arbeitsstände nicht kollidieren.

type Doc = Record<string, unknown>;

const KNOWN_TERMINAL = new Set(['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error']);

export type DocWatch = { exists: boolean; data: Doc | undefined; ok: boolean; issues: string[] };
export type CollectionWatch = { docs: ReadonlyMap<string, Doc>; invalid: readonly string[] };

function resilient(key: string, open: (onError: (e: DbErr) => void) => Unsub, onFail: (code: string) => void): () => void {
  let stopped = false;
  let retried = false;
  let unsub: Unsub | null = null;
  const onError = (err: DbErr) => {
    if (stopped) return;
    const { code = 'unavailable' } = describeError(err);
    if (!retried && (code === 'unavailable' || !KNOWN_TERMINAL.has(code))) {
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
export function watchCollection(db: Db, name: string, cb: (w: CollectionWatch) => void, onFail: (code: string) => void = () => undefined): () => void {
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
