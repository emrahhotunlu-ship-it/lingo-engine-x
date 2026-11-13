import { logError, type Writer } from '../shared';
import type { Tempo } from '../domain/tempo';
import { VMOD_TEMPO_PATH } from '../registry';
import { vmodTempoWriteSchema } from './schemas';

// Politur P2 (E3): `vmod/tempo` – das Tempo neuer Wörter des Lerntags mit Grund und Quote (domain/tempo.ts). EIN kleines Dokument, je Lerntag
// einmal fortgeschrieben (kein Dokument je Tag, A6 Nr. 6). Eigenes Dokument statt eines Felds in `vmod/day`: die ältere App-Fassung (Rückweg)
// schreibt `vmod/day` mit strengem Schema und kennt neue Felder dort nicht; `vmod/tempo` liest sie nie.
// Tolerant gelesen (ungültig oder neuere Fassung = kein Stand), streng geschrieben; ein Dokument mit unerwartetem Aufbau wird nie angefasst.

/** `vmod/tempo` lesen: `null` = fehlt, ungültig oder aus einer neueren Fassung. */
export function readTempo(raw: unknown): Tempo | null {
  const r = vmodTempoWriteSchema.safeParse(raw);
  return r.success ? { d: r.data.d, n: r.data.n, base: r.data.base, why: r.data.why, ok: r.data.ok, all: r.data.all } : null;
}

/**
 * Tempo des Lerntags speichern. Steht für denselben Lerntag und dieselbe Einstellung schon ein Stand da (zweites Gerät, Vorab-Einfrieren),
 * gilt dieser und wird zurückgegeben – so sehen alle Geräte am selben Tag dieselbe Zahl. Liefert den gültigen Stand oder `null`, wenn das
 * Dokument einen unerwarteten Aufbau hat (dann rechnet die Runde mit ihrem Wert, ohne zu speichern).
 */
export async function writeTempo(writer: Writer, next: Tempo, nowMs: number): Promise<Tempo | null> {
  const doc = vmodTempoWriteSchema.safeParse({ v: 1, ...next, t: nowMs });
  if (!doc.success) {
    logError('vocab:tempo', doc.error, VMOD_TEMPO_PATH);
    return null;
  }
  await writer.createIfMissing(VMOD_TEMPO_PATH, doc.data);
  let out: Tempo | null = null;
  await writer.transform(VMOD_TEMPO_PATH, (cur) => {
    if (!cur) return null;
    const old = readTempo(cur);
    if (!old) {
      logError('vocab:tempo', new Error('db_invalid'), VMOD_TEMPO_PATH);
      return null;
    }
    if (old.d === next.d && old.base === next.base) {
      out = old;
      return null;
    }
    // Nie einen neueren Lerntag mit einem älteren überschreiben (Gerät mit alter Uhr).
    if (old.d > next.d) {
      out = old.base === next.base ? old : next;
      return null;
    }
    out = next;
    return { update: doc.data };
  });
  return out;
}
