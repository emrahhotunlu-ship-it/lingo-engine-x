import { createContext, useContext } from 'react';
import type { Route } from '../router/types';

// Ebene, in der ein Bildschirm gerade gezeichnet wird (docs/neubau/architektur.md §2.1 Nr. 4).
// Rahmen-Bausteine lesen sie, statt dass jede Seite es selbst wissen muss:
// - Auf einer Reiter-Wurzel sitzen Übersetzen und Claude im Kopf (TopBar) – `TitleActions`
//   zeichnet dort nur die eigenen Knöpfe der Seite, nie ein zweites Claude-Symbol.
// - In der Übungsebene liest die Übungsleiste den Player-Kontext (Player.tsx).

export type LayerKind = 'tab' | 'page' | 'exercise' | 'system';

export type LayerInfo = { kind: LayerKind; route: Route | null };

export const LayerContext = createContext<LayerInfo>({ kind: 'page', route: null });

export function useLayer(): LayerInfo {
  return useContext(LayerContext);
}
