import { z } from 'zod';
import { defineArea } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { installCompanionHotkeys } from '../features/companion/hotkeys';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { VtestScreen } from '../features/vtest/VtestScreen';

// Bereich „Profil, Stand & Claude“ – Besitz: Paket P6 (docs/neubau/architektur.md §5.2).
// WP0a: „Dein Stand“ ist eine Seite (war Reiter); bis zum Profil-Blatt (WP0b/P6) führt der
// Profil-Knopf oben links direkt dorthin. Der Rahmen zeichnet darüber Zurück und die Titel-Aktionen
// (Übersetzen, Claude, Zahnrad).

declare module '../app/router/types' {
  interface RouteParams {
    overview: { tab?: 'judge' | 'errors' | 'path' | 'history' };
    vtest: NoParams;
  }
}

/** „Dein Stand“ mit den Abschnitten der Plätze `stand` (Statistik) und – bis zum Profil-Blatt – `profile`. */
function OverviewPage() {
  return (
    <>
      <ProgressScreen />
      <HubSections places={['stand', 'profile']} />
    </>
  );
}

export const profil = defineArea({
  id: 'profil',
  screens: {
    overview: {
      kind: 'page',
      component: OverviewPage,
      title: 'ovTitle',
      keepScroll: true,
      chrome: 'shell',
      params: z.object({ tab: z.enum(['judge', 'errors', 'path', 'history']).optional() }),
    },
    vtest: { kind: 'exercise', component: VtestScreen, title: 'vtTitle' },
  },
  boot: () => installCompanionHotkeys(),
});
