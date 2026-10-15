// Rückfälle (Lapses) einer Karte: EINE Lesefunktion (Auswertung 15.10.2026, Punkt 3).
// Eine Karte trägt zwei Zähler: `lapses` (Feld der alten App, an der Karte) und `fsrs.lapses` (Planung). Sie liefen auseinander
// (be-handled: lapses 11, fsrs.lapses 7). Gespeicherte Felder werden NICHT umgeschrieben; gelesen wird überall der größere der beiden Werte,
// damit kein Rückfall verloren geht und kein Leser etwas anderes sieht als ein anderer. Rein.

type Doc = Readonly<Record<string, unknown>>;

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/** Rückfälle der Karte: das Maximum aus `fsrs.lapses` und `lapses`; unlesbare Werte zählen 0. */
export function lapsesOf(doc: Doc | null | undefined): number {
  if (!doc) return 0;
  const f = doc.fsrs && typeof doc.fsrs === 'object' && !Array.isArray(doc.fsrs) ? (doc.fsrs as Record<string, unknown>) : {};
  return Math.max(count(f.lapses), count(doc.lapses));
}
