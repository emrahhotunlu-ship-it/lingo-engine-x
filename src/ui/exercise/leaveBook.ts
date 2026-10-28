// Korrekturrunde P3 (Punkt 4, LS3): Eine geprüfte, noch nicht mit „Weiter“ bestätigte Antwort wird beim Verlassen gebucht.
// Die gerade gezeigte Übung meldet hier, wie sie ihr Ergebnis bucht; das Verlassen der Runde (`leaveSession`, `leaveGrammar`) ruft es
// VOR dem Abräumen auf – danach steht die Aufgabe nicht mehr im Speicher, und das Aushängen der Übung könnte nichts mehr buchen.
// Genau ein Platz: es steht immer höchstens eine Übung mit Ergebnis.

let current: (() => void) | null = null;

/** Buchung beim Verlassen anmelden; die Rückgabe meldet sie wieder ab (nur, wenn sie noch die aktuelle ist). */
export function registerLeaveBook(fn: () => void): () => void {
  current = fn;
  return () => {
    if (current === fn) current = null;
  };
}

/** Angemeldete Buchung ausführen (höchstens einmal) und abmelden. */
export function flushLeaveBook(): void {
  const fn = current;
  current = null;
  fn?.();
}
