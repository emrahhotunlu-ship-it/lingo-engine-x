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

/** Anlass des Verlassens: Seite verborgen (`hidden`), Seite wird verlassen (`pagehide`), ✕/Pause/Reiter/Aushängen (`go`). */
export type LeaveCause = 'hidden' | 'pagehide' | 'go';

/**
 * Wie eine Übung mit Ergebnis beim Verlassen bucht (Nachtrag LS3, Korrekturrunde 2):
 * - `none`: nichts (kein Ergebnis, schon weitergegeben, Claude prüft noch),
 * - `stay`: speichern, die Aufgabe bleibt mit ihrem Ergebnis stehen (Runde mit eigenem Halten, z. B. Trainer),
 * - `go`: speichern und weiterrechnen, `release`: schon beim Verbergen gespeichert, jetzt nur noch weitergehen.
 * Ein eigener Schreibweg ohne Halten (`own`, z. B. Wochen-Check) kann nicht „stehen bleiben und später weiterzählen“: verborgen bucht er
 * nichts, beim Verlassen der Seite (`pagehide`) und beim Gehen bucht er und geht weiter.
 */
export function leaveAction(cause: LeaveCause, s: { result: boolean; done: false | 'stay' | 'go'; busy: boolean; own: boolean }): 'none' | 'stay' | 'go' | 'release' {
  if (!s.result || s.done === 'go') return 'none';
  if (s.done === 'stay') return cause === 'go' ? 'release' : 'none';
  if (s.busy) return 'none';
  if (s.own) return cause === 'hidden' ? 'none' : 'go';
  return cause === 'go' ? 'go' : 'stay';
}
