import { describe, expect, it } from 'vitest';
import { lernen } from '../../src/areas/lernen';
import { useFocus } from '../../src/features/grammar/focus/session';
import { useAgain } from '../../src/features/repair/again/session';
import { useDrill } from '../../src/features/drills/session';
import { useGrammarSession } from '../../src/features/grammar/session';
import { EMPTY_TARGETS } from '../../src/domain/unit/types';
import type { UnitBlockProvider } from '../../src/app/unit/types';

// Anbieter der Blöcke focus/again (plan.md §4.10), Grammatik `grammar` (Block 2) und Satzbau `task.order` (Block 3, beide seit 04.10.2026):
// synchron, ohne KI machbar, Route der Übung.

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

describe('Block-Anbieter focus/grammar/task.order/again', () => {
  const blocks: readonly UnitBlockProvider[] = lernen.unitBlocks;
  const of = (kind: UnitBlockProvider['kind']): UnitBlockProvider => blocks.find((b) => b.kind === kind)!;
  it('alle vier sind angemeldet und immer machbar (focus bleibt für ältere gespeicherte Pläne)', () => {
    expect(blocks.map((b) => b.kind)).toEqual(['focus', 'grammar', 'task.order', 'again']);
    expect(blocks.every((b) => b.feasible({ ai: false, tts: false }))).toBe(true);
  });

  it('grammar startet die Grammatikrunde als Pflicht für Block 2, Rundengröße aus dem Plan', () => {
    const r = of('grammar').start({ ...ctx, block: 2, opts: { n: 6 } });
    expect(r).toEqual({ name: 'grammarSession', mode: 'duty' });
    const s = useGrammarSession.getState();
    expect(s.active).toBe(true);
    expect(s.mode).toBe('duty');
    expect(s.ctx).toBe('duty');
    expect(s.block).toBe(2);
    expect(s.tasks.length).toBeLessThanOrEqual(6);
  });

  it('task.order startet die Satzbau-Runde als Pflicht für Block 3', () => {
    const r = of('task.order').start({ ...ctx, block: 3 });
    expect(r).toEqual({ name: 'drill', kind: 'order', ctx: 'duty' });
    const s = useDrill.getState();
    expect(s.active).toBe(true);
    expect(s.kind).toBe('order');
    expect(s.ctx).toBe('duty');
    expect(s.block).toBe(3);
  });

  it('focus baut die Runde synchron aus ctx.task (Korrektur zuerst, Mini-Drill)', () => {
    const r = of('focus').start({ ...ctx, block: 4 });
    expect(r).toEqual({ name: 'unitFocus' });
    const s = useFocus.getState();
    expect(s.active && s.block).toBe(4);
    expect(s.tasks[0]?.kind).toBe('fix');
    expect(s.tasks.filter((t) => t.kind === 'trap' && t.drill)).toHaveLength(3);
  });

  it('again startet die Fehlerschlange Satz für Satz (Schritt 4, ohne Zusammenfügen)', () => {
    const r = of('again').start({ ...ctx, block: 5 });
    expect(r).toEqual({ name: 'unitAgain' });
    const s = useAgain.getState();
    expect(s.block).toBe(5);
    expect(s.active).toBe(true);
    expect(s.pos).toBe(0);
    expect(Array.isArray(s.cards)).toBe(true);
  });
});
