import type { Db } from '../platform/types';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import { jsonEqual, patchIsNoop } from '../domain/equal';
import { isReadOnlyPath } from './paths';

// Der eine kontrollierte Schreibpfad (Kap. 3.4, Kap. 9):
// - schreibt nur, wenn sich das Dokument wirklich ändert,
// - höchstens ein Schreibvorgang je Dokument zur Zeit (Warteschlange je Pfad),
// - verweigert daily/* und feed/* (die schreibt nur der Claude-Tagesauftrag),
// - kennt kein Löschen: bestehende Dokumente werden nie gelöscht.
// `unavailable` wird laut Vertrag genau einmal nach kurzer Zufallspause wiederholt.

export type WriteOutcome = 'written' | 'unchanged';

export class WriteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = 'WriteError';
  }
}

export type Writer = {
  /** Ganzes Dokument schreiben. `prev` = bekannter Stand; ist er gleich, wird nicht geschrieben. */
  set(path: string, data: Record<string, unknown>, prev?: Record<string, unknown> | null): Promise<WriteOutcome>;
  /**
   * Felder einmischen (verschachtelte Objekte werden verschmolzen); legt das Dokument an, falls es fehlt.
   * `current` = bekannter Stand (`null` = bekannt, dass es fehlt); ohne Angabe wird vorher gelesen.
   */
  patch(path: string, patch: Record<string, unknown>, current?: Record<string, unknown> | null): Promise<WriteOutcome>;
  /** Felder in ein BESTEHENDES Dokument einmischen; schlägt fehl, wenn es fehlt (db `update`). */
  update(path: string, patch: Record<string, unknown>): Promise<WriteOutcome>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createWriter(db: Db): Writer {
  const queues = new Map<string, Promise<unknown>>();

  function enqueue<T>(path: string, job: () => Promise<T>): Promise<T> {
    const before = queues.get(path) ?? Promise.resolve();
    const run = before.then(job, job);
    // Nur die Warteschlange läuft weiter; der Fehler selbst geht an den Aufrufer (run).
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    queues.set(path, tail);
    void tail.then(() => {
      if (queues.get(path) === tail) queues.delete(path);
    });
    return run;
  }

  async function withRetry(path: string, op: () => Promise<void>): Promise<void> {
    try {
      await op();
    } catch (err) {
      const { code, message } = describeError(err);
      if (code === 'unavailable') {
        logWarn('data:write', err, `${path} – einmal wiederholt`);
        await sleep(300 + Math.random() * 500);
        try {
          await op();
          return;
        } catch (err2) {
          const d = describeError(err2);
          logError('data:write', err2, path);
          throw new WriteError(d.code ?? 'unavailable', d.message, path);
        }
      }
      logError('data:write', err, path);
      throw new WriteError(code ?? 'unknown', message, path);
    }
  }

  function guard(path: string): void {
    if (isReadOnlyPath(path)) {
      const err = new WriteError('read_only', `${path} wird nur vom Claude-Tagesauftrag geschrieben`, path);
      logError('data:guard', err, path);
      throw err;
    }
  }

  return {
    set(path, data, prev) {
      guard(path);
      return enqueue(path, async (): Promise<WriteOutcome> => {
        if (prev && jsonEqual(prev, data)) return 'unchanged';
        await withRetry(path, () => db.doc(path).set(data));
        return 'written';
      });
    },
    patch(path, patchData, current) {
      guard(path);
      return enqueue(path, async (): Promise<WriteOutcome> => {
        let cur = current;
        if (cur === undefined) {
          const snap = await db.doc(path).get();
          cur = snap.exists ? (snap.data() ?? null) : null;
        }
        if (cur && patchIsNoop(cur, patchData)) return 'unchanged';
        if (cur) await withRetry(path, () => db.doc(path).update(patchData));
        else await withRetry(path, () => db.doc(path).set(patchData));
        return 'written';
      });
    },
    update(path, patchData) {
      guard(path);
      return enqueue(path, async (): Promise<WriteOutcome> => {
        await withRetry(path, () => db.doc(path).update(patchData));
        return 'written';
      });
    },
  };
}
