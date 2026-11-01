import { logError, type Writer } from '../shared';
import type { PlaceResult } from '../domain/place';
import { VMOD_PLACE_PATH } from '../registry';
import { PLACE_OK_MAX, type PlaceDoc, vmodPlaceWriteSchema } from './schemas';

// Großpaket A S7c: Ergebnis der Einstufung nach `vmod/place` schreiben. Ändert keine Wörter und keinen Plan; das Nachfüllen (refill.ts) liest
// Grenze und gekonnte Stichwörter beim nächsten Tagesplan. Ein Dokument mit unerwartetem Aufbau wird nie angefasst (Kap. 9 Regel 6).

export function placeDoc(r: PlaceResult, nowMs: number): PlaceDoc | null {
  const ok = vmodPlaceWriteSchema.safeParse({
    v: 1,
    t: Math.max(1, Math.round(nowMs)),
    edge: r.edge,
    bands: r.bands.map((b) => [b.lo, b.s, b.r, b.p]),
    ok: r.ok.slice(0, PLACE_OK_MAX),
  });
  if (!ok.success) {
    logError('vocab:place-doc', ok.error, VMOD_PLACE_PATH);
    return null;
  }
  return ok.data;
}

/** Einstufung speichern (anlegen oder ersetzen der Felder). `false` bei ungültigem Ergebnis, fremdem Aufbau oder Schreibfehler. */
export async function writePlace(writer: Writer, r: PlaceResult, nowMs: number): Promise<boolean> {
  const doc = placeDoc(r, nowMs);
  if (!doc) return false;
  try {
    if ((await writer.createIfMissing(VMOD_PLACE_PATH, doc)) === 'created') return true;
    let done = false;
    await writer.transform(VMOD_PLACE_PATH, (cur) => {
      if (!cur) return null;
      if (cur.v !== 1) {
        logError('vocab:place-doc', new Error('db_invalid'), VMOD_PLACE_PATH);
        return null;
      }
      done = true;
      return { update: { v: 1, t: doc.t, edge: doc.edge, bands: doc.bands, ok: doc.ok } };
    });
    return done;
  } catch (err) {
    logError('vocab:place-write', err, VMOD_PLACE_PATH);
    return false;
  }
}
