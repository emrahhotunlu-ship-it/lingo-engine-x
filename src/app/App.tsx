import { MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useT } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
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
import { closeSettings, useSettingsSheet } from './sheets';
import { SettingsButton, TitleActions } from '../features/system/Chrome';
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
import { MailRefiner } from '../features/business/MailRefiner';
import { PlaybookScreen } from '../features/business/PlaybookScreen';
import { PitchCoach } from '../features/business/PitchCoach';
// Phase 5: Begleiter, Übersetzer, Preply-Brücke
import { CompanionLayer } from '../features/companion/CompanionOverlay';
import { installCompanionHotkeys } from '../features/companion/hotkeys';
import { useCompanion } from '../features/companion/store';
import { SayScreen } from '../features/say/SayScreen';
import { FluencyScreen } from '../features/fluency/FluencyScreen';
import { MeetingScreen } from '../features/meeting/MeetingScreen';
import { PatternsScreen } from '../features/patterns/PatternsScreen';
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
  const tabs: Array<{ name: TabName; label: string; icon: IconName; badge: number }> = [
    { name: 'today', label: t('navToday'), icon: 'sun', badge: open },
    { name: 'learn', label: t('tabLearn'), icon: 'layers', badge: 0 },
    { name: 'speak', label: t('tabSpeak'), icon: 'chat', badge: 0 },
    { name: 'overview', label: t('tabOverview'), icon: 'chart', badge: 0 },
  ];
  return (
    <nav
      aria-label={t('navLabel')}
      className="lx-glass fixed inset-x-0 bottom-0 z-40 flex justify-center gap-1 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] md:sticky md:top-0 md:bottom-auto md:mx-auto md:mt-3 md:w-fit md:gap-1 md:rounded-full md:px-1.5 md:py-1.5"
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
            className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 text-2xs transition-colors md:min-h-10 md:flex-none md:flex-row md:gap-1.5 md:rounded-full md:px-4 md:text-sm ${active ? 'font-semibold text-fg md:bg-surface-strong' : 'font-medium text-muted hover:text-fg'}`}
          >
            {/* Aktiver Reiter: Symbol auf heller Pille + fette Schrift (nicht nur Farbe). */}
            <span className={`relative inline-flex rounded-full px-4 py-1 transition-colors duration-200 md:py-0 md:pr-2 md:pl-0 ${active ? 'bg-accent-soft text-accent-text md:bg-transparent md:text-fg' : ''}`}>
              <Icon name={t2.icon} size={22} />
              {t2.badge > 0 && (
                <span className="lx-tnum absolute -top-1 right-1 inline-flex md:-top-2 md:-right-1.5 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs leading-4 font-semibold text-accent-fg" data-testid="tab-badge" aria-label={t('tabOpen', { n: t2.badge })}>
                  {t2.badge}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">{t2.label}</span>
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
  const companionOpen = useCompanion((s) => s.open);
  useEnsureDay(migratedScreen);
  const route = useNav((s) => s.route);
  const tab = migratedScreen ? tabOf(route.name) : null;

  const settingsOpen = useSettingsSheet((s) => s.open);

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
      {/* UX-Beratung 27.09. (Nr. 2): keine globale App-Kopfzeile mehr. Jeder Reiter hat seine eigene
          Titelzeile mit dem Claude-Symbol (auf „Stand" zusätzlich das Zahnrad), jede Übung ihre Übungsleiste. */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[76rem] flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-10" inert={settingsOpen || companionOpen}>
        {tab && <TabBar tab={tab} />}
        {/* „Dein Stand" hat (noch) keine eigene Titelzeile mit Symbolen: Claude und Zahnrad oben rechts. */}
        {migratedScreen && screen === 'overview' && (
          <div className="absolute top-[calc(env(safe-area-inset-top)+1.25rem)] right-2 z-10 sm:top-[calc(env(safe-area-inset-top)+2.25rem)] sm:right-4 lg:right-8 md:top-[calc(env(safe-area-inset-top)+4.75rem)]" data-testid="stand-actions">
            <TitleActions />
          </div>
        )}
        {/* System-Bildschirme (Laden, keine Datenbank, Umstellung) haben keine Reiter: Einstellungen mit Diagnose und Sicherung oben rechts. */}
        {!migratedScreen && (
          <div className="flex justify-end pt-3" data-testid="system-actions">
            <SettingsButton />
          </div>
        )}
        {/* M20: einmaliger Hinweis „Was ist neu" nach einem Update (Merker im Browser). */}
        {migratedScreen && <WhatsNew />}
        <main id="main" className={`flex-1 ${tab ? 'pb-28 md:pb-16' : 'pb-[max(env(safe-area-inset-bottom),2rem)]'}`}>
          {/* Bildschirmwechsel ohne `AnimatePresence mode="wait"`: der neue Bildschirm steht sofort und
              blendet nur ein. Ein Wechsel kann so nie an einer hängenden Ausblendung stecken bleiben
              (schnelles Tippen, spätes Nachladen des Tagesplans). */}
            <motion.div
              key={screen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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
              {screen === 'mail' && <MailRefiner />}
              {screen === 'playbook' && <PlaybookScreen />}
              {screen === 'pitch' && <PitchCoach />}
              {screen === 'say' && <SayScreen />}
              {screen === 'fluency' && <FluencyScreen />}
              {screen === 'meeting' && <MeetingScreen />}
              {screen === 'patterns' && <PatternsScreen />}
              {isInputScreen(screen) && <InputRoutes route={route} />}
            </motion.div>
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
