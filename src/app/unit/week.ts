import type { UnitBlockKind } from './types';

// Platzhalter-Typen für das Wochenthema (docs/neubau/plan.md §1.5, §4.10), bis P7a
// `src/domain/week/*` liefert. Der Integrator ersetzt diese Datei dann durch Re-Exporte aus
// `domain/week` (gleiche Namen). Pakete importieren die Typen NUR von hier bzw. aus `app/unit/types`.

/** Eines der 16 Wochenthemen (`t01`…`t16`, `content/nb/themes.ts`). */
export type WeekTheme = {
  id: string;
  title: { de: string; en: string };
  /** Kernaufgabe der Woche. */
  task?: { de: string; en: string };
  /** Werkzeug der Woche (Grammatik-ID). */
  tool?: string;
  /** Falle der Woche (Startsatz-ID). */
  trap?: string;
  /** Wendungen der Woche. */
  phrases?: Array<{ en: string; de: string }>;
};

/** Wochenziele (≤ 5: 3 Fallen, 1 Werkzeug, 1 Preply-Ziel). */
export type WeekTargets = { traps: string[]; tool: string | null; preply?: string };

/** Tagesplan der Einheit (reine Funktion `unitPlanFor` in `domain/week`). */
export type UnitPlan = {
  day: string;
  blocks: Array<{ block: 1 | 2 | 3 | 4 | 5; kind: UnitBlockKind; minutes: number }>;
  /** Pflicht-Kennungen (`review`, `ch:u-in`, `ch:u-task` …), plan.md §1.5. */
  duty: string[];
};

export const EMPTY_TARGETS: WeekTargets = { traps: [], tool: null };
