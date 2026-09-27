import { useMemo } from 'react';
import { useLive } from '../data/live';
import { useDocWatch } from '../data/watch';
import { readWeekDoc, themeFor, unitPlanFor, weekTargets } from '../domain/week';
import type { UnitPlan, WeekTargets, WeekTheme } from '../domain/week/types';
import { useClock } from './clock';

// Wochenthema, Wochenziele und Tagesplan der Einheit (docs/neubau/plan.md §1.5, §4.10).
// Liest `app/week` (ein Abo je Nutzer, nur solange sichtbar; tolerant über `readWeekDoc`) und
// rechnet mit `domain/week` (P7a). Der Plan hängt nie von `env` ab (Prüfbefund M5): Rückfälle ohne
// KI/Sprachausgabe entscheidet P1 beim Blockstart mit `resolveBlock(block, env)`. P1 friert den
// Plan je Lerntag ein (`lx:plan:<tag>`) und ergänzt die übrigen `UnitPrefs`.

export type WeekState = { theme: WeekTheme | null; targets: WeekTargets; plan: UnitPlan | null };

/** Reine Ableitung für einen Lerntag (getestet). */
export function weekFor(day: string, raw: unknown, prefs: { goalMin?: number } = {}): WeekState {
  const week = readWeekDoc(raw);
  const pick = themeFor(day, week);
  return {
    theme: pick.theme,
    targets: weekTargets(pick.theme, { day, week }),
    plan: unitPlanFor(day, week, typeof prefs.goalMin === 'number' ? { goalMin: prefs.goalMin } : {}),
  };
}

export function useWeek(): WeekState {
  const w = useDocWatch('app/week');
  const day = useClock((s) => s.today);
  const goalMin = useLive((s) => s.docs['app/profile']?.goalMin);
  return useMemo(() => weekFor(day, w.data, { goalMin: typeof goalMin === 'number' ? goalMin : undefined }), [day, w.data, goalMin]);
}
