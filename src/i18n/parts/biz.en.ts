import type { bizDe } from './biz.de';

// Oberflächentexte Business-Suite (Phase 3), Englisch – amerikanische Schreibweise.

export const bizEn: Record<keyof typeof bizDe, string> = {
  regFormal: 'formal',
  regNeutral: 'neutral',
  regInformal: 'casual',

  drillStart: 'Quick drill',
};
