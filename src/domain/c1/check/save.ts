import { patchC1, type C1Check, type C1Doc, type PatchResult } from '../c1doc';

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

export const saveCheck = (entry: C1Check, now: number = Date.now()): Promise<PatchResult> => patchC1((doc) => appendCheck(doc, entry), now);
