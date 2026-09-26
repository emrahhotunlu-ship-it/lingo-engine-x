import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { describeError, logError, logInfo } from '../../platform/diagnostics';
import { markHandled, readLegacyLocal } from '../../platform/legacyLocal';
import { loadSnapshot, type DataSnapshot } from '../../data/snapshot';
import { getWriter } from '../../data';
import { applyMigrationV1, handledAfterMigration, planMigrationV1, type MigrationPlan } from '../../domain/migration/v1';

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
    if (res.status === 'done') markHandled(handledAfterMigration(plan, res.rescued));
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
