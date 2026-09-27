import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
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
import { savedScroll, tabOf, useNav, type Route, type TabName } from './nav';
import { MigrationScreen } from '../features/migration/MigrationScreen';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { VtestScreen } from '../features/vtest/VtestScreen';
import { CheckScreen } from '../features/check/CheckScreen';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { LookupLayer } from '../features/lookup/LookupPopover';
import { HomeSkeleton } from '../features/system/HomeSkeleton';
import { ConnectionLost, NoDbNotice } from '../features/system/NoDbNotice';
import { applyDocumentSettings, isLang, isPalette, isThemeMode, resolveTheme, useSettings } from './settings';
import { settingsWritePending } from './actions';
import { initSpeech } from '../platform/speech';
import { setSoundEnabled } from '../platform/sound';
import { setHapticsEnabled } from '../platform/haptics';
import { normHaptic } from '../domain/progress/settings';
// Phase 2: Lernen (docs/phase2-plan.md), Wortschatz (M1) und Wissen (M8).
import { LearnHub } from '../features/learn/LearnHub';
import { CourseScreen } from '../features/course/CourseScreen';
import { LessonScreen } from '../features/course/LessonScreen';
import { GrammarScreen } from '../features/grammar/GrammarScreen';
import { GrammarSessionScreen } from '../features/grammar/SessionScreen';
import { WissenScreen } from '../features/grammar/WissenScreen';
import { DrillScreen } from '../features/drills/DrillScreen';
import { VocabScreen } from '../features/vocab/list/VocabScreen';
import { useToday } from '../features/today/state';
import { SpeakHub } from '../features/speak/SpeakHub';
import { RoleplayScreen } from '../features/speak/RoleplayScreen';
import { BusinessHub } from '../features/business/BusinessHub';
import { MailRefiner } from '../features/business/MailRefiner';
import { PlaybookScreen } from '../features/business/PlaybookScreen';
import { PitchCoach } from '../features/business/PitchCoach';
// Phase 5: Begleiter, Übersetzer, Preply-Brücke
import { useAiAvailable } from '../ai/scope';
import { CompanionLayer } from '../features/companion/CompanionOverlay';
import { installCompanionHotkeys } from '../features/companion/hotkeys';
import { openCompanion, useCompanion } from '../features/companion/store';
import { PreplyScreen } from '../features/preply/PreplyScreen';
import { SayScreen } from '../features/say/SayScreen';
import { FluencyScreen } from '../features/fluency/FluencyScreen';
import { MeetingScreen } from '../features/meeting/MeetingScreen';
// Phase 4: Lesen, Hören, Schreiben, Entdecken
import { InputRoutes } from '../features/input/InputRoutes';
import { AiTaskNotice } from '../features/input/AiTaskNotice';
import { runningTabs, useAiTasks } from '../features/input/aiTasks';
import { WhatsNew } from '../features/system/WhatsNew';
import { isInputScreen } from './modules';

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
    installCompanionHotkeys();
  }, []);

  // Gespeicherte Einstellungen aus app/profile übernehmen (maßgeblich gegenüber localStorage).
  const profile = useLive((s) => s.docs['app/profile']);
  useEffect(() => {
    if (!profile || settingsWritePending()) return;
    const s = useSettings.getState();
    if (isLang(profile.lang) && profile.lang !== s.lang) s.setLangLocal(profile.lang);
    const theme = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { m?: unknown }).m : undefined;
    if (isThemeMode(theme) && theme !== s.theme) s.setThemeLocal(theme);
    // Farbthema (M21): `theme.p` der alten App; fehlt es, bleibt die lokale Wahl (Standard Salbei).
    const palette = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { p?: unknown }).p : undefined;
    if (isPalette(palette) && palette !== s.palette) s.setPaletteLocal(palette);
  }, [profile]);

  // Töne (Kap. 4.7): Einstellung aus dem Profil, Standard aus.
  const sound = profile?.sound === true;
  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  // Vibration (Kap. 4.3): Standard an, abschaltbar (`app/profile.haptic === false`).
  const hapticOn = normHaptic(profile?.haptic);
  useEffect(() => {
    setHapticsEnabled(hapticOn);
  }, [hapticOn]);

  // Sprachausgabe (en-US): Stimmen laden, Stimme und Tempo aus dem Profil (nur Lesen).
  const voice = typeof profile?.voice === 'string' ? profile.voice : null;
  const rate = typeof profile?.rate === 'number' ? profile.rate : null;
  useEffect(() => {
    initSpeech({ voice, rate });
  }, [voice, rate]);

  // Sprache und Modus auf <html> anwenden; „Automatisch" folgt dem System.
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => applyDocumentSettings(lang, resolveTheme(theme, mq.matches), palette);
    apply();
    if (theme !== 'auto') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [lang, theme, palette]);
}

type Screen = 'loading' | 'nodb' | 'offline' | 'migration' | Route['name'];

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

/** Zahl offener Pflichtpunkte am Reiter „Heute" (M13). */
function useOpenDuties(): number {
  const st = useToday();
  return st.ready && st.dayLoaded && st.status === 'open' ? st.duties.total - st.duties.done : 0;
}

