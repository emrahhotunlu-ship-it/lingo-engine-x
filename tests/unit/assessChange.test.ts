import { describe, expect, it } from 'vitest';
import { assessChange } from '../../src/domain/assessment/change';
import { readAssess } from '../../src/domain/assessment/envelope';

// Entscheidung 1B (04.11.2026): Hinweis „Claude hat dich am … neu eingeschätzt“ aus dem Verlauf `hist`.
const doc = (d: string, vo: string, gr: string, hist: unknown[]) => ({
  d,
  t: 1,
  lang: 'de',
  data: { cefr: 'B2', dims: [{ id: 'vocabulary', level: vo, confidence: 'fair' }, { id: 'grammar', level: gr, confidence: 'fair' }] },
  hist,
});

describe('assessChange', () => {
  const hist = [
    { d: '2026-10-28', cefr: 'B2', dims: { vocabulary: 'B2+', grammar: 'B2' } },
    { d: '2026-11-04', cefr: 'B2', dims: { vocabulary: 'B2', grammar: 'B2' } },
  ];
  it('nennt die geänderte Stufe mit vorher und jetzt', () => {
    const c = assessChange(readAssess(doc('2026-11-04', 'B2', 'B2', hist)), '2026-11-04');
    expect(c).toEqual({ d: '2026-11-04', changes: [{ id: 'vocabulary', before: 'B2+', now: 'B2' }] });
  });
  it('gilt bis drei Tage danach, dann nicht mehr', () => {
    expect(assessChange(readAssess(doc('2026-11-04', 'B2', 'B2', hist)), '2026-11-07')).not.toBeNull();
    expect(assessChange(readAssess(doc('2026-11-04', 'B2', 'B2', hist)), '2026-11-08')).toBeNull();
  });
  it('ohne Änderung, ohne vorigen Tag oder ohne Einschätzung: kein Hinweis', () => {
    expect(assessChange(readAssess(doc('2026-11-04', 'B2+', 'B2', hist)), '2026-11-04')).toBeNull();
    expect(assessChange(readAssess(doc('2026-11-04', 'B2', 'B2', [hist[1]])), '2026-11-04')).toBeNull();
    expect(assessChange(null, '2026-11-04')).toBeNull();
  });
  it('vergleicht mit dem letzten Tag VOR der Einschätzung, auch wenn der Verlauf ungeordnet ist', () => {
    const h = [hist[1], { d: '2026-10-20', cefr: 'B1+', dims: { vocabulary: 'B1+', grammar: 'B1+' } }, hist[0]];
    const c = assessChange(readAssess(doc('2026-11-04', 'B2', 'C1', h)), '2026-11-05');
    expect(c?.changes).toEqual([
      { id: 'grammar', before: 'B2', now: 'C1' },
      { id: 'vocabulary', before: 'B2+', now: 'B2' },
    ]);
  });
});
