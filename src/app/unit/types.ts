import type { UnitBlockKind, UnitBlockOpts, UnitEnv, WeekTargets, WeekTheme } from '../../domain/unit/types';
import type { Fix } from '../../ui/feedback/types';
import type { Route } from '../router/types';

// Vertrag der Tageseinheit (docs/neubau/plan.md §1.5, §4.10, WP0a). Jede Übung, die ein Block der
// Einheit sein kann, meldet sich als `UnitBlockProvider` im Register an (`defineArea({ unitBlocks })`).
// P1 setzt die Kette zusammen und zählt den Abschluss (`unitDone`).

// Die Typen der Einheit kommen aus der Domäne (`src/domain/unit/types.ts`), nie doppelt.
export type { UnitBlockKind, UnitEnv, UnitPlan, WeekTargets, WeekTheme } from '../../domain/unit/types';

export type UnitBlockNo = 1 | 2 | 3 | 4 | 5;

/** Ergebnis eines Aufgaben-Blocks (Block 3) für Fokus (4) und „Nochmal, aber besser“ (5). */
export type UnitTaskResult = {
  kind: UnitBlockKind;
  /** Monatsdokument + Eintrag, z. B. `say/2026-09#k17`. */
  ref: string;
  text: string;
  better?: string;
  fixes: Fix[];
};

/** Was ein Block beim Start bekommt. */
export type UnitCtx = {
  day: string;
  block: UnitBlockNo;
  theme: WeekTheme | null;
  targets: WeekTargets;
  minutes: number;
  /** Von `input.*` für `pron.shadow`. */
  sentences?: string[];
  /**
   * Von `input.*` an `task.*` (Prüfbefund M8, pruefung-tageseinheit.md): die Wendungen, die die
   * Aufgabe benutzen soll. Ersatz aus Daten (Karten mit `src` read/listen von heute, sonst die
   * 5 Wendungen der Woche) befüllt P1.
   */
  phrases?: string[];
  /** Von `task.*` für `focus`/`again`. */
  task?: UnitTaskResult;
  /** Einstellungen des Blocks aus dem Plan (z. B. `n` im Grammatik-Block). */
  opts?: UnitBlockOpts;
};

export type UnitBlockProvider = {
  kind: UnitBlockKind;
  /** Rückfälle entscheidet P1 beim Blockstart mit `resolveBlock(block, env)` (domain/unit, M5). */
  feasible(env: UnitEnv): boolean;
  /** SYNCHRON im Klick (iPhone-Tastatur): Sitzung bauen und Ziel liefern; `false` = nicht startbar. */
  start(ctx: UnitCtx): Route | false;
};

/**
 * Abschluss eines Blocks: Die Übung ruft `unitDone(ctx.block, result?)`; P1 zählt `act['u-…']`
 * über `recordProfileFields` und führt zur Zwischenkarte.
 */
export type UnitDone = (block: UnitBlockNo, result?: UnitTaskResult) => void;
