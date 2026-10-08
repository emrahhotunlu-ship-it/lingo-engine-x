// Tasten für Auswahlaufgaben (Lernplattform 2.0 §4.4): A–D und 1–4 wählen dieselbe Option.
// Reine Zuordnung ohne Browserbezug; ob gerade ein Textfeld den Fokus hat, prüft der Aufrufer.

/** Höchstens vier Optionen sind per Taste erreichbar (A–D bzw. 1–4). */
export const MAX_KEYED_OPTIONS = 4;

/** Beschriftung der Optionen (A–D), danach E, F für seltene Fälle. */
export const CHOICE_LETTERS: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Index der Option zur Taste, sonst `null`. Groß-/Kleinschreibung ist egal, `n` ist die Zahl der Optionen. */
export function keyToIndex(key: string, n: number): number | null {
  if (key.length !== 1) return null;
  const limit = Math.min(Math.max(0, Math.floor(n)), MAX_KEYED_OPTIONS);
  let i = -1;
  if (key >= '1' && key <= '9') i = Number(key) - 1;
  else {
    const c = key.toUpperCase();
    if (c >= 'A' && c <= 'D') i = c.charCodeAt(0) - 65;
  }
  return i >= 0 && i < limit ? i : null;
}

/** Tastenbereich für den Hinweis („A–B“ und „1–2“ bei zwei Optionen), aus der Zahl der per Taste erreichbaren Optionen. `null` ohne Optionen. */
export function choiceKeyRange(n: number): { letters: string; nums: string } | null {
  const limit = Math.min(Math.max(0, Math.floor(n)), MAX_KEYED_OPTIONS);
  if (limit < 1) return null;
  if (limit === 1) return { letters: 'A', nums: '1' };
  return { letters: `A–${CHOICE_LETTERS[limit - 1]}`, nums: `1–${limit}` };
}
