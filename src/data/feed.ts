import type { Db, DbErr, Unsub } from '../platform/types';
import { describeError, logError, logWarn } from '../platform/diagnostics';
import { validateDoc } from './validate';

// Abo auf die Beiträge des Claude-Tagesauftrags `feed/*` (Plan F24): genau EIN onSnapshot,
// sortiert nach `d` absteigend, die neuesten 21 Dokumente – nur solange Entdecken offen ist.
// `feed/*` wird nie geschrieben (Kap. 9, Regel 4); der Writer verweigert es ohnehin.

type Doc = Record<string, unknown>;

export const FEED_LIMIT = 21;

const KNOWN_TERMINAL = new Set(['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error']);

export type FeedDocs = ReadonlyArray<{ id: string; doc: Doc }>;

/**
 * Abonniert `feed` (orderBy d desc, limit 21). `next` bekommt die gültigen Dokumente in
 * Abfrage-Reihenfolge; ungültige werden gemeldet und ausgelassen. Bei totem Kanal
 * (`unavailable`/unbekannter Code) genau einmal neu abonnieren, sonst `error`.
 */
export function watchFeed(db: Db, next: (docs: FeedDocs) => void, error: (code: string) => void): Unsub {
  let stopped = false;
  let retried = false;
  let unsub: Unsub | null = null;
  const reported = new Set<string>();
  const open = () => {
    unsub = db
      .collection('feed')
      .orderBy('d', 'desc')
      .limit(FEED_LIMIT)
      .onSnapshot(
        (qs) => {
          if (stopped) return;
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
          retried = false;
          next(out);
        },
        (err: DbErr) => {
          if (stopped) return;
          const { code = 'unavailable' } = describeError(err);
          if (!retried && !KNOWN_TERMINAL.has(code)) {
            retried = true;
            logWarn('data:feed', err, 'feed – neu abonniert');
            unsub?.();
            setTimeout(() => {
              if (!stopped) open();
            }, 250 + Math.random() * 500);
            return;
          }
          logError('data:feed', err, 'feed');
          error(code);
        },
      );
  };
  open();
  return () => {
    stopped = true;
    unsub?.();
  };
}
