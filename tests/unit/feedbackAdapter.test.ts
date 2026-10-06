import { describe, expect, it } from 'vitest';
import { feedbackFromFixes } from '../../src/ui/feedback/toShell';

describe('feedbackFromFixes', () => {
  it('bildet Urteile ab: close → near', () => {
    expect(feedbackFromFixes({ verdict: 'close', fixes: [] }).verdict).toBe('near');
    expect(feedbackFromFixes({ verdict: 'unchecked', fixes: [] }).verdict).toBe('unchecked');
  });
  it('kappt auf 3 Korrekturen und 2 Verbesserungen, ohne Inhalt keine Erklärung', () => {
    const fix = (i: number) => ({ kind: 'form' as const, mine: `a${i}`, right: `b${i}`, why: 'w' });
    const m = feedbackFromFixes({ verdict: 'wrong', effect: 'E', fixes: [1, 2, 3, 4].map(fix), upgrades: [{ to: 'x' }, { to: 'y' }, { to: 'z' }] });
    expect(m.explanation?.lines.filter((l) => l.k === 'mistake')).toHaveLength(3);
    expect(m.explanation?.lines.filter((l) => l.k === 'note')).toHaveLength(2);
    expect(feedbackFromFixes({ verdict: 'ok', fixes: [] }).explanation).toBeNull();
  });
});
