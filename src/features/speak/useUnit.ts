import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import type { UnitBlockNo, UnitCtx } from '../../app/unit/types';
import { useWeek } from '../../app/useWeek';
import { unitCtxOf, type P5UnitKind } from './unit';

// Zusammenhang eines Einheits-Blocks in der Übung: gemerkt beim Start (`beginUnit`), sonst aus
// den Daten des Tages (Wochenthema, Wochenziele, die 5 Wendungen der Woche – Prüfbefund M8).
// Ohne `block` (freies Üben) gibt es keinen Zusammenhang, die Wochenziele gelten trotzdem.

export function useUnitCtx(kind: P5UnitKind, block: UnitBlockNo | null): UnitCtx | null {
  const day = useClock((s) => s.today);
  const week = useWeek();
  return useMemo(() => {
    if (!block) return null;
    return unitCtxOf(kind, day) ?? { day, block, theme: week.theme, targets: week.targets, minutes: 9, phrases: week.targets.phrases };
  }, [kind, block, day, week.theme, week.targets]);
}

/** Wendungen, die die Aufgabe benutzen soll: aus Block 2, sonst die der Woche. */
export function phrasesOf(ctx: UnitCtx | null, fallback: readonly string[]): readonly string[] {
  return ctx?.phrases?.length ? ctx.phrases : (ctx?.targets.phrases.length ? ctx.targets.phrases : fallback);
}
