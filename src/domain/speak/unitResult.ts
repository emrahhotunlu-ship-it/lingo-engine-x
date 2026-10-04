import type { UnitBlockKind, UnitTaskResult } from '../../app/unit/types';
import type { Fix } from '../../ui/feedback/types';
import { matchTrap } from '../patterns/traps';

// Ergebnis eines Aufgaben-Blocks (Block 3) für Fokus (Block 4) und „Nochmal, aber besser“
// (Block 5) – aus den vorhandenen Rückmeldungen von Sag es, 90/60/45, Tonlagen und Rollenspiel
// abgebildet (Neubau N75; keine Vorlage geändert). Rein und getestet.

export type Correction = { wrong: string; right: string; why: string };

export const RESULT_TEXT_MAX = 2000;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/**
 * Korrekturen als `Fix`: Ist der falsche Teil eine bekannte Deutsch-Falle (lokal über den
 * Fallen-Startsatz erkannt), wird er `trap` mit `trapId` – Block 4 zeigt dann den Mini-Drill.
 * Doppelte Korrekturen fallen weg. Keine Kürzung auf 3: das macht der Empfänger (FeedbackPanel).
 */
export function fixesOf(corrections: readonly Correction[]): Fix[] {
  const out: Fix[] = [];
  const seen = new Set<string>();
  for (const c of corrections) {
    const mine = c.wrong.trim();
    const right = c.right.trim();
    if (!right || seen.has(`${mine}\u0000${right}`)) continue;
    seen.add(`${mine}\u0000${right}`);
    const trap = mine ? matchTrap(mine) : null;
    out.push(trap ? { kind: 'trap', mine, right, why: c.why.trim(), trapId: trap.id } : { kind: 'form', mine, right, why: c.why.trim() });
  }
  return out;
}

export function unitResult(kind: UnitBlockKind, ref: string, text: string, corrections: readonly Correction[], better?: string | null): UnitTaskResult {
  const b = better?.trim();
  return { kind, ref, text: cut(text.trim(), RESULT_TEXT_MAX), ...(b ? { better: cut(b, RESULT_TEXT_MAX) } : {}), fixes: fixesOf(corrections) };
}
