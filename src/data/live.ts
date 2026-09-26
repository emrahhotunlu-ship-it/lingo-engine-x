import { create } from 'zustand';
import type { Db, DbErr, Unsub } from '../platform/types';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import { validateDoc } from './validate';

// Laufende Ansicht auf die Dokumente, die die Oberfläche braucht. Jede Abfrage wird genau
// einmal abonniert (startLive beim Start, Abmelden beim Beenden) – nie aus dem Render
// (contract/db.d.ts, onSnapshot). Jeder gelesene Datensatz wird mit zod geprüft.
//
// Ungültig ist nicht fehlend: Ein vorhandenes, aber vom Schema abgelehntes Dokument wird
// gemeldet (`invalid`) und für die Anzeige unverändert bereitgestellt – Lesezugriffe sind
// defensiv. Geschrieben wird darauf nur per Einmischen (writer.patch prüft selbst, ob das
// Dokument existiert). So kann ein einzelnes falsches Feld nie zum Verlust des Dokuments führen.
//
// Fehler (db.d.ts): `unavailable` oder ein unbekannter Code heißt „Brücke tot" – nur ein
// frisches onSnapshot hilft, also genau einmal neu abonnieren. Alle anderen Codes und ein
// zweiter Abbruch führen zum Zustand `error`, den die App als klaren Hinweis zeigt.

type Doc = Record<string, unknown>;

export const LIVE_DOCS = ['app/profile', 'app/course', 'app/assess', 'app/schema'] as const;
export const LIVE_COLLECTIONS = ['vocab', 'grammar'] as const;
export type LiveDocPath = (typeof LIVE_DOCS)[number];
export type LiveCollection = (typeof LIVE_COLLECTIONS)[number];

type LiveState = {
  status: 'waiting' | 'ready' | 'error';
  errorCode?: string;
  /** `undefined` = noch nicht geladen, `null` = Dokument existiert nicht. */
  docs: Partial<Record<LiveDocPath, Doc | null>>;
  collections: Partial<Record<LiveCollection, ReadonlyMap<string, Doc>>>;
  /** Pfad → Befunde der Schemaprüfung (vorhanden, aber ungültig). */
  invalid: Readonly<Record<string, string[]>>;
  /** Tagesprotokoll `log/<heute>`: `doc` undefined = noch nicht geladen, null = fehlt. */
  day: { key: string; doc: Doc | null | undefined; invalid: boolean } | null;
};

const initial = (): LiveState => ({ status: 'waiting', docs: {}, collections: {}, invalid: {}, day: null });
export const useLive = create<LiveState>(initial);

const RESUBSCRIBE_CODES = new Set(['unavailable']);
const KNOWN_TERMINAL = new Set(['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error']);

function markLoaded(): void {
  const s = useLive.getState();
  if (s.status !== 'waiting') return;
  const all = LIVE_DOCS.every((p) => s.docs[p] !== undefined) && LIVE_COLLECTIONS.every((c) => s.collections[c] !== undefined);
  if (all) useLive.setState({ status: 'ready' });
}

function setInvalid(path: string, issues: string[] | null): void {
  const cur = useLive.getState().invalid;
  if (!issues && !(path in cur)) return;
  const next = { ...cur };
  if (issues) next[path] = issues;
  else delete next[path];
  useLive.setState({ invalid: next });
}

function checked(path: string, data: Doc): { value: Doc; ok: boolean } {
  const res = validateDoc(path, data);
  if (res.ok) {
    setInvalid(path, null);
    return { value: res.value, ok: true };
  }
  if (!(path in useLive.getState().invalid)) {
    logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
  }
  setInvalid(path, res.issues);
  return { value: data, ok: false };
}

