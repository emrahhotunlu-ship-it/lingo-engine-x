import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { SettingsSheet } from '../../features/settings/SettingsSheet';
import { useT } from '../../i18n';
import { Toaster } from '../../ui/Toast';
import { HiddenInputProvider } from '../../engine/HiddenInput';
import { SettingsButton } from '../../features/system/Chrome';
import { MigrationScreen } from '../../features/migration/MigrationScreen';
import { LookupLayer } from '../../features/lookup/LookupPopover';
import { HomeSkeleton } from '../../features/system/HomeSkeleton';
import { ConnectionLost, NoDbNotice } from '../../features/system/NoDbNotice';
import { CompanionLayer } from '../../features/companion/CompanionOverlay';
import { useCompanion } from '../../features/companion/store';
import { AiTaskNotice } from '../../features/input/AiTaskNotice';
import { tabId } from '../../features/progress/persist';
import { dayKey } from '../../domain/date';
import { setLogContext } from '../../platform/diagnostics';
import { deepLinkApplied, isSystemScreen, useDeepLink, useEnsureDay, useScreen, type SystemScreen } from '../boot';
import { useNav } from '../nav';
import { resumables } from '../registry';
import { installResume, useAutoResume } from '../resume';
import { routeToString } from '../router/deeplink';
import type { Route } from '../router/types';
import { useSheets } from '../sheets';
import { LayerContext } from './layer';
import { Layers, useVisibleKind } from './Layers';
import { RootBoundary, RootNotice } from './Boundary';
import { SheetHost } from './SheetHost';
import { TabBar } from './TabBar';
import { tabOfPlace, type Place } from './tabs';
import { TopBar } from './TopBar';

// App-Rahmen (docs/neubau/architektur.md §2.2): Kopf · Ebenen · Reiterleiste · Blätter · Hinweise,
// dazu die Wurzel-Fehlergrenze, das Fortsetzen nach Neuladen und der Diagnose-Kontext.

/** Systemzustände (Laden, keine Datenbank, offline, Umstellung): kein Reiter, keine Route. */
function SystemView({ screen }: { screen: SystemScreen }) {
  return (
    <div data-screen={screen} data-layer="system">
      <LayerContext.Provider value={{ kind: 'system', route: null }}>
        {screen === 'loading' && <HomeSkeleton />}
        {screen === 'nodb' && <NoDbNotice />}
        {screen === 'offline' && <ConnectionLost />}
        {screen === 'migration' && <MigrationScreen />}
      </LayerContext.Provider>
    </div>
  );
}

/** Fortsetzen: Speicher einmal installieren (nach dem Anmelden der Bereiche). */
function useResumeInstall(): void {
  useEffect(
    () =>
      installResume({
        list: resumables,
        now: () => Date.now(),
        day: () => dayKey(Date.now()),
        tabId,
      }),
    [],
  );
}

/** Automatisch zurück (< 2 Min.): über dem Reiter des Herkunftsplatzes öffnen, ✕ führt dorthin. */
function openAtOrigin(route: Route, origin: Place): void {
  const nav = useNav.getState();
  const tab = tabOfPlace(origin);
  if (tab && tab !== nav.tab) nav.switchTab(tab);
  useNav.getState().go(route);
}

/** Route und Ebene für Fehler außerhalb des Renderns (diagnostics.ts, leistung.md §6). */
function useDiagContext(): void {
  useEffect(() => {
    setLogContext(() => {
      const s = useNav.getState();
      return `${s.overlay ? 'Übung' : s.tab} · ${routeToString(s.route)}`;
    });
    return () => setLogContext(null);
  }, []);
}

function Frame() {
  const { t } = useT();
  const screen = useScreen();
  const system = isSystemScreen(screen);
  const kind = useVisibleKind();
  const sheetOpen = useSheets((s) => s.stack.length > 0);
  const companionOpen = useCompanion((s) => s.open);
  useEnsureDay(!system);
  useResumeInstall();
  useDeepLink(!system);
  useAutoResume(!system, openAtOrigin, deepLinkApplied);
  useDiagContext();
  const exercise = !system && kind === 'exercise';
  const tabRoot = !system && kind === 'tab';

  return (
    <>
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
        {/* System-Bildschirme haben keine Reiter: Einstellungen mit Diagnose und Sicherung oben rechts. */}
        {system && (
          <div className="flex justify-end pt-3" data-testid="system-actions">
            <SettingsButton />
          </div>
        )}
        <main id="main" className={`flex-1 ${!system && !exercise ? 'pb-28 md:pb-16' : 'pb-[max(env(safe-area-inset-bottom),2rem)]'}`}>
          {system ? <SystemView screen={screen} /> : <Layers />}
        </main>
      </div>
      <SheetHost />
      <Toaster />
      <CompanionLayer />
      <AiTaskNotice />
      <LookupLayer />
    </>
  );
}

/** Letzte Grenze: ruhiger Hinweis; „Diagnose und Sicherung“ öffnet ein eigenes Einstellungsblatt. */
function RootFallback() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RootNotice onDiagnostics={() => setOpen(true)} />
      <SettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function Shell() {
  return (
    <MotionConfig reducedMotion="user">
      <HiddenInputProvider>
        <RootBoundary fallback={<RootFallback />}>
          <Frame />
        </RootBoundary>
      </HiddenInputProvider>
    </MotionConfig>
  );
}
