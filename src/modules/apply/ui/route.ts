import { startDrill, useDrill } from '../sharedUi';
import { BRIDGE_N } from '../shared';
import { resolveStep } from '../domain/step';

// Ziel von Schritt 3 „Anwenden“: SYNCHRON im Klick (iPhone-Tastatur), wie es der Tagesweg verlangt (`UnitBlockProvider.start`). `false` = nicht startbar.
// Die Entscheidung trifft `resolveStep` (rein); hier nur die Route und, ohne Claude, die Satzbau-Runde wie bisher.
// P4 (13.11.2026): mit Claude immer die Brücken-Sätze (`applyBridge`); am kurzen Tag mit einem Satz (`n = 1`).

type Block = 1 | 2 | 3 | 4 | 5;
export type StepRoute = { name: 'applyBridge'; unit: Block; n?: number } | { name: 'drill'; kind: 'order'; ctx: 'duty' };

/**
 * Satzbau-Runde als Schritt des Tageswegs starten; `true`, wenn sie Aufgaben hat.
 * `startDrill` meldet nur die Eingabeart der ersten Aufgabe (beim Satzbau immer `null`) – daran lässt sich „nicht startbar“ nicht ablesen
 * (vorher blieb der Knopf ohne Claude deshalb ohne Wirkung). Ob die Runde läuft, steht im Rundenzustand.
 */
export function startOrderRound(day: string, block: Block): boolean {
  startDrill('order', day, block);
  const s = useDrill.getState();
  return s.active && s.kind === 'order' && s.order.length > 0;
}

export function applyStepRoute(i: { ap: unknown; short: boolean; ai: boolean; day: string; block: Block }): StepRoute | false {
  const s = resolveStep(i);
  if (s.to === 'order') return startOrderRound(i.day, i.block) ? { name: 'drill', kind: 'order', ctx: 'duty' } : false;
  return s.n < BRIDGE_N ? { name: 'applyBridge', unit: i.block, n: s.n } : { name: 'applyBridge', unit: i.block };
}
