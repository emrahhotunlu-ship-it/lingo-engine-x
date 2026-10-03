import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useClock } from '../../app/clock';
import { themeFor, weekTargets, type ThemePick } from '../../domain/week';
import type { WeekDoc, WeekTargets } from '../../domain/week/types';
import { useWeekDoc, weekDocOf } from './store';

// Wochenthema und Wochenziele für P1-Bildschirme aus dem EINEN Abo (`features/week/store.ts`).

export type WeekView = { day: string; week: WeekDoc; pick: ThemePick; targets: WeekTargets; ok: boolean; saving: boolean; failed: boolean };

export function useWeekState(): WeekView {
  const day = useClock((s) => s.today);
  const src = useWeekDoc(useShallow((s) => ({ raw: s.raw, ok: s.ok, chosen: s.chosen, saving: s.saving, failed: s.failed })));
  return useMemo(() => {
    const week = weekDocOf(src);
    const pick = themeFor(day, week);
    return { day, week, pick, targets: weekTargets(pick.theme, { day, week }), ok: src.ok, saving: src.saving, failed: src.failed };
  }, [day, src]);
}
