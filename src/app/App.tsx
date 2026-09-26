import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';
import { IconButton } from '../ui/Button';
import { Toaster } from '../ui/Toast';
import { DURATION } from '../ui/motion';
import { getDb, initCapabilities, useCapabilities } from '../platform/capabilities';
import { startLive, useLive } from '../data/live';
import { MigrationScreen } from '../features/migration/MigrationScreen';
import { OverviewScreen } from '../features/progress/OverviewScreen';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { HomeSkeleton } from '../features/system/HomeSkeleton';
import { ConnectionLost, NoDbNotice } from '../features/system/NoDbNotice';
import { applyDocumentSettings, isLang, isThemeMode, resolveTheme, useSettings } from './settings';
import { settingsWritePending } from './actions';

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

  // Gespeicherte Einstellungen aus app/profile übernehmen (maßgeblich gegenüber localStorage).
  const profile = useLive((s) => s.docs['app/profile']);
  useEffect(() => {
    if (!profile || settingsWritePending()) return;
    const s = useSettings.getState();
    if (isLang(profile.lang) && profile.lang !== s.lang) s.setLangLocal(profile.lang);
    const theme = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { m?: unknown }).m : undefined;
    if (isThemeMode(theme) && theme !== s.theme) s.setThemeLocal(theme);
  }, [profile]);

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

type Screen = 'loading' | 'nodb' | 'offline' | 'migration' | 'overview';

function useScreen(): Screen {
  const db = useCapabilities((s) => s.db);
  const status = useLive((s) => s.status);
  const schema = useLive((s) => s.docs['app/schema']);
  if (db === 'absent') return 'nodb';
  if (status === 'error') return 'offline';
  if (db === 'pending' || status !== 'ready') return 'loading';
  return schema ? 'overview' : 'migration';
}

export function App() {
  useBoot();
  const { t } = useT();
  const screen = useScreen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
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
          <IconButton icon="sliders" label={t('openSettings')} onClick={() => setSettingsOpen(true)} data-testid="open-settings" />
        </header>
        <main id="main" className="flex-1 pb-16">
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
              {screen === 'overview' && <OverviewScreen />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
      <Toaster />
    </MotionConfig>
  );
}