export function startLive(db: Db): () => void {
  let stopped = false;
  const unsubs = new Map<string, Unsub>();
  const retried = new Set<string>();

  const subscribe = (key: string, open: (onError: (e: DbErr) => void) => Unsub) => {
    const onError = (err: DbErr) => {
      if (stopped) return;
      const { code = 'unavailable' } = describeError(err);
      const deadBridge = RESUBSCRIBE_CODES.has(code) || !KNOWN_TERMINAL.has(code);
      if (deadBridge && !retried.has(key)) {
        retried.add(key);
        logWarn('data:live', err, `${key} – neu abonniert`);
        unsubs.get(key)?.();
        setTimeout(() => {
          if (!stopped) unsubs.set(key, open(onError));
        }, 250 + Math.random() * 500);
        return;
      }
      logError('data:live', err, key);
      useLive.setState({ status: 'error', errorCode: code });
    };
    unsubs.set(key, open(onError));
  };

  for (const path of LIVE_DOCS) {
    subscribe(path, (onError) =>
      db.doc(path).onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : undefined;
        const value = data ? checked(path, data).value : null;
        useLive.setState((s) => ({ docs: { ...s.docs, [path]: value } }));
        retried.delete(path); // Verbindung steht wieder: ein späterer Abriss darf erneut einmal neu abonnieren.
        markLoaded();
      }, onError),
    );
  }
  for (const name of LIVE_COLLECTIONS) {
    subscribe(name, (onError) =>
      db.collection(name).onSnapshot((qs) => {
        const map = new Map<string, Doc>();
        for (const d of qs.docs) {
          const data = d.exists ? d.data() : undefined;
          if (!data) continue;
          const res = checked(`${name}/${d.id}`, data);
          // Karten und Themen mit ungültigem Aufbau werden gemeldet und nicht mitgezählt.
          if (res.ok) map.set(d.id, res.value);
        }
        useLive.setState((s) => ({ collections: { ...s.collections, [name]: map } }));
        retried.delete(name);
        markLoaded();
      }, onError),
    );
  }

  return () => {
    stopped = true;
    unsubs.forEach((u) => u());
    unsubs.clear();
    useLive.setState(initial());
  };
}

/**
 * Abo auf das Tagesprotokoll `log/<day>` (Tagesbilanz und Fortschritt „Wiederholen").
 * Genau ein Abo je Lerntag; beim Wechsel um 04:00 wird es einmal neu abonniert.
 */
export function startDayLive(db: Db, day: string): () => void {
  let stopped = false;
  let retried = false;
  let unsub: Unsub | null = null;
  const path = `log/${day}`;
  useLive.setState({ day: { key: day, doc: undefined, invalid: false } });
  const open = () => {
    unsub = db.doc(path).onSnapshot(
      (snap) => {
        if (stopped) return;
        const data = snap.exists ? snap.data() : undefined;
        const res = data ? validateDoc(path, data) : null;
        if (res && !res.ok) logError('data:validate', { code: 'invalid_document', message: res.issues.join('; ') }, path);
        useLive.setState({ day: { key: day, doc: data ?? null, invalid: !!res && !res.ok } });
        retried = false;
      },
      (err) => {
        if (stopped) return;
        const { code = 'unavailable' } = describeError(err);
        if (!retried && (RESUBSCRIBE_CODES.has(code) || !KNOWN_TERMINAL.has(code))) {
          retried = true;
          logWarn('data:live', err, `${path} – neu abonniert`);
          unsub?.();
          setTimeout(() => {
            if (!stopped) open();
          }, 250 + Math.random() * 500);
          return;
        }
        // Ohne Tagesprotokoll läuft die App weiter; die Bilanz bleibt dann leer.
        logError('data:live', err, path);
        useLive.setState({ day: { key: day, doc: null, invalid: false } });
      },
    );
  };
  open();
  return () => {
    stopped = true;
    unsub?.();
  };
}

/** Kennungen der Vokabeln mit ungültigem Dokument (nie als Voreinstellung abfragen). */
export function invalidIdsOf(invalid: Readonly<Record<string, string[]>>, collection: string): Set<string> {
  const out = new Set<string>();
  const prefix = `${collection}/`;
  for (const p of Object.keys(invalid)) if (p.startsWith(prefix)) out.add(p.slice(prefix.length));
  return out;
}
