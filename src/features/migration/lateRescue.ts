import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { describeError, logError, logInfo, logWarn } from '../../platform/diagnostics';
import { markHandled, pendingLegacyLocal } from '../../platform/legacyLocal';
import { getWriter } from '../../data';
import { classifyLegacyPath, type RescueItem, type RescueSkipReason } from '../../domain/migration/rescue';
import { applyRescueItem } from '../../domain/migration/applyRescue';

// Nachtragen in WEITEREN Browsern (CLAUDE.md A6.12): Die Umstellung liest nur die Kopien des
// Browsers, in dem sie läuft. Hat ein anderer Browser noch nicht übertragene Kopien der alten
// App, zeigt „Dein Stand" sie hier:
// - `items`: werden nach Bestätigung ergänzt (dieselben sicheren Regeln wie bei der Umstellung);
// - `notes`: werden NICHT automatisch übernommen – mit Grund gezeigt und protokolliert; sie
//   bleiben in diesem Browser und in der Sicherung. Erst „Zur Kenntnis genommen" markiert sie.
// Nichts wird still als erledigt markiert (Kap. 9, Regel 6).

export type RescueNote = { path: string; markedAt: number; reason: Exclude<RescueSkipReason, 'unchanged'> | 'partial' };

type Phase =
  | { phase: 'idle' | 'checking' | 'none' }
  | { phase: 'pending' | 'running' | 'failed'; items: RescueItem[]; notes: RescueNote[]; message?: string };

type State = Phase & { check: () => Promise<void>; run: () => Promise<void>; acknowledge: () => void };

function settle(items: RescueItem[], notes: RescueNote[]): Phase {
  return items.length || notes.length ? { phase: 'pending', items, notes } : { phase: 'none' };
}

export const useLateRescue = create<State>((set, get) => ({
  phase: 'idle',
  check: async () => {
    const db = getDb();
    if (!db || get().phase !== 'idle') return;
    const pending = pendingLegacyLocal();
    const paths = Object.keys(pending.dirty).sort();
    if (!paths.length) {
      set({ phase: 'none' });
      return;
    }
    set({ phase: 'checking' });
    const items: RescueItem[] = [];
    const notes: RescueNote[] = [];
    const unchanged: Record<string, number> = {};
    for (const path of paths) {
      const markedAt = pending.dirty[path] ?? 0;
      let remote: Record<string, unknown> | undefined;
      try {
        const snap = await db.doc(path).get();
        remote = snap.exists ? snap.data() : undefined;
      } catch (err) {
        // Ungültiger Pfad (TypeError) oder Lesefehler: melden, nicht markieren.
        logWarn('rescue:read', err, path);
        notes.push({ path, markedAt, reason: 'unknown_path' });
        continue;
      }
      const c = classifyLegacyPath(path, markedAt, pending.docs[path], remote);
      if ('item' in c) items.push(c.item);
      else if (c.skip === 'unchanged') unchanged[path] = markedAt;
      else {
        notes.push({ path, markedAt, reason: c.skip });
        logWarn('rescue:not-merged', { code: c.skip, message: 'nicht automatisch übernommen' }, path);
      }
    }
    markHandled(unchanged);
    set(settle(items, notes));
  },
  run: async () => {
    const s = get();
    if ((s.phase !== 'pending' && s.phase !== 'failed') || !s.items.length) return;
    const writer = getWriter();
    if (!writer) return;
    let items = s.items;
    const notes = [...s.notes];
    set({ phase: 'running', items, notes });
    try {
      for (const item of s.items) {
        await applyRescueItem(item, writer);
        items = items.filter((i) => i !== item);
        if (item.rest) notes.push({ path: item.path, markedAt: item.markedAt, reason: 'partial' });
        else markHandled({ [item.path]: item.markedAt });
        set({ phase: 'running', items, notes });
      }
      logInfo('rescue:done', `${s.items.length} Kopien aus diesem Browser ergänzt`);
      set(settle([], notes));
    } catch (err) {
      logError('rescue:apply', err);
      const d = describeError(err);
      set({ phase: 'failed', items, notes, message: d.code ?? d.message });
    }
  },
  acknowledge: () => {
    const s = get();
    if (s.phase !== 'pending' || !s.notes.length) return;
    markHandled(Object.fromEntries(s.notes.map((n) => [n.path, n.markedAt])));
    logInfo('rescue:acknowledged', `${s.notes.length} nicht übernommene Kopien zur Kenntnis genommen`);
    set(settle(s.items, []));
  },
}));
