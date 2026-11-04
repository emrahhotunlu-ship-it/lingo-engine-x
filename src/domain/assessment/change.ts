import { daysBetween } from '../date';
import { FOCUS_DIMS, type AssessRead, type FocusDim, type Level } from './types';

// Entscheidung 1B (Emrah 04.11.2026): Eine neue Einschätzung erscheint sofort; „Fortschritt“ sagt dazu deutlich,
// was sich gegenüber der vorigen geändert hat. Grundlage ist der Verlauf `hist` (je Tag ein Eintrag), keine neue Datenstruktur.

export const CHANGE_NOTE_DAYS = 3;

export type AssessChange = { d: string; changes: { id: FocusDim; before: Level | null; now: Level | null }[] };

/** Änderung der Fokus-Stufen (Wörter, Grammatik) gegenüber dem vorigen Tag im Verlauf – nur bis `CHANGE_NOTE_DAYS` nach der Einschätzung. */
export function assessChange(a: AssessRead | null, today: string): AssessChange | null {
  if (!a?.d) return null;
  const age = daysBetween(a.d, today);
  if (!(age >= 0 && age <= CHANGE_NOTE_DAYS)) return null;
  const before = [...a.hist].filter((h) => h.d < (a.d as string)).sort((x, y) => (x.d < y.d ? -1 : 1)).pop();
  if (!before) return null;
  const changes = FOCUS_DIMS.flatMap((id) => {
    const now = a.data.dims.find((x) => x.id === id)?.level ?? null;
    const was = before.dims[id] ?? null;
    return now && was && now !== was ? [{ id, before: was, now }] : [];
  });
  return changes.length ? { d: a.d, changes } : null;
}
