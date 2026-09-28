import { motion } from 'framer-motion';
import { z } from 'zod';
import { defineArea } from '../app/registry';
import type { InputRoute as InputRouteT } from '../app/nav';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { InputRoutes } from '../features/input/InputRoutes';
import { InputSections } from '../features/learn/LearnHub';
import { TabTitle } from '../features/system/Chrome';
import { useT } from '../i18n';

// Bereich „Lesen & Hören“ – Besitz: Paket P4 (docs/neubau/architektur.md §5.2).
// WP0a: Die Reiter-Wurzel `library` zeigt den bisherigen Abschnitt „Lesen, Hören, Schreiben“ und
// „Entdecken“ aus „Üben“; P4 baut daraus die Bibliothek.

declare module '../app/router/types' {
  interface RouteParams {
    library: NoParams;
    discover: NoParams;
    history: { kind: 'read' | 'listen' | 'write' | 'discover' };
    read: { ctx: UnitCtx };
    listen: { ctx: UnitCtx };
    write: { ctx: UnitCtx };
    discoverItem: { feedId: string; itemId: string; ctx: UnitCtx };
  }
}

const ctx = z.enum(['duty', 'extra']);

function LibraryRoot() {
  const { t } = useT();
  return (
    <>
      <motion.div className="flex flex-col gap-8 py-6 sm:py-10" data-testid="library">
        <TabTitle title={t('nbShTabRead')} />
        <InputSections />
      </motion.div>
      <HubSections places={placesOf('read')} />
    </>
  );
}

/** Phase-4-Bildschirme an einer Stelle (Route als Eigenschaft, wie bisher). */
function InputRoute({ route }: { route: InputRouteT }) {
  return <InputRoutes route={route} />;
}

export const lesen = defineArea({
  id: 'lesen',
  screens: {
    library: { kind: 'tab', component: LibraryRoot, title: 'nbShTabRead', keepScroll: true },
    discover: { kind: 'page', component: InputRoute, title: 'ch_discover', keepScroll: true },
    history: { kind: 'page', component: InputRoute, params: z.object({ kind: z.enum(['read', 'listen', 'write', 'discover']) }) },
    read: { kind: 'exercise', component: InputRoute, params: z.object({ ctx }) },
    listen: { kind: 'exercise', component: InputRoute, params: z.object({ ctx }) },
    write: { kind: 'exercise', component: InputRoute, params: z.object({ ctx }) },
    discoverItem: { kind: 'exercise', component: InputRoute, params: z.object({ feedId: z.string().min(1), itemId: z.string().min(1), ctx }) },
  },
});
