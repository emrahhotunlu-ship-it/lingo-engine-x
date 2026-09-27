import type { Db, DbAcquireResult } from '../platform/types';
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

export type TransformOp = { set: Record<string, unknown> } | { update: Record<string, unknown> } | { replace: Record<string, unknown> };

export type Writer = {
  /** Ganzes Dokument schreiben. `prev` = bekannter Stand; ist er gleich, wird nicht geschrieben. */
  set(path: string, data: Record<string, unknown>, prev?: Record<string, unknown> | null): Promise<WriteOutcome>;
  /**
   * Felder einmischen (verschachtelte Objekte werden verschmolzen); legt das Dokument an, falls es fehlt.
   * `current` = bekannter Stand, nur als Hinweis für „ändert sich nichts". Ob das Dokument fehlt,
   * prüft patch immer selbst – ein bestehendes Dokument wird nie ersetzt, nur ergänzt.
   */
  patch(path: string, patch: Record<string, unknown>, current?: Record<string, unknown> | null): Promise<WriteOutcome>;
  /**
   * Lesen, berechnen, schreiben in EINEM Schritt der Warteschlange dieses Dokuments: `compute`
   * bekommt den frischen Stand (`undefined` = fehlt) und liefert, was zu tun ist. `set` ist nur
   * erlaubt, wenn das Dokument fehlt – ein bestehendes wird nie ersetzt.
   * Einzige Ausnahme: `replace` ersetzt ein bestehendes Dokument durch eine aus GENAU diesem
   * frischen Stand berechnete Fassung (Verdichten eines Zwischenspeichers, z. B. `app/lookup`,
   * dessen verdrängte `null`-Schlüssel `update` nie entfernen kann). Für Lernstände nie benutzen.
   */
  transform(
    path: string,
    compute: (current: Record<string, unknown> | undefined) => TransformOp | null,
  ): Promise<'created' | 'updated' | 'unchanged'>;
  /** Dokument nur anlegen, wenn es fehlt (Prüfen und Anlegen in derselben Warteschlange). */
  createIfMissing(path: string, data: Record<string, unknown>): Promise<'created' | 'exists'>;
  /** Felder in ein BESTEHENDES Dokument einmischen; schlägt fehl, wenn es fehlt (db `update`). */
  update(path: string, patch: Record<string, unknown>): Promise<WriteOutcome>;
  /**
   * Kurze, kooperative Sperre auf ein Dokument (db `acquire`, ohne `data`). `{acquired:false}` ist ein
   * normales Ergebnis: Der Aufrufer versucht es erst beim nächsten Anlass wieder, nie in einer Schleife.
   */
  acquire(path: string, opts: { holder: string; ttlMs?: number }): Promise<AcquireOutcome>;
  /**
   * Phase 7 (Plan §12.3, W5): ein bestehendes Dokument durch eine aus dem FRISCHEN Stand berechnete
   * Fassung ersetzen (`set`) und danach neu lesen und prüfen. Nur für `app/profile` (Auslagern alter
   * Jahre nach vorheriger Archivierung). `build` liefert `null`, wenn nichts zu tun ist, und wirft,
   * wenn die Vorbedingung (Archiv inhaltsgleich) nicht erfüllt ist – dann wird nichts geschrieben.
   */
  compact(path: string, build: (fresh: Record<string, unknown>) => Record<string, unknown> | null): Promise<'compacted' | 'unchanged'>;
};

