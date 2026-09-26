import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';
import { IconButton } from '../ui/Button';
import { Toaster } from '../ui/Toast';
import { DURATION } from '../ui/motion';
import { getDb, initCapabilities, useCapabilities } from '../platform/capabilities';
import { startDayLive, startLive, useLive } from '../data/live';
import { HiddenInputProvider } from '../engine/HiddenInput';
import { TodayScreen } from '../features/today/TodayScreen';
import { ensureDay } from '../features/today/store';
import { TrainerScreen } from '../features/vocab/TrainerScreen';
import { installFlushOnHide } from '../features/vocab/persist';
import { useClock, useClockTicker } from './clock';
import { useNav, type Route } from './nav';
import { MigrationScreen } from '../features/migration/MigrationScreen';
import { OverviewScreen } from '../features/progress/OverviewScreen';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { LookupLayer } from '../features/lookup/LookupPopover';
import { HomeSkeleton } from '../features/system/HomeSkeleton';
import { ConnectionLost, NoDbNotice } from '../features/system/NoDbNotice';
import { applyDocumentSettings, isLang, isThemeMode, resolveTheme, useSettings } from './settings';
import { settingsWritePending } from './actions';
import { initSpeech } from '../platform/speech';
import { SpeakHub } from '../features/speak/SpeakHub';
import { RoleplayScreen } from '../features/speak/RoleplayScreen';
import { BusinessHub } from '../features/business/BusinessHub';
import { MailRefiner } from '../features/business/MailRefiner';
import { PlaybookScreen } from '../features/business/PlaybookScreen';
import { PitchCoach } from '../features/business/PitchCoach';

// App-Rahmen: startet die Fähigkeiten, abonniert die Daten genau einmal und wählt
// den Bildschirm. Der Rahmen rendert sofort; Funktionen kommen dazu, sobald die
// Laufzeit antwortet (Kap. 3.1).

function useBoot(): void {
  const dbStatus = useCapabilities((s) => s.db);

  useEffect(() => {
    initCapabilities();
  }, []);

  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startLive(db);
  }, [dbStatus]);

  // Tagesprotokoll log/<heute>: ein Abo je Lerntag, neu um 04:00.
  useClockTicker();
  const today = useClock((s) => s.today);
  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startDayLive(db, today);
  }, [dbStatus, today]);

  useEffect(() => {
    installFlushOnHide();
  }, []);

  // Gespeicherte Einstellungen aus app/profile übernehmen (maßgeblich gegenüber localStorage).
  const profile = useLive((s) => s.docs['app/profile']);
  useEffect(() => {
    if (!profile || settingsWritePending()) return;
    const s = useSettings.getState();
    if (isLang(profile.lang) && profile.lang !== s.lang) s.setLangLocal(profile.lang);
    const theme = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { m?: unknown }).m : undefined;
    if (isThemeMode(theme) && theme !== s.theme) s.setThemeLocal(theme);
  }, [profile]);

  // Sprachausgabe (en-US): Stimmen laden, Stimme und Tempo aus dem Profil (nur Lesen).
  const voice = typeof profile?.voice === 'string' ? profile.voice : null;
  const rate = typeof profile?.rate === 'number' ? profile.rate : null;
  useEffect(() => {
    initSpeech({ voice, rate });
  }, [voice, rate]);

  // Sprache und Modus auf <html> anwenden; „Automatisch" folgt dem System.
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => applyDocumentSettings(lang, resolveTheme(theme, mq.matches));
    apply();
    if (theme !== 'auto') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [lang, theme]);
}

type Screen = 'loading' | 'nodb' | 'offline' | 'migration' | Route['name'];

/** Phase 3: Sprechen und Business (Plan §2). */
const PHASE3_SCREENS: ReadonlySet<string> = new Set(['speak', 'roleplay', 'business', 'mail', 'playbook', 'pitch']);

function useScreen(): Screen {
  const route = useNav((s) => s.route);
  const db = useCapabilities((s) => s.db);
  const status = useLive((s) => s.status);
  const schema = useLive((s) => s.docs['app/schema']);
  const schemaInvalid = useLive((s) => 'app/schema' in s.invalid);
  if (db === 'absent') return 'nodb';
  if (status === 'error') return 'offline';
  if (db === 'pending' || status !== 'ready') return 'loading';
  const migrated = !!schema && !schemaInvalid && typeof schema.version === 'number' && schema.version >= 1;
  return migrated ? route.name : 'migration';
}

/** Tagesplan einmal je Lerntag festlegen – sobald die Daten da sind und die Seite sichtbar ist. */
function useEnsureDay(active: boolean): void {
  const today = useClock((s) => s.today);
  useEffect(() => {
    if (!active) return;
    const run = () => {
      if (document.visibilityState === 'visible') void ensureDay(useClock.getState().now);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [active, today]);
}

function TabBar({ route }: { route: Screen }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const tabs = [
    { name: 'today' as const, label: t('navToday') },
    { name: 'overview' as const, label: t('navOverview') },
  ];
  return (
    <nav
      aria-label={t('navLabel')}
      className="lx-glass fixed inset-x-0 bottom-0 z-40 flex justify-center gap-1 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
      data-testid="tabbar"
    >
      {tabs.map((tab) => {
        const active = route === tab.name;
        return (
          <button
            key={tab.name}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => go({ name: tab.name })}
            data-testid={`tab-${tab.name}`}
            className={`min-h-11 flex-1 rounded-[var(--radius-control)] px-4 text-sm transition-colors md:flex-none ${active ? 'bg-surface-strong font-semibold text-fg' : 'font-medium text-muted hover:text-fg'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function App() {
  useBoot();
  const { t } = useT();
  const screen = useScreen();
  const migratedScreen = screen === 'today' || screen === 'overview' || screen === 'trainer' || PHASE3_SCREENS.has(screen);
  useEnsureDay(migratedScreen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

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
      <div className="mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col px-4 sm:px-6 lg:px-10" inert={settingsOpen}>
        <header className="flex items-center justify-between gap-4 pt-3 sm:pt-5">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--lx-accent)]" aria-hidden="true" />
            {t('appName')}
          </p>
          <div className="flex items-center gap-2">
            {(screen === 'today' || screen === 'overview') && <TabBar route={screen} />}
            <IconButton icon="sliders" label={t('openSettings')} onClick={() => setSettingsOpen(true)} data-testid="open-settings" />
          </div>
        </header>
        <main id="main" className="flex-1 pb-28 md:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base }}
              data-screen={screen}
            >
              {screen === 'loading' && <HomeSkeleton />}
              {screen === 'nodb' && <NoDbNotice />}
              {screen === 'offline' && <ConnectionLost />}
              {screen === 'migration' && <MigrationScreen />}
              {screen === 'today' && <TodayScreen />}
              {screen === 'overview' && <OverviewScreen />}
              {screen === 'trainer' && <TrainerScreen />}
              {screen === 'speak' && <SpeakHub />}
              {screen === 'roleplay' && <RoleplayScreen />}
              {screen === 'business' && <BusinessHub />}
              {screen === 'mail' && <MailRefiner />}
              {screen === 'playbook' && <PlaybookScreen />}
              {screen === 'pitch' && <PitchCoach />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
      <Toaster />
      <LookupLayer />
      </HiddenInputProvider>
    </MotionConfig>
  );
}
