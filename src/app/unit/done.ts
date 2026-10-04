import { logWarn } from '../../platform/diagnostics';
import type { UnitBlockNo, UnitDone, UnitTaskResult } from './types';

// Fester Meldepunkt für den Abschluss eines Einheits-Blocks (Integrator, plan.md §4.10).
// Jede Übung ruft `unitDone(block, result?)`; P1 registriert den eigentlichen Ablauf mit
// `setUnitDoneHandler` (Zählen von act['u-…'], Zwischenkarte). So hängt keine Übung an P1.

let handler: UnitDone | null = null;

export function setUnitDoneHandler(next: UnitDone | null): void {
  handler = next;
}

export const unitDone: UnitDone = (block: UnitBlockNo, result?: UnitTaskResult) => {
  if (!handler) {
    logWarn('unit:done', `kein Handler für Block ${block}`);
    return;
  }
  handler(block, result);
};
