import { patchC1, type C1Doc, type C1Gate, type PatchResult } from '../c1doc';
import { GATE } from './trigger';

// Kapitelprüfung speichern (Lernplattform 3.0 §4.4, P42): ein Versuch wird an `app/c1.gates` angehängt, nur über `patchC1` (`writer.transform`, Lesen und
// Schreiben in einem Schritt, nie in ein ungültiges Dokument). Nichts wird geändert oder gelöscht. Schreibt weder Muster noch Themen noch die Serie.

/** Versuch anhängen; `null` (nichts schreiben), wenn das Kapitel schon bestanden ist, die Versuche verbraucht sind oder derselbe Versuch schon dasteht (zwei Tabs). Rein. */
export function appendGate(doc: C1Doc, entry: C1Gate): C1Doc | null {
  const mine = doc.gates.filter((g) => g.ch === entry.ch);
  if (mine.some((g) => g.ok)) return null;
  if (mine.length >= GATE.maxAttempts) return null;
  if (mine.some((g) => g.d === entry.d && g.ok === entry.ok && g.g[0] === entry.g[0] && g.g[1] === entry.g[1] && g.w[0] === entry.w[0] && g.w[1] === entry.w[1])) return null;
  return { ...doc, gates: [...doc.gates, entry] };
}

export const saveGate = (entry: C1Gate, now: number = Date.now()): Promise<PatchResult> => patchC1((doc) => appendGate(doc, entry), now);
