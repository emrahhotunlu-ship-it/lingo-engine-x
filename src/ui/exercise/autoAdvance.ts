import type { ExplainDepth, ResultVerdict } from '../../domain/explain/types';

// Automatisch weiter (§4.2 `ShellFeedback.auto`): reine Entscheidung, der Zeitgeber steht in `useAutoAdvance.ts`.

/** Gesamtdauer bis zum automatischen Weiter (Gesamtkonzept R6: nie unter 4 s, damit das „Warum“ lesbar bleibt). */
export const AUTO_NEXT_MS = 4000;

export type AutoAdvanceInput = {
  verdict: ResultVerdict;
  /** Genutzte Hilfe (0 = keine). */
  hintLevel: number;
  depth: ExplainDepth;
  /** `app/profile.autoNext`; nur ein ausdrückliches `false` schaltet ab. */
  autoNextPref: boolean | null | undefined;
  menuOpen: boolean;
  foldOpen: boolean;
};

export function shouldAutoAdvance(i: AutoAdvanceInput): boolean {
  return i.verdict === 'ok' && i.hintLevel === 0 && i.depth === 'min' && i.autoNextPref !== false && !i.menuOpen && !i.foldOpen;
}
