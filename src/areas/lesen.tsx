import { z } from 'zod';
import { defineArea } from '../app/registry';
import type { InputRoute as InputRouteT } from '../app/nav';
import { InputBlockScreen } from '../features/input/block/InputBlockScreen';
import { installUnitPrefetch } from '../features/input/block/prefetch';
import { INPUT_BLOCKS } from '../features/input/block/run';
import { InputRoutes } from '../features/input/InputRoutes';
import { INPUT_RESUMABLES } from '../features/input/resume';
import { DialogScreen } from '../features/listen/DialogUnit';
import { LibraryScreen } from '../features/read/LibraryScreen';

// Bereich „Lesen & Hören“ – Besitz: Paket P4 (docs/neubau/plan.md §1.3, §4.5).
// Reiter-Wurzel `library` (Bibliothek im LingQ-Stil), Leser, Hören mit Tempo-Leiter, Entdecken,
// Verlauf; die Schreibaufgabe hängt als Einstieg am Platz `write` (Reiter Sprechen). Block 2 der
// Tageseinheit kommt als Anbieter `input.read` / `input.listen` (Übung `inputUnit`).

declare module '../app/router/types' {
  interface RouteParams {
    library: NoParams;
    discover: NoParams;
    history: { kind: 'read' | 'listen' | 'write' | 'discover' };
    read: { ctx: UnitCtx; id?: string; mode?: 'own' | 'gen' };
    listen: { ctx: UnitCtx; id?: string; mode?: 'gen' };
    write: { ctx: UnitCtx };
    discoverItem: { feedId: string; itemId: string; ctx: UnitCtx };
    inputUnit: { day: string; kind: 'read' | 'listen'; ref: string; summary?: boolean };
    /** Meeting hören mit 2–3 Stimmen → Stichworte → Follow-up-Mail (Backlog B6). */
    listenDialog: { ctx: UnitCtx };
  }
}

const ctx = z.enum(['duty', 'extra']);

/** Phase-4-Bildschirme an einer Stelle (Route als Eigenschaft, wie bisher). */
function InputRoute({ route }: { route: InputRouteT }) {
  return <InputRoutes route={route} />;
}

export const lesen = defineArea({
  id: 'lesen',
  screens: {
    // Seit 04.10.2026 kein Reiter mehr (Fokus Vokabeln und Grammatik): nur noch als Seite erreichbar.
    library: { kind: 'page', component: LibraryScreen, title: 'nbShTabRead', keepScroll: true, chrome: 'shell' },
    discover: { kind: 'page', component: InputRoute, title: 'ch_discover', keepScroll: true },
    history: { kind: 'page', component: InputRoute, params: z.object({ kind: z.enum(['read', 'listen', 'write', 'discover']) }) },
    read: { kind: 'exercise', component: InputRoute, params: z.object({ ctx, id: z.string().min(1).optional(), mode: z.enum(['own', 'gen']).optional() }) },
    listen: { kind: 'exercise', component: InputRoute, params: z.object({ ctx, id: z.string().min(1).optional(), mode: z.enum(['gen']).optional() }) },
    write: { kind: 'exercise', component: InputRoute, params: z.object({ ctx }) },
    discoverItem: { kind: 'exercise', component: InputRoute, params: z.object({ feedId: z.string().min(1), itemId: z.string().min(1), ctx }) },
    inputUnit: {
      kind: 'exercise',
      component: InputBlockScreen,
      params: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(['read', 'listen']), ref: z.string().min(3), summary: z.boolean().optional() }),
    },
    listenDialog: { kind: 'exercise', component: DialogScreen, params: z.object({ ctx }) },
  },
  entries: [
    { id: 'hub-write', place: 'write', group: 'write', order: 50, label: 'nbLesenWriteTask', sub: 'nbLesenWriteTaskSub', icon: 'grammar', route: { name: 'write', ctx: 'extra' } },
    { id: 'hub-write-history', place: 'write', group: 'write', order: 90, label: 'nbLesenWriteHistory', sub: 'nbLesenWriteHistorySub', icon: 'history', route: { name: 'history', kind: 'write' } },
  ],
  resumables: INPUT_RESUMABLES,
  unitBlocks: INPUT_BLOCKS,
  boot: installUnitPrefetch,
});
