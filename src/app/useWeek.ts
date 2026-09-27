import { useMemo } from 'react';
import { useDocWatch } from '../data/watch';
import { EMPTY_TARGETS, type UnitPlan, type WeekTargets, type WeekTheme } from './unit/week';

// Wochenthema, Wochenziele und Tagesplan der Einheit (docs/neubau/plan.md §1.5, §4.10).
// WP0a-Stub mit endgültiger Signatur: liest `app/week` (ein Abo je Nutzer, nur solange sichtbar) und
// liefert die Wochenziele. Thema und Plan kommen, sobald P7a `src/domain/week` liefert (Integrator
// ergänzt `themeFor`/`unitPlanFor`); bis dahin `null` – die Pakete müssen damit umgehen (G6).

export type WeekState = { theme: WeekTheme | null; targets: WeekTargets; plan: UnitPlan | null };

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);

/** Reine Ableitung aus `app/week` (getestet). */
export function weekFromDoc(doc: Record<string, unknown> | null): WeekState {
  const tg = doc && typeof doc.targets === 'object' && doc.targets ? (doc.targets as Record<string, unknown>) : null;
  const targets: WeekTargets = tg
    ? { traps: strings(tg.traps).slice(0, 3), tool: typeof tg.tool === 'string' ? tg.tool : null, ...(typeof tg.preply === 'string' ? { preply: tg.preply } : {}) }
    : EMPTY_TARGETS;
  return { theme: null, targets, plan: null };
}

export function useWeek(): WeekState {
  const w = useDocWatch('app/week');
  return useMemo(() => weekFromDoc(w.data), [w.data]);
}
