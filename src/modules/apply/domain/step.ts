import { isApplyKind, type ApplyKind, type WriteKind } from './count';

// Tagesweg Schritt 3 „Anwenden“ (F3, Nachtrag learning-scientist Muss 4): was beim Start läuft. Rein.
// - Die Disziplin steht im eingefrorenen Plan (`u.ap`); ältere Pläne ohne `ap` laufen wie bisher (eigener Satz).
// - Kurzer Tag: eigener Satz mit EINEM Satz (die Disziplin wandert zum nächsten vollen Tag, der Zähler zählt kurze Tage nicht).
// - Ohne Claude: Satzbau wie bisher (ohne KI erfüllbar). Fehlendes Material (kein Artikel) erkennt erst der Bildschirm; er bietet dann den eigenen Satz an.

export type StepPlan = { to: 'combo'; n: number } | { to: 'task'; kind: WriteKind } | { to: 'order' };

/** Sätze des eigenen Satzes am vollen Tag und am kurzen Tag. */
export const COMBO_FULL = 3;
export const COMBO_SHORT = 1;

export function resolveStep(i: { ap: unknown; short: boolean; ai: boolean }): StepPlan {
  if (!i.ai) return { to: 'order' };
  if (i.short) return { to: 'combo', n: COMBO_SHORT };
  const ap: ApplyKind = isApplyKind(i.ap) ? i.ap : 'combo';
  return ap === 'combo' ? { to: 'combo', n: COMBO_FULL } : { to: 'task', kind: ap };
}
