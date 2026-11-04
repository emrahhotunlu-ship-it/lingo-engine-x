import { startDrill } from '../sharedUi';
import { COMBO_FULL, resolveStep } from '../domain/step';

// Ziel von Schritt 3 „Anwenden“ (F3): SYNCHRON im Klick (iPhone-Tastatur), wie es der Tagesweg verlangt (`UnitBlockProvider.start`). `false` = nicht startbar.
// Die Entscheidung trifft `resolveStep` (rein); hier nur die Route und, ohne Claude, die Satzbau-Runde wie bisher.

type Block = 1 | 2 | 3 | 4 | 5;
export type StepRoute = { name: 'comboSentence'; unit: Block; n?: number } | { name: 'applyTask'; kind: 'reply' | 'write' | 'summary'; unit: Block } | { name: 'drill'; kind: 'order'; ctx: 'duty' };

export function applyStepRoute(i: { ap: unknown; short: boolean; ai: boolean; day: string; block: Block }): StepRoute | false {
  const s = resolveStep(i);
  if (s.to === 'order') return startDrill('order', i.day, i.block) === null ? false : { name: 'drill', kind: 'order', ctx: 'duty' };
  // Am vollen Tag ohne `n` (alle Paare der Runde, wie bisher); am kurzen Tag mit einem Satz.
  if (s.to === 'combo') return s.n < COMBO_FULL ? { name: 'comboSentence', unit: i.block, n: s.n } : { name: 'comboSentence', unit: i.block };
  return { name: 'applyTask', kind: s.kind, unit: i.block };
}
