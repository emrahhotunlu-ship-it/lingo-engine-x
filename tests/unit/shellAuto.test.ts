import { describe, expect, it } from 'vitest';
import { AUTO_NEXT_MS, shouldAutoAdvance, type AutoAdvanceInput } from '../../src/ui/exercise/autoAdvance';

const base: AutoAdvanceInput = { verdict: 'ok', hintLevel: 0, depth: 'min', autoNextPref: true, menuOpen: false, foldOpen: false };

describe('shouldAutoAdvance', () => {
  it('geht nur bei Urteil ok, Hilfe 0 und Tiefe min automatisch weiter', () => {
    expect(shouldAutoAdvance(base)).toBe(true);
  });
  it('Zeitgeber dauert 4 Sekunden', () => {
    expect(AUTO_NEXT_MS).toBe(4000);
  });
  it.each(['near', 'wrong', 'dontKnow', 'unchecked'] as const)('nie bei Urteil %s', (verdict) => {
    expect(shouldAutoAdvance({ ...base, verdict })).toBe(false);
  });
  it('nie mit Hilfe', () => {
    expect(shouldAutoAdvance({ ...base, hintLevel: 1 })).toBe(false);
    expect(shouldAutoAdvance({ ...base, hintLevel: 2 })).toBe(false);
  });
  it.each(['full', 'short'] as const)('nie bei Tiefe %s', (depth) => {
    expect(shouldAutoAdvance({ ...base, depth })).toBe(false);
  });
  it('Einstellung: nur ein ausdrückliches false schaltet ab', () => {
    expect(shouldAutoAdvance({ ...base, autoNextPref: false })).toBe(false);
    expect(shouldAutoAdvance({ ...base, autoNextPref: undefined })).toBe(true);
    expect(shouldAutoAdvance({ ...base, autoNextPref: null })).toBe(true);
  });
  it('pausiert bei offenem Menü oder Aufklappbereich', () => {
    expect(shouldAutoAdvance({ ...base, menuOpen: true })).toBe(false);
    expect(shouldAutoAdvance({ ...base, foldOpen: true })).toBe(false);
  });
});