function TabBar({ tab }: { tab: TabName }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const open = useOpenDuties();
  const tasks = useAiTasks((s) => s.tasks);
  const busy = useMemo(() => runningTabs(tasks), [tasks]);
  const tabs = [
    { name: 'today' as const, label: t('navToday'), badge: open },
    { name: 'learn' as const, label: t('tabLearn'), badge: 0 },
    { name: 'speak' as const, label: t('tabSpeak'), badge: 0 },
    { name: 'discover' as const, label: t('dcTitle'), badge: 0 },
    { name: 'overview' as const, label: t('tabOverview'), badge: 0 },
  ];
  return (
    <nav
      aria-label={t('navLabel')}
      className="lx-glass fixed inset-x-0 bottom-0 z-40 flex justify-center gap-0.5 px-2 pt-2 sm:gap-1 sm:px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
      data-testid="tabbar"
    >
      {tabs.map((t2) => {
        const active = tab === t2.name;
        return (
          <button
            key={t2.name}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => go({ name: t2.name })}
            data-testid={`tab-${t2.name}`}
            className={`relative inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--radius-control)] px-1 text-xs sm:gap-1.5 sm:px-4 sm:text-sm transition-colors md:flex-none ${active ? 'lx-tab-active bg-surface-strong font-semibold text-fg' : 'font-medium text-muted hover:text-fg'}`}
          >
            {t2.label}
            {t2.badge > 0 && (
              <span className="lx-tnum inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-semibold text-accent-fg" data-testid="tab-badge" aria-label={t('tabOpen', { n: t2.badge })}>
                {t2.badge}
              </span>
            )}
            {/* M13: Ladepunkt, solange eine KI-Korrektur im Hintergrund läuft (Text für Vorleseprogramme). */}
            {busy.has(t2.name) && (
              <span className="absolute top-1 right-1" data-testid="tab-busy">
                <span className="lx-busy-dot block" aria-hidden="true" />
                <span className="sr-only">{t('tabBusy')}</span>
              </span>
            )}
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
  const migratedScreen = screen !== 'loading' && screen !== 'nodb' && screen !== 'offline' && screen !== 'migration';
  const ai = useAiAvailable();
  const companionOpen = useCompanion((s) => s.open);
  useEnsureDay(migratedScreen);
  const route = useNav((s) => s.route);
  const tab = migratedScreen ? tabOf(route.name) : null;

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
      <div className="mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col px-4 sm:px-6 lg:px-10" inert={settingsOpen || companionOpen}>
        <header className="flex items-center justify-between gap-4 pt-3 sm:pt-5">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--lx-accent)]" aria-hidden="true" />
            {t('appName')}
          </p>
          <div className="flex items-center gap-2">
            {tab && <TabBar tab={tab} />}
            {ai && migratedScreen && (
              <button
                type="button"
                onClick={() => openCompanion()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent-text transition-colors hover:bg-surface"
                aria-label={t('openCompanion')}
                data-testid="open-companion"
                data-ai=""
              >
                <Icon name="sparkle" size={20} />
                <span className="hidden sm:inline">{t('openCompanion')}</span>
              </button>
            )}
            <IconButton icon="sliders" label={t('openSettings')} onClick={() => setSettingsOpen(true)} data-testid="open-settings" />
          </div>
        </header>
        {/* M20: einmaliger Hinweis „Was ist neu" nach einem Update (Merker im Browser). */}
        {migratedScreen && <WhatsNew />}
        <main id="main" className="flex-1 pb-28 md:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base }}
              data-screen={screen}
              onAnimationStart={(def) => {
                // Bildlaufposition je Liste (M13): beim Zurückkehren wiederherstellen, sonst oben beginnen.
                if (def && typeof def === 'object' && 'opacity' in def && def.opacity === 1) window.scrollTo({ top: savedScroll(screen as Route['name']) });
              }}
            >
              {screen === 'loading' && <HomeSkeleton />}
              {screen === 'nodb' && <NoDbNotice />}
              {screen === 'offline' && <ConnectionLost />}
              {screen === 'migration' && <MigrationScreen />}
              {screen === 'today' && <TodayScreen />}
              {screen === 'overview' && <ProgressScreen />}
              {screen === 'vtest' && <VtestScreen />}
              {screen === 'check' && <CheckScreen />}
              {screen === 'trainer' && <TrainerScreen />}
              {screen === 'learn' && <LearnHub />}
              {screen === 'course' && <CourseScreen />}
              {screen === 'lesson' && route.name === 'lesson' && <LessonScreen id={route.id} />}
              {screen === 'grammar' && <GrammarScreen />}
              {screen === 'grammarSession' && <GrammarSessionScreen />}
              {screen === 'wissen' && <WissenScreen />}
              {screen === 'drill' && <DrillScreen />}
              {screen === 'vocab' && <VocabScreen />}
              {screen === 'speak' && <SpeakHub />}
              {screen === 'roleplay' && <RoleplayScreen />}
              {screen === 'business' && <BusinessHub />}
              {screen === 'mail' && <MailRefiner />}
              {screen === 'playbook' && <PlaybookScreen />}
              {screen === 'pitch' && <PitchCoach />}
              {screen === 'preply' && <PreplyScreen />}
              {screen === 'say' && <SayScreen />}
              {screen === 'fluency' && <FluencyScreen />}
              {screen === 'meeting' && <MeetingScreen />}
              {isInputScreen(screen) && <InputRoutes route={route} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
      <Toaster />
      <CompanionLayer />
      <AiTaskNotice />
      <LookupLayer />
      </HiddenInputProvider>
    </MotionConfig>
  );
}
