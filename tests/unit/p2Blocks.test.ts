import { describe, expect, it } from 'vitest';
import { lernen } from '../../src/areas/lernen';
import { useFocus } from '../../src/features/grammar/focus/session';
import { useAgain } from '../../src/features/repair/again/session';
import { EMPTY_TARGETS } from '../../src/domain/week';

// Anbieter der Blöcke 4 und 5 (plan.md §4.10): synchron, ohne KI machbar, Route der Übung.

const ctx = {
  day: '2026-09-20',
  theme: null,
  targets: EMPTY_TARGETS,
  minutes: 4,
  task: {
    kind: 'task.say' as const,
    ref: 'say/2026-09#k1',
    text: 'Please send me the actual version.',
    better: 'Please send me the current version.',
    fixes: [{ kind: 'trap' as const, mine: 'Please send me the actual version.', right: 'Please send me the current version.', why: 'actual = tatsächlich', trapId: 'f01' }],
  },
};

describe('Block-Anbieter focus/again', () => {
  const blocks = lernen.unitBlocks;
  it('beide sind angemeldet und immer machbar', () => {
    expect(blocks.map((b) => b.kind)).toEqual(['focus', 'again']);
    expect(blocks.every((b) => b.feasible({ ai: false, tts: false }))).toBe(true);
  });

  it('focus baut die Runde synchron aus ctx.task (Korrektur zuerst, Mini-Drill)', () => {
    const r = blocks[0]!.start({ ...ctx, block: 4 });
    expect(r).toEqual({ name: 'unitFocus' });
    const s = useFocus.getState();
    expect(s.active && s.block).toBe(4);
    expect(s.tasks[0]?.kind).toBe('fix');
    expect(s.tasks.filter((t) => t.kind === 'trap' && t.drill)).toHaveLength(3);
  });

  it('again nimmt die bessere Fassung aus Block 3', () => {
    const r = blocks[1]!.start({ ...ctx, block: 5 });
    expect(r).toEqual({ name: 'unitAgain' });
    const s = useAgain.getState();
    expect(s.block).toBe(5);
    expect(s.src.better).toBe('Please send me the current version.');
    expect(s.src.fixes).toHaveLength(1);
  });
});
