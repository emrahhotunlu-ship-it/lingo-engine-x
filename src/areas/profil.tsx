import { z } from 'zod';
import { defineArea } from '../app/registry';
import { installCompanionHotkeys } from '../features/companion/hotkeys';
import { ClaudeDrillScreen } from '../features/companion/ClaudeDrillScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { ChecksPage, TodayRescueRow, TodayWeeklyRow, WeeklyPage } from '../features/progress/ProfilePages';
import { ProfileHead, ProfileMoreRows, ProfileRescueRow, ProfileStandRows, ProfileTestRows } from '../features/progress/profile/ProfileSections';
import { VtestScreen } from '../features/vtest/VtestScreen';
import { vtestResume } from '../features/vtest/session';
import { useClaudeDrill } from '../features/companion/drill';
import { MemorySection } from '../features/settings/MemorySection';

// Bereich „Profil, Stand & Claude“ – Besitz: Paket P6 (docs/neubau/plan.md §4.7).
// - Profil-Blatt (Platz `profile`): Kopf · Stand › · Tests › · Wochenbericht › · Einstellungen ›
//   · Nachtragen (nur wenn nötig). Den Blatt-Host zeichnet der Rahmen (WP0b).
// - „Dein Stand“ (`overview`) ist der Reiter „Fortschritt“ in der Leiste, mit fünf inneren Reitern;
//   „Statistik“ trägt den Platz `stand`.
// - Seiten `checks` (Wochen-Check) und `weekly` (Wochenbericht), Übung `vtest` (fortsetzbar).
// - Ruhige Zeilen auf Heute: Nachtragen, Wochenbericht (montags).

declare module '../app/router/types' {
  interface RouteParams {
    overview: { tab?: 'words' | 'grammar' | 'review' | 'judge' | 'errors' | 'path' | 'stats' | 'history' };
    vtest: NoParams;
    checks: NoParams;
    weekly: NoParams;
    claudeDrill: NoParams;
  }
}

/** „Dein Stand“; der Platz `stand` steht im Reiter „Zahlen“ (Statistik, plan.md §1.3). */
function OverviewPage() {
  return <ProgressScreen />;
}

export const profil = defineArea({
  id: 'profil',
  screens: {
    // Reiter-Wurzel „Fortschritt“ (Emrahs Wunsch 01.10.2026): der Kopf kommt vom Rahmen (Profil-Knopf,
    // Übersetzen, Claude, Zahnrad), den großen Titel zeichnet die Seite selbst.
    overview: {
      kind: 'tab',
      component: OverviewPage,
      title: 'ovTitle',
      keepScroll: true,
      params: z.object({ tab: z.enum(['words', 'grammar', 'review', 'judge', 'errors', 'path', 'stats', 'history']).optional() }),
    },
    checks: { kind: 'page', component: ChecksPage, title: 'ckTitle', keepScroll: true, chrome: 'shell' },
    weekly: { kind: 'page', component: WeeklyPage, title: 'nbProfilWeekly', keepScroll: true, chrome: 'shell' },
    vtest: { kind: 'exercise', component: VtestScreen, title: 'vtTitle' },
    // N96: „Mach mir eine Übung dazu“ aus dem Claude-Blatt; ohne Sitzung zurück zur Herkunft.
    claudeDrill: { kind: 'exercise', component: ClaudeDrillScreen, title: 'nbProfilDrillTitle', ensure: () => useClaudeDrill.getState().phase !== 'idle' },
    // Paket B (Backlog B1): monatliche Vergleichsaufgabe (Angebot in der letzten Monatswoche).
  },
  sections: [
    { id: 'profile-head', place: 'profile', order: 10, component: ProfileHead },
    { id: 'profile-stand', place: 'profile', order: 20, component: ProfileStandRows },
    { id: 'profile-tests', place: 'profile', order: 30, component: ProfileTestRows },
    { id: 'profile-more', place: 'profile', order: 40, component: ProfileMoreRows },
    { id: 'profile-rescue', place: 'profile', order: 50, component: ProfileRescueRow },
    { id: 'today-rescue', place: 'today', order: 80, component: TodayRescueRow },
    { id: 'today-weekly', place: 'today', order: 85, component: TodayWeeklyRow },
  ],
  // Paket B (Backlog B5): „Claude merkt sich“ – sichtbar und löschbar unter „Mein Kontext“.
  settings: [{ id: 'memory', group: 'context', order: 50, component: MemorySection }],
  resumables: [vtestResume],
  boot: () => installCompanionHotkeys(),
});
