import { createContext, useContext } from 'react';
import type { Route } from '../router/types';

// Kontext der Übungsebene (Player.tsx). Eigene Datei, damit Fehlergrenzen (Boundary.tsx) und
// Übungsleiste (features/learn/ui.tsx) ihn lesen können, ohne den Player zu importieren.

export type PlayerApi = {
  route: Route | null;
  /** Beitrag der Bereiche zur Zeile unter dem Balken (`null` = keiner → „Pflicht“/„Extra“). */
  note: string | null;
  /** Überspringen ohne Bewertung anmelden (`usePlayerSkip`). */
  setSkip: (fn: (() => void) | null) => void;
  /** Angemeldetes Überspringen (für `StepBoundary` ohne eigenes `onSkip`). */
  skip: (() => void) | null;
};

export const PlayerContext = createContext<PlayerApi>({ route: null, note: null, setSkip: () => undefined, skip: null });

export function usePlayer(): PlayerApi {
  return useContext(PlayerContext);
}
