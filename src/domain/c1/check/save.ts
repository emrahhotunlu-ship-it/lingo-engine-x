import { patchC1, type C1Check, type C1Doc, type PatchResult } from '../c1doc';
import { freezeIndex, type FcValue } from '../forecast';

// C1-Check speichern (Lernplattform 3.0 §4.3, P40): ein fertiger Check wird an `app/c1.checks` angehängt, nur über `patchC1` (`writer.transform`, Lesen
// und Schreiben in einem Schritt, nie in ein ungültiges Dokument). Nichts wird geändert oder gelöscht. Schreibt weder Muster noch Themen noch die Serie.

/**
 * Check anhängen; `null` (nichts schreiben), wenn derselbe Check schon dasteht (zweiter Tab, erneutes Speichern) oder die Form schon benutzt ist:
 * am Laptop jede Form höchstens einmal; am Handy höchstens ein Check je Tag und Form. Über `C1_LIMITS.checks` (24) Einträgen verwirft `compactC1` die ältesten (mit Protokoll). Rein.
 */
export function appendCheck(doc: C1Doc, entry: C1Check): C1Doc | null {
  if (entry.inp === 'desk' && doc.checks.some((c) => c.inp === 'desk' && c.f === entry.f)) return null;
  if (doc.checks.some((c) => c.inp === entry.inp && c.f === entry.f && c.d === entry.d)) return null;
  return { ...doc, checks: [...doc.checks, entry] };
}

/** Prognose für den Stand `doc` (mit dem neuen Check): Wert, `null` (Pause) oder `undefined` (nichts einfrieren). */
export type FcFor = (doc: C1Doc) => FcValue | null | undefined;

/**
 * Check anhängen und, wenn jetzt eingefroren wird (P44 `freezeIndex`: Check-Fenster, ≥ 3 Checks, ≥ 6 Wochen Programm, neuester Check des Monats),
 * im selben Schritt die Prognose `fc` setzen. So schreibt das Blatt „Weg zu C1“ `checks` nie getrennt hinterher. Gesetzt wird gezielt der neue
 * (letzte) Eintrag, nicht der erste mit gleichem Datum wie bei `withFc` (Handy- und Laptop-Check am selben Tag). Rein.
 */
export function appendCheckFc(doc: C1Doc, entry: C1Check, fcFor?: FcFor | null): C1Doc | null {
  const next = appendCheck(doc, entry);
  const last = next ? next.checks.length - 1 : -1;
  if (!next || !fcFor || freezeIndex(next, entry.d) !== last) return next;
  const fc = fcFor(next);
  if (fc === undefined) return next;
  return { ...next, checks: next.checks.map((c, k) => (k === last ? { ...c, fc } : c)) };
}

/** Warum ein Check nicht angehängt wird: derselbe Check steht schon da (`present`) oder die Laptop-Form ist schon benutzt (`rejected`). Rein. */
export function checkClash(doc: C1Doc, entry: C1Check): 'present' | 'rejected' | null {
  if (doc.checks.some((c) => c.inp === entry.inp && c.f === entry.f && c.d === entry.d)) return 'present';
  if (entry.inp === 'desk' && doc.checks.some((c) => c.inp === 'desk' && c.f === entry.f)) return 'rejected';
  return null;
}

/**
 * Ergebnis des Speicherns. `ok` = der Check steht in `app/c1` (neu geschrieben oder derselbe Check schon da). Sonst `why`:
 * `rejected` (Form schon benutzt), `blocked` (nichts geschrieben: Dokument unlesbar oder über 30 KB), `failed`, `unavailable` (keine Datenbank).
 */
export type SaveCheckResult = { ok: true; r: PatchResult; present?: true } | { ok: false; r: PatchResult; why: 'rejected' | 'blocked' | 'failed' | 'unavailable' };

/** Aus dem Schreibergebnis und dem, was der Schreibschritt gesehen hat, das ehrliche Ergebnis. Rein. */
export function checkOutcome(r: PatchResult, seen: 'present' | 'rejected' | 'appended' | null): SaveCheckResult {
  if (r === 'failed' || r === 'unavailable') return { ok: false, r, why: r };
  if (r === 'created' || r === 'updated') return { ok: true, r };
  if (seen === 'present') return { ok: true, r, present: true };
  return { ok: false, r, why: seen === 'rejected' ? 'rejected' : 'blocked' };
}

export async function saveCheck(entry: C1Check, now: number = Date.now(), fcFor?: FcFor | null): Promise<SaveCheckResult> {
  // Der Schreibschritt läuft auf dem frischen Stand (ggf. mehrmals); maßgeblich ist, was der letzte Lauf gesehen hat.
  let seen: 'present' | 'rejected' | 'appended' | null = null;
  const r = await patchC1((doc) => {
    seen = checkClash(doc, entry) ?? 'appended';
    return seen === 'appended' ? appendCheckFc(doc, entry, fcFor) : null;
  }, now);
  return checkOutcome(r, seen);
}
