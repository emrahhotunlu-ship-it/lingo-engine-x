import { create } from 'zustand';
import type { Route } from '../../app/router/types';
import type { UnitBlockKind, UnitBlockNo, UnitTaskResult } from '../../app/unit/types';

// Zustand der laufenden Tageseinheit (nur im Speicher; Fortsetzen über den Vertrag `unit`).
// Ohne weitere Abhängigkeiten, damit `today/state.ts` (roundCtx) ihn ohne Import-Schleife liest.

/** Wie der laufende Block ausgeführt wird: Anbieter aus dem Register oder Ersatz (vorhandene Route). */
export type UnitVia = 'provider' | 'trainer' | 'own' | 'say' | 'grammar' | 'check';

export type UnitRun = {
  /** Lerntag der Einheit. */
  day: string | null;
  block: UnitBlockNo | null;
  /** Pflichtpunkt des Blocks (`review`, `ch:u-*`). */
  duty: string | null;
  kind: UnitBlockKind | null;
  via: UnitVia | null;
  /** Ersatzblock: Rundenende dieses `act` (Sammel-Puffer) gilt als Abschluss. */
  watch: string | null;
  /** Name der Route des Blocks (für die Zeile unter dem Balken). */
  routeName: string | null;
  /** Route des laufenden Blocks (Fortsetzen). */
  route: Route | null;
  /** Von `input.*`: Nachsprech-Sätze und Wendungen; von `task.*`: Ergebnis für Block 4/5. */
  sentences: string[];
  phrases: string[];
  task: UnitTaskResult | null;
  /** Ohne KI oder KI verzögert (M4d): Block wird lokal/ungeprüft ausgeführt. */
  offline: boolean;
  /** Zeitpunkt des Blockstarts (ms). */
  at: number;
  /** Entwurf im Ersatzschritt „Nochmal, aber besser“. */
  draft: string;
};

export const EMPTY_RUN: UnitRun = {
  day: null,
  block: null,
  duty: null,
  kind: null,
  via: null,
  watch: null,
  routeName: null,
  route: null,
  sentences: [],
  phrases: [],
  task: null,
  offline: false,
  at: 0,
  draft: '',
};

export const useUnitRun = create<UnitRun>(() => EMPTY_RUN);