export type AcquireOutcome = { acquired: boolean; expiresAt?: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const KNOWN_CODES = new Set([
  'invalid_argument',
  'resource_exhausted',
  'quota_exceeded',
  'unavailable',
  'revoked',
  'not_granted',
  'capability_disabled',
  'capability_removed',
  'transform_error',
  'read_only',
]);

/** Dokumente, die `transform` per `replace` ganz ersetzen darf: nur Zwischenspeicher. */
const REPLACEABLE = new Set(['app/lookup']);
/** Dokumente, die `compact` ersetzen darf (Plan §12.3). */
const COMPACTABLE = new Set(['app/profile']);

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
      // `unavailable` und unbekannte Codes: genau einmal nach kurzer Zufallspause (db.d.ts).
      if (code === undefined || code === 'unavailable' || !KNOWN_CODES.has(code)) {
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
        // `current` ist nur ein Hinweis für „ändert sich nichts". Ob das Dokument fehlt,
        // entscheidet immer ein frisches get(): `set` ersetzt das ganze Dokument und darf
        // deshalb nie auf ein bestehendes treffen (Kap. 9 – nie Daten verlieren).
        if (current && patchIsNoop(current, patchData)) return 'unchanged';
        let exists = !!current;
        if (!exists) {
          const snap = await db.doc(path).get();
          const data = snap.exists ? snap.data() : undefined;
          if (data && patchIsNoop(data, patchData)) return 'unchanged';
          exists = snap.exists;
        }
        if (exists) await withRetry(path, () => db.doc(path).update(patchData));
        else await withRetry(path, () => db.doc(path).set(patchData));
        return 'written';
      });
    },
    transform(path, compute) {
      guard(path);
      return enqueue(path, async (): Promise<'created' | 'updated' | 'unchanged'> => {
        const snap = await db.doc(path).get();
        const current = snap.exists ? snap.data() : undefined;
        const op = compute(current);
        if (!op) return 'unchanged';
        if ('replace' in op) {
          // Nur Zwischenspeicher dürfen ganz ersetzt werden – nie Lernstände (Kap. 9, Regel 1).
          if (!REPLACEABLE.has(path)) throw new WriteError('invalid_argument', `replace ist für ${path} nicht erlaubt`, path);
          if (current && jsonEqual(current, op.replace)) return 'unchanged';
          await withRetry(path, () => db.doc(path).set(op.replace));
          return current ? 'updated' : 'created';
        }
        if ('set' in op) {
          if (current) throw new WriteError('exists', `${path} existiert – anlegen verweigert`, path);
          await withRetry(path, () => db.doc(path).set(op.set));
          return 'created';
        }
        if (!current) throw new WriteError('missing', `${path} fehlt – ergänzen nicht möglich`, path);
        if (patchIsNoop(current, op.update)) return 'unchanged';
        await withRetry(path, () => db.doc(path).update(op.update));
        return 'updated';
      });
    },
    createIfMissing(path, data) {
      guard(path);
      return enqueue(path, async (): Promise<'created' | 'exists'> => {
        const snap = await db.doc(path).get();
        if (snap.exists) return 'exists';
        await withRetry(path, () => db.doc(path).set(data));
        return 'created';
      });
    },
    update(path, patchData) {
      guard(path);
      return enqueue(path, async (): Promise<WriteOutcome> => {
        await withRetry(path, () => db.doc(path).update(patchData));
        return 'written';
      });
    },
    compact(path, build) {
      guard(path);
      return enqueue(path, async (): Promise<'compacted' | 'unchanged'> => {
        if (!COMPACTABLE.has(path)) throw new WriteError('invalid_argument', `compact ist für ${path} nicht erlaubt`, path);
        const snap = await db.doc(path).get();
        const fresh = snap.exists ? snap.data() : undefined;
        if (!fresh) throw new WriteError('missing', `${path} fehlt – nichts zu verdichten`, path);
        const next = build(fresh);
        if (!next || jsonEqual(fresh, next)) return 'unchanged';
        await withRetry(path, () => db.doc(path).set(next));
        const after = await db.doc(path).get();
        if (!after.exists || !jsonEqual(after.data(), next)) {
          const err = new WriteError('verify_failed', `${path} nach dem Verdichten nicht wie erwartet`, path);
          logError('data:compact', err, path);
          throw err;
        }
        return 'compacted';
      });
    },
    async acquire(path, opts) {
      guard(path);
      let res: DbAcquireResult | null = null;
      // Mit derselben Kennung ist ein zweiter Versuch nur eine Verlängerung – also unschädlich.
      await withRetry(path, async () => {
        res = await db.doc(path).acquire({ holder: opts.holder, ttlMs: opts.ttlMs });
      });
      const r = res as DbAcquireResult | null;
      return { acquired: !!r?.acquired, ...(r?.expiresAt ? { expiresAt: r.expiresAt } : {}) };
    },
  };
}
