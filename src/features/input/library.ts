import { create } from 'zustand';
import { readCollection } from '../../data/reads';
import { getDb } from '../../platform/capabilities';
import { logError } from '../../platform/diagnostics';

// Gespeicherte Inhalte und Ergebnisse von Phase 4 (Plan §2.6): `articles`, `lpool`, `reading`,
// `writing` (beide Formen) und `wprompt`. Einmal je Seitenaufruf per `get()` gelesen (kein Abo,
// Plan F24) – eigene Schreibvorgänge werden lokal eingemischt. Nichts wird hier geschrieben.

type Doc = Record<string, unknown>;
export type LibName = 'articles' | 'lpool' | 'reading' | 'writing' | 'wprompt';
export const LIB_NAMES: readonly LibName[] = ['articles', 'lpool', 'reading', 'writing', 'wprompt'];

type LibState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  docs: Record<LibName, ReadonlyMap<string, Doc>>;
  invalid: readonly string[];
  /** Tageswahl je Einheit (`read|2026-09-27` → Kennung), gegen Neuwürfeln beim Neuzeichnen. */
  picks: Readonly<Record<string, string>>;
};

const empty = (): LibState['docs'] => ({ articles: new Map(), lpool: new Map(), reading: new Map(), writing: new Map(), wprompt: new Map() });

export const useInputLibrary = create<LibState>(() => ({ status: 'idle', docs: empty(), invalid: [], picks: {} }));

let loading: Promise<void> | null = null;

/** Alle Sammlungen einmal laden; weitere Aufrufe warten auf denselben Lauf. */
export function ensureLibrary(force = false): Promise<void> {
  const s = useInputLibrary.getState();
  if (s.status === 'loading' && loading) return loading;
  if (!force && s.status === 'ready') return Promise.resolve();
  const db = getDb();
  if (!db) return Promise.resolve();
  useInputLibrary.setState({ status: 'loading' });
  loading = (async () => {
    try {
      const results = await Promise.all(LIB_NAMES.map((n) => readCollection(db, n)));
      const docs = empty();
      const invalid: string[] = [];
      LIB_NAMES.forEach((n, i) => {
        const r = results[i];
        if (!r) return;
        docs[n] = r.valid;
        invalid.push(...r.invalid.map((id) => `${n}/${id}`));
      });
      // Eigene Schreibvorgänge, die schneller waren als das Lesen, bleiben erhalten.
      const local = useInputLibrary.getState().docs;
      for (const n of LIB_NAMES) {
        const merged = new Map(docs[n]);
        for (const [id, d] of local[n]) if (!merged.has(id)) merged.set(id, d);
        docs[n] = merged;
      }
      useInputLibrary.setState({ status: 'ready', docs, invalid });
    } catch (err) {
      logError('input:library', err);
      useInputLibrary.setState({ status: 'error' });
    }
  })();
  return loading;
}

/** Eigenen Schreibvorgang sofort sichtbar machen (optimistisch; die Datenbank ist maßgeblich). */
export function putLocal(name: LibName, id: string, doc: Doc): void {
  useInputLibrary.setState((s) => {
    const map = new Map(s.docs[name]);
    map.set(id, doc);
    return { docs: { ...s.docs, [name]: map } };
  });
}

/** Felder in ein lokal bekanntes Dokument einmischen (flach, wie `update`). */
export function mergeLocal(name: LibName, id: string, patch: Doc): void {
  const cur = useInputLibrary.getState().docs[name].get(id);
  putLocal(name, id, { ...(cur ?? {}), ...patch });
}

export function rememberPick(key: string, id: string): void {
  if (useInputLibrary.getState().picks[key] === id) return;
  useInputLibrary.setState((s) => ({ picks: { ...s.picks, [key]: id } }));
}

/** Nur für Tests. */
export function resetLibrary(): void {
  loading = null;
  useInputLibrary.setState({ status: 'idle', docs: empty(), invalid: [], picks: {} });
}
