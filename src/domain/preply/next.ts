// „Nächste Stunde am …“ (Neubau N80, N16): `app/week.preplyNext` feldweise schreiben. Rein und
// getestet. data-guard 00:35: nur nach gültigem Dokument, nur das geänderte Feld, `v` nie
// verringern, unbekannte Felder bleiben unberührt (Patch statt Ersetzen).

type Doc = Record<string, unknown>;
export type WeekOp = { set: Doc } | { update: Doc } | null;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Gültiger Termin: `JJJJ-MM-TT` ab heute (Vergangenes wird nicht mehr gespeichert). */
export function validNext(day: string, today: string): boolean {
  return DAY.test(day) && day >= today;
}

/**
 * Schreibweg für `preplyNext`. `cur = undefined`: Dokument fehlt → anlegen mit `v: 1`.
 * `valid = false` (Dokument unerwartet aufgebaut): nichts schreiben. `next = ''` entfernt den Termin.
 */
export function preplyNextOp(cur: Doc | undefined, valid: boolean, next: string): WeekOp {
  if (!cur) return next ? { set: { v: 1, preplyNext: next } } : null;
  if (!valid) return null;
  if ((cur.preplyNext ?? '') === next) return null;
  const patch: Doc = { preplyNext: next };
  if (typeof cur.v !== 'number' || cur.v < 1) patch.v = 1;
  return { update: patch };
}

/** Gespeicherter nächster Termin, falls noch nicht vorbei. */
export function readPreplyNext(doc: Doc | null | undefined, today: string): string | null {
  const v = doc?.preplyNext;
  return typeof v === 'string' && validNext(v, today) ? v : null;
}
