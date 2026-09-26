import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { describeError, logError, logInfo } from '../../platform/diagnostics';
import { markHandled, pendingLegacyLocal } from '../../platform/legacyLocal';
import { getWriter } from '../../data';
import { classifyLegacyPath, type RescueItem } from '../../domain/migration/rescue';
import { applyRescueItem } from '../../domain/migration/applyRescue';

// Nachtragen in WEITEREN Browsern (CLAUDE.md A6.12): Die Umstellung liest nur die Kopien des
// Browsers, in dem sie läuft. Öffnet Emrah die App danach auf einem anderen Gerät, auf dem
// die alte App noch nicht übertragene Änderungen hinterlassen hat, werden sie hier gezeigt und
// nach Bestätigung ergänzt – mit denselben Regeln (nur ergänzen, nie Neueres überschreiben).

type Phase =
  | { phase: 'idle' | 'checking' | 'none' | 'done' }
  | { phase: 'pending'; items: RescueItem[]; handled: Record<string, number> }
  | { phase: 'running'; items: RescueItem[]; handled: Record<string, number>; done: number }
  | { phase: 'failed'; items: RescueItem[]; handled: Record<string, number>; message: string };

type State = Phase & { check: () => Promise<void>; run: () => Promise<void> };

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
    try {
      const items: RescueItem[] = [];
      const skipped: Record<string, number> = {};
      for (const path of paths) {
        const markedAt = pending.dirty[path] ?? 0;
        let remote: Record<string, unknown> | undefined;
        try {
          const snap = await db.doc(path).get();
          remote = snap.exists ? snap.data() : undefined;
        } catch (err) {
          // Ungültiger Pfad (TypeError) oder Lesefehler: diesen Eintrag auslassen, nicht still.
          logError('rescue:read', err, path);
          continue;
        }
        const c = classifyLegacyPath(path, markedAt, pending.docs[path], remote);
        if ('skip' in c) skipped[path] = markedAt;
        else items.push(c.item);
      }
      if (!items.length) {
        markHandled(skipped);
        set({ phase: 'none' });
        return;
      }
      set({ phase: 'pending', items, handled: skipped });
    } catch (err) {
      logError('rescue:check', err);
      set({ phase: 'none' });
    }
  },
  run: async () => {
    const s = get();
    if (s.phase !== 'pending' && s.phase !== 'failed') return;
    const writer = getWriter();
    if (!writer) return;
    const { items, handled } = s;
    set({ phase: 'running', items, handled, done: 0 });
    const done: Record<string, number> = { ...handled };
    try {
      for (const [i, item] of items.entries()) {
        await applyRescueItem(item, writer);
        done[item.path] = item.markedAt;
        set({ phase: 'running', items, handled, done: i + 1 });
      }
      markHandled(done);
      logInfo('rescue:done', `${items.length} Kopien aus diesem Browser ergänzt`);
      set({ phase: 'done' });
    } catch (err) {
      markHandled(done);
      logError('rescue:apply', err);
      set({ phase: 'failed', items: items.filter((it) => !Object.hasOwn(done, it.path)), handled, message: describeError(err).code ?? describeError(err).message });
    }
  },
}));
