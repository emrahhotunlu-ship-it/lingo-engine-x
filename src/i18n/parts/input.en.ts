import type { InputMessageKey } from './input.de';

// Oberflächentexte von Phase 4 (Lesen, Hören, Schreiben, Entdecken), Englisch (US-Schreibweise).

export const inputEn: Record<InputMessageKey, string> = {
  // ---------------------------------------------------------------- common
  agoNever: 'not practiced yet',
  agoDaysN_one: 'last done yesterday',
  agoDaysN_other: 'last done {n} days ago',
  // ---------------------------------------------------------------- reading
  // ---------------------------------------------------------------- listening
  // ---------------------------------------------------------------- writing
  // ---------------------------------------------------------------- discover
};
