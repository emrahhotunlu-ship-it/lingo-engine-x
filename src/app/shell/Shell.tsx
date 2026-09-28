import { MotionConfig } from 'framer-motion';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Toaster } from '../../ui/Toast';
import { HiddenInputProvider } from '../../engine/HiddenInput';
import { SettingsButton } from '../../features/system/Chrome';
import { MigrationScreen } from '../../features/migration/MigrationScreen';
import { SettingsSheet } from '../../features/settings/SettingsSheet';
import { LookupLayer } from '../../features/lookup/LookupPopover';
import { HomeSkeleton } from '../../features/system/HomeSkeleton';
import { ConnectionLost, NoDbNotice } from '../../features/system/NoDbNotice';
import { CompanionLayer } from '../../features/companion/CompanionOverlay';
import { useCompanion } from '../../features/companion/store';
import { AiTaskNotice } from '../../features/input/AiTaskNotice';
import { isSystemScreen, useDeepLink, useEnsureDay, useScreen } from '../boot';
import { isExercise, useNav } from '../nav';
import { kindOf, sheetOf } from '../registry';
import { closeSettings, closeSheet, isSheetOpen, useSheets } from '../sheets';
import { Layer, RouteView } from './Layers';
import { TabBar } from './TabBar';

// App-Rahmen (docs/neubau/architektur.md §2.2): Kopf · Ebenen · Reiterleiste · Blätter · Hinweise.
// WP0a: einfacher Kopf (Profil-Knopf auf den Reiter-Wurzeln); die Optik nach Prototyp v1, das
// Profil-Blatt und die Fehlergrenzen folgen in WP0b.

/** Profil-Knopf oben links (bis zum Profil-Blatt in WP0b: führt zu „Dein Stand“ mit den Einstellungen). */
function ProfileButton() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return <IconButton icon="chart" label={t('nbShProfile')} onClick={() => go({ name: 'overview' })} data-testid="open-profile" className="-ml-2" />;
}

/** Kopf der Reiter-Wurzeln (WP0a: nur der Profil-Knopf; die Seite zeichnet ihren Titel selbst). */
function TopBar() {
  return (
    <div className="flex min-h-11 items-center pt-3" data-testid="topbar">
      <ProfileButton />
    </div>
  );
}

/** Blätter aus dem Register (Stapel in `sheets.ts`); das Einstellungsblatt bleibt wie bisher. */
function SheetHost() {
  const stack = useSheets((s) => s.stack);
  return (
    <>
      <SettingsSheet open={isSheetOpen(stack, 'settings')} onClose={closeSettings} />
      {stack
        .filter((e) => e.id !== 'settings')
        .map((e) => {
          const def = sheetOf(e.id);
          if (!def) return null;
          const Sheet = def.component;
          return <Sheet key={e.id} params={e.params} onClose={() => closeSheet(e.id)} />;
        })}
    </>
  );
}

export function Shell() {
  const { t } = useT();
  const screen = useScreen();
  const system = isSystemScreen(screen);
  const route = useNav((s) => s.route);
  const sheetOpen = useSheets((s) => s.stack.length > 0);
  const companionOpen = useCompanion((s) => s.open);
  useEnsureDay(!system);
  useDeepLink(!system);
  const exercise = !system && isExercise(route.name);
  const tabRoot = !system && kindOf(route.name) === 'tab';

  return (
    <MotionConfig reducedMotion="user">
      <HiddenInputProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-surface-solid focus:px-4 focus:py-3"
        >
          {t('skipToContent')}
        </a>
        {/* Bei offenem Blatt ist der Hintergrund inert: kein Fokus, kein VoiceOver-Wischen dorthin. */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-10" inert={sheetOpen || companionOpen}>
          {!system && !exercise && <TabBar />}
          {tabRoot && <TopBar />}
          {/* System-Bildschirme (Laden, keine Datenbank, Umstellung) haben keine Reiter: Einstellungen mit Diagnose und Sicherung oben rechts. */}
          {system && (
            <div className="flex justify-end pt-3" data-testid="system-actions">
              <SettingsButton />
            </div>
          )}
          <main id="main" className={`flex-1 ${!system && !exercise ? 'pb-28 md:pb-16' : 'pb-[max(env(safe-area-inset-bottom),2rem)]'}`}>
            <Layer screen={screen}>
              {screen === 'loading' && <HomeSkeleton />}
              {screen === 'nodb' && <NoDbNotice />}
              {screen === 'offline' && <ConnectionLost />}
              {screen === 'migration' && <MigrationScreen />}
              {!system && <RouteView route={route} />}
            </Layer>
          </main>
        </div>
        <SheetHost />
        <Toaster />
        <CompanionLayer />
        <AiTaskNotice />
        <LookupLayer />
      </HiddenInputProvider>
    </MotionConfig>
  );
}
