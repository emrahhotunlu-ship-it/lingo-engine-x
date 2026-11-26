import { create } from 'zustand';

// Welcher C1-Check ist gerade offen? Das Blatt hängt in der Shell (`CheckHost`), nicht an der Karte oder am Check-Tag-Schritt: Nach dem Speichern
// verschwindet die Karte, das Ergebnis muss aber stehen bleiben. `ctx` = am Check-Tag aus dem Tagesablauf gestartet (Lerntag und die Pflichtpunkte von
// Schritt 2 und 3, die der Check ersetzt). `running`: Aufgaben laufen (Schließen fragt dann nach); `ask`: die Nachfrage steht.

export type CheckCtx = { day: string; duties: string[] };

type State = {
  open: boolean;
  ctx: CheckCtx | null;
  running: boolean;
  ask: boolean;
  /** Der Check dieses Öffnens ist gespeichert (für den Weg zurück in den Tagesablauf). */
  saved: boolean;
  show: (ctx?: CheckCtx | null) => void;
  close: () => void;
};

export const useC1CheckSheet = create<State>((set) => ({
  open: false,
  ctx: null,
  running: false,
  ask: false,
  saved: false,
  show: (ctx = null) => set({ open: true, ctx, running: false, ask: false, saved: false }),
  close: () => set({ open: false, running: false, ask: false }),
}));

/** Schließen auf Wunsch (Kreuz, Hintergrund, Esc): Laufen Aufgaben, kommt erst die Nachfrage. */
export function requestCloseCheck(): void {
  const s = useC1CheckSheet.getState();
  if (s.running) useC1CheckSheet.setState({ ask: true });
  else s.close();
}

