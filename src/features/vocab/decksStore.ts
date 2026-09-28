import { create } from 'zustand';
import { getWriter } from '../../data';
import { watchDoc } from '../../data/watch';
import { DECKS_PATH, readDecks, type DecksDoc, type DecksError, type DecksResult } from '../../domain/srs/decks';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';

// Stapel-Dokument `app/decks` (P3): EIN Abo, damit „Wiederholen“ den Standard-Modus synchron im
// Klick kennt (iPhone-Tastatur). Das Dokument ist klein (< 64 KiB). Geschrieben wird nur über
// `writer.transform` mit den Ops aus `domain/srs/decks.ts` (Grenzen vor dem Schreiben geprüft).

type Doc = Record<string, unknown>;

type DecksState = { raw: Doc | null; decks: DecksDoc; ok: boolean; status: 'idle' | 'ready' | 'error' };

export const useDecks = create<DecksState>(() => ({ raw: null, decks: readDecks(null), ok: true, status: 'idle' }));

let stop: (() => void) | null = null;

function start(): void {
  if (stop) return;
  const db = getDb();
  if (!db) return;
  stop = watchDoc(
    db,
    DECKS_PATH,
    (w) => useDecks.setState({ raw: w.data ?? null, decks: readDecks(w.ok ? w.data : null), ok: w.ok, status: 'ready' }),
    () => useDecks.setState({ status: 'error' }),
  );
}

/** Einmal beim Start (Bereich `boot`): sobald die Datenbank bereitsteht, `app/decks` abonnieren. */
export function installDecksWatch(): void {
  if (useCapabilities.getState().db === 'ready') start();
  const unsub = useCapabilities.subscribe((s) => {
    if (s.db === 'ready') {
      start();
      if (stop) unsub();
    }
  });
}

export type DecksWrite = { ok: true } | { ok: false; error: DecksError | 'failed' | 'offline' };

/** Eine Op auf dem frischen Stand ausführen; Grenzen verletzt → nichts geschrieben, Fehlercode zurück. */
export async function writeDecks(build: (cur: Doc | undefined) => DecksResult): Promise<DecksWrite> {
  const writer = getWriter();
  if (!writer) return { ok: false, error: 'offline' };
  let err: DecksError | undefined;
  try {
    await writer.transform(DECKS_PATH, (cur) => {
      const r = build(cur);
      err = r.error;
      return r.op;
    });
    if (err) {
      logWarn('vocab:decks', { code: err, message: 'app/decks nicht geschrieben' }, DECKS_PATH);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    logError('vocab:decks', e, DECKS_PATH);
    return { ok: false, error: 'failed' };
  }
}
