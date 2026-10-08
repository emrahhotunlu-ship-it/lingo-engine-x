import { flags } from '../../../app/flags';
import { useLive } from '../../../data/live';
import { readDoc } from '../../../data/reads';
import { readC1, type C1Doc } from '../../../domain/c1/c1doc';
import type { FcFor } from '../../../domain/c1/check/save';
import { FC_MIN_CHECKS, fcOf } from '../../../domain/c1/forecast';
import { inCheckWindow } from '../../../domain/c1/checkSchedule';
import { preloadC1x } from '../../../domain/c1x/preload';
import { getDb } from '../../../platform/capabilities';
import { logWarn } from '../../../platform/diagnostics';
import type { Db } from '../../../platform/types';
import { PATTERNS_DOC, wayFromLive, wayLogPaths } from '../wayData';

// Prognose beim Speichern des C1-Checks (P40 mit P44): Die Rechnung von „Weg zu C1“ (`wayFromLive`) braucht 28 Protokolltage und `app/patterns`. Sie werden
// nur gelesen, wenn jetzt überhaupt eingefroren werden kann (Schalter `way`, Check-Fenster, mit diesem Check ≥ 3 Checks). Die Rechnung selbst läuft im
// Schreibschritt auf dem frischen Dokument (`appendCheckFc`). Lesefehler: keine Prognose jetzt (sie entsteht dann beim Öffnen des Blatts).

type Doc = Record<string, unknown>;

/** Gelesen (`doc`), fehlt (`null`) oder Lesefehler (`'error'`). Ein ungültiges Dokument zählt wie im Blatt als fehlend (gemeldet von `readDoc`). */
async function safeDoc(db: Db, path: string): Promise<Doc | null | 'error'> {
  try {
    const r = await readDoc(db, path);
    return r.status === 'valid' ? r.doc : null;
  } catch (err) {
    logWarn('check:fc', err, path);
    return 'error';
  }
}

/**
 * Die Prognose-Rechnung für den Schreibschritt, oder `null`, wenn heute nichts eingefroren werden kann. Ein Lesefehler (geworfen) heißt ebenfalls
 * `null`: eingefroren wird nie mit unvollständigen Daten (data-guard P40, Sollte 2); ein fehlendes Dokument ist erlaubt.
 */
export async function checkFcFor(today: string, nowMs: number): Promise<FcFor | null> {
  if (!flags.way || !inCheckWindow(today)) return null;
  if (readC1(useLive.getState().docs['app/c1']).checks.length + 1 < FC_MIN_CHECKS) return null;
  const db = getDb();
  if (!db) return null;
  const paths = wayLogPaths(today);
  const [logs, patterns, errOk] = await Promise.all([
    Promise.all(paths.map((p) => safeDoc(db, p))),
    safeDoc(db, PATTERNS_DOC),
    preloadC1x(['err']).then(
      () => true,
      (err: unknown) => (logWarn('check:fc', err, 'c1x-err'), false),
    ),
  ]);
  if (!errOk || patterns === 'error' || logs.includes('error')) return null;
  const got = logs.filter((d): d is Doc => !!d && d !== 'error');
  return (doc: C1Doc) => {
    const live = useLive.getState();
    return fcOf(wayFromLive({ ...live, docs: { ...live.docs, 'app/c1': doc } }, { today, nowMs, logs: got, patterns: patterns ?? undefined }).calc);
  };
}
