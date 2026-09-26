import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { describeError, logError, logInfo } from '../../platform/diagnostics';
import { markHandled, readLegacyLocal } from '../../platform/legacyLocal';
import type { MigrationPlan as Plan } from '../../domain/migration/v1';
import { loadSnapshot, type DataSnapshot } from '../../data/snapshot';
import { getWriter } from '../../data';
import { applyMigrationV1, planMigrationV1, type MigrationPlan } from '../../domain/migration/v1';

// Ablauf der Umstellung: lesen → Trockenlauf zeigen → (Bestätigung) → ausführen.

type Phase =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'readFailed'; message: string }
  | { phase: 'review'; plan: MigrationPlan; snapshot: DataSnapshot }
  | { phase: 'running'; plan: MigrationPlan; snapshot: DataSnapshot; done: number; total: number }
  | { phase: 'busy'; plan: MigrationPlan; snapshot: DataSnapshot }
  | { phase: 'failed'; plan: MigrationPlan; snapshot: DataSnapshot; message: string }
  | { phase: 'done' };

type MigrationState = Phase & { dryRun: () => Promise<void>; run: () => Promise<void> };

/**
 * Nach erfolgreicher Umstellung als behandelt merken: nur, was der Plan vollständig erledigt hat
 * (ergänzt ohne Rest, oder unverändert). Alles andere bleibt offen und wird auf „Dein Stand"
 * mit Grund gezeigt, bis Emrah es zur Kenntnis nimmt (lateRescue.ts).
 */
function handledByPlan(plan: Plan): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of plan.rescue) if (!r.rest) out[r.path] = r.markedAt;
  for (const s of plan.rescueSkipped) if (s.reason === 'unchanged') out[s.path] = s.markedAt;
  return out;
}

const holder = `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

export const useMigration = create<MigrationState>((set, get) => ({
  phase: 'idle',
  dryRun: async () => {
    const db = getDb();
    if (!db) return;
    set({ phase: 'reading' });
    try {
      const snapshot = await loadSnapshot(db);
      const plan = planMigrationV1({ snapshot, local: readLegacyLocal(), nowMs: Date.now() });
      set({ phase: 'review', plan, snapshot });
    } catch (err) {
      logError('migration:read', err);
      set({ phase: 'readFailed', message: describeError(err).message });
    }
  },
  run: async () => {
    const s = get();
    if (s.phase !== 'review' && s.phase !== 'failed' && s.phase !== 'busy') return;
    const db = getDb();
    const writer = getWriter();
    if (!db || !writer) return;
    const { plan, snapshot } = s;
    set({ phase: 'running', plan, snapshot, done: 0, total: plan.writes });
    const res = await applyMigrationV1(plan, {
      db,
      writer,
      holder,
      nowMs: () => Date.now(),
      onProgress: (done, total) => set({ phase: 'running', plan, snapshot, done, total }),
    });
    if (res.status === 'done') markHandled(handledByPlan(plan));
    if (res.status === 'done' || res.status === 'already') {
      logInfo('migration:done', `Datenversion ${plan.version}`, `${res.written} Schreibschritte`);
      set({ phase: 'done' });
    } else if (res.status === 'busy') {
      set({ phase: 'busy', plan, snapshot });
    } else {
      logError('migration:apply', { code: res.code, message: res.message }, `${res.written} von ${plan.writes}`);
      set({ phase: 'failed', plan, snapshot, message: res.code });
    }
  },
}));
