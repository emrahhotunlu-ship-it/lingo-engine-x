import type { DutyId, DutyState, StoredPlan } from '../plan/types';
import type { UnitBlockKind } from '../week/types';

// Blockliste der Tageskarte (plan.md §1.3): EINE Ableitung aus Plan und Tagesstand (`deriveToday`).
// Ring, Zähler, Häkchen, Abzeichen und Knopf lesen dieselben Zeilen (Kap. 2.2).

export type BlockState = 'done' | 'now' | 'open';

export type UnitRow = {
  /** Pflichtpunkt (`review`, `ch:u-*`) – zugleich `data-duty`. */
  id: DutyId;
  block: 1 | 2 | 3 | 4 | 5;
  kind: UnitBlockKind;
  min: number;
  state: BlockState;
  progress: DutyState['progress'];
};

/** Zeilen der Einheit; `now` = erster offener Block. Ohne `u` (Plan von Phase 1/2): `null`. */
export function unitRows(plan: StoredPlan | null, items: readonly DutyState[]): UnitRow[] | null {
  if (!plan?.u) return null;
  const byId = new Map(items.map((d) => [d.id, d]));
  let nowSet = false;
  return plan.duty.map((id, k): UnitRow => {
    const meta = plan.u?.b[k];
    const it = byId.get(id);
    const done = it?.state === 'done';
    const state: BlockState = done ? 'done' : nowSet ? 'open' : 'now';
    if (!done) nowSet = true;
    return { id, block: meta?.[0] ?? 1, kind: (meta?.[1] ?? 'review') as UnitBlockKind, min: meta?.[2] ?? 0, state, progress: it?.progress ?? null };
  });
}

/** Restminuten der offenen Blöcke (Wiederholen anteilig nach Fortschritt). */
export function minutesLeft(rows: readonly UnitRow[]): number {
  let m = 0;
  for (const r of rows) {
    if (r.state === 'done') continue;
    if (r.id === 'review' && r.progress && r.progress.total > 0) m += r.min * Math.max(0, 1 - r.progress.done / r.progress.total);
    else m += r.min;
  }
  return Math.max(0, Math.ceil(m));
}

/** Block-Name je Art (Schlüssel-Endung der Texte `nbHeuteBlock_*`). */
export function blockNameKey(kind: UnitBlockKind, block: number): string {
  if (block === 1 || kind === 'review') return 'review';
  if (kind === 'task.check') return 'check';
  if (kind === 'task.order') return 'order';
  if (kind === 'grammar' || (kind === 'focus' && block === 2)) return 'grammar';
  if (block === 2) return 'input';
  if (block === 3) return 'task';
  if (block === 4) return 'focus';
  return 'again';
}
