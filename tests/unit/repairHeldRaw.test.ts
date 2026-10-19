import { describe, expect, it } from 'vitest';
import { readRepairs } from '../../src/domain/repair/repair';
import { fitAltPatch, isFitAltPatch } from '../../src/domain/tutor/fitAlt';

// data-guard 20.10.2026: unbekanntes `held` nie still verlieren; `fitAlt` nur schreiben, wenn dort ein Objekt (oder nichts) steht.
const T = 1_790_000_000_000;
const PV = 'grammar-fit@2';

describe('readRepairs: held', () => {
  const base = { wrong: 'a b', right: 'c d', t: T };
  it('ein unbekanntes `held` bleibt roh stehen', () => {
    const [odd] = readRepairs({ items: [{ ...base, held: 'seltsam' }] });
    expect((odd as unknown as { held: unknown }).held).toBe('seltsam');
  });
  it('ein lesbares `held` wird bereinigt, fehlendes bleibt fehlend', () => {
    const [ok] = readRepairs({ items: [{ ...base, held: { r: 'grund', t: 5, extra: 1 } }] });
    expect(ok?.held).toEqual({ r: 'grund', t: 5 });
    expect('held' in (readRepairs({ items: [base] })[0] as object)).toBe(false);
  });
});

describe('fitAltPatch: Typprüfung vor dem Schreiben', () => {
  it('kein Objekt in `fitAlt` → nichts schreiben (bad_type)', () => {
    for (const bad of ['text', 7, ['x'], true]) expect(fitAltPatch({ fitAlt: bad }, 'k', 'had', 'ai', PV, T)).toBe('bad_type');
  });
  it('Objekt, null und fehlend schreiben wie bisher', () => {
    expect(isFitAltPatch(fitAltPatch({ fitAlt: {} }, 'k', 'had', 'ai', PV, T))).toBe(true);
    expect(isFitAltPatch(fitAltPatch({ fitAlt: null }, 'k', 'had', 'ai', PV, T))).toBe(true);
    expect(isFitAltPatch(fitAltPatch({}, 'k', 'had', 'ai', PV, T))).toBe(true);
  });
});
