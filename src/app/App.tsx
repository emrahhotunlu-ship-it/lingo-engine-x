import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { Icon, type IconName } from '../ui/Icon';
import { Toaster, toast } from '../ui/Toast';
import { DURATION } from '../ui/motion';
import { getDb, initCapabilities, useCapabilities } from '../platform/capabilities';
import { HiddenInputProvider } from '../engine/HiddenInput';
import { initSpeech } from '../platform/speech';
import { useClockTicker } from './clock';
import { InputScreen } from '../screens/InputScreen';
import { BlitzScreen } from '../screens/BlitzScreen';
import { WriteScreen } from '../screens/WriteScreen';
import { applyDocumentSettings, isLang, isThemeMode, resolveTheme, useSettings } from './settings';
import { closeSheet, go, openSheet, useRoute } from './route';
import { markNoDb, saveCards, saveProfile, saveSummary, startCoach, startInput, useCoach } from '../coach/store';
import { buildSummary } from '../coach/summary';
import { stumbleStats, weakCatsOf } from '../coach/stumble';
import { addDays } from '../domain/date';
import { useClock } from './clock';
import { useDesktop } from './useDesktop';
import { importLegacy } from '../coach/legacy';
import { HomeScreen } from '../screens/HomeScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { VocabScreen } from '../screens/VocabScreen';
import { PreplyScreen } from '../screens/PreplyScreen';
import { PlacementScreen } from '../screens/PlacementScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { SettingsSheet } from '../screens/SettingsSheet';
import { TranslateSheet } from '../screens/TranslateSheet';
import { AskSheet } from '../screens/AskSheet';
import { WordSheet } from '../screens/WordSheet';
import { Skeleton } from '../ui/Skeleton';

// App-Rahmen des Trainers (docs/neustart.md §4): startet die Fähigkeiten, abonniert die Daten
// einmal, übernimmt einmalig die alten Daten und zeigt einen von wenigen Bildschirmen.

function useBoot(): void {
  const dbStatus = useCapabilities((s) => s.db);
  useClockTicker();

  useEffect(() => {
    initCapabilities();
    initSpeech();
  }, []);

  useEffect(() => {
    if (dbStatus === 'absent') markNoDb();
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startCoach(db);
  }, [dbStatus]);

  // Input der letzten sieben Tage (vom Tagesauftrag), neu je Lerntag.
  const today = useClock((s) => s.today);
  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startInput(db, addDays(today, -6));
  }, [dbStatus, today]);

  // Einmalige Übernahme der alten Daten (Karten, Serie, Grammatik, Einschätzung).
  const status = useCoach((s) => s.status);
  const imported = useCoach((s) => !!s.profile?.imported);
  const started = useRef(false);
  const { t } = useT();
  useEffect(() => {
    if (status !== 'ready' || imported || started.current) return;
    const db = getDb();
    if (!db) return;
    started.current = true;
    void importLegacy(db, useCoach.getState().cards, async (plan) => {
      await saveCards(plan.cards);
      await saveProfile({ imported: plan.imported });
      if (plan.cards.length) toast(t('cImported', { n: plan.cards.length }));
    }).then((plan) => {
      // Gescheitert (Fehler steht im Protokoll): weiterarbeiten, beim nächsten Öffnen erneut versuchen.
      if (!plan) useCoach.setState({ importFailed: true });
    });
  }, [status, imported, t]);

  // Zusammenfassung für den Tagesauftrag: nur schreiben, wenn sie sich geändert hat.
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const inlog = useCoach((s) => s.inlog);
  const writing = useCoach((s) => s.writing);
  const repair = useCoach((s) => s.repair);
  const lastSummary = useRef('');
  useEffect(() => {
    if (status !== 'ready' || !profile?.placement) return;
    const summary = buildSummary(profile, cards, inlog, today, weakCatsOf(stumbleStats(writing, repair, today), 3));
    const key = JSON.stringify(summary);
    if (key === lastSummary.current) return;
    const timer = window.setTimeout(() => {
      lastSummary.current = key;
      void saveSummary(summary);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [status, profile, cards, inlog, writing, repair, today]);

  // Sprache und Darstellung: gespeichert im Profil, lokal nur als Kopie für den ersten Bildaufbau.
  const ui = useCoach((s) => s.profile?.ui);
  useEffect(() => {
    if (!ui) return;
    const s = useSettings.getState();
    if (isLang(ui.lang) && ui.lang !== s.lang) s.setLangLocal(ui.lang);
    if (isThemeMode(ui.theme) && ui.theme !== s.theme) s.setThemeLocal(ui.theme);
  }, [ui]);

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

const TABS: ReadonlyArray<{ route: 'home' | 'input' | 'plan' | 'vocab'; icon: IconName; key: 'cTabHome' | 'cTabInput' | 'cTabPlan' | 'mwTab' }> = [
  { route: 'home', icon: 'target', key: 'cTabHome' },
  { route: 'input', icon: 'book', key: 'cTabInput' },
  { route: 'vocab', icon: 'cards', key: 'mwTab' },
  { route: 'plan', icon: 'chart', key: 'cTabPlan' },
];

const isFlow = (route: string): boolean => route === 'session' || route === 'placement' || route === 'check' || route === 'blitz' || route === 'write';

/** Desktop (ab 1024 px): die Reiter stehen oben in der Kopfleiste, neben dem Namen. */
function DesktopNav() {
  const { t } = useT();
  const route = useRoute((s) => s.route.name);
  return (
    <nav aria-label="Navigation" className="ml-6 mr-auto flex items-center gap-1">
      {TABS.map((tab) => {
        const active = route === tab.route;
        return (
          <button
            key={tab.route}
            type="button"
            onClick={() => go({ name: tab.route })}
            aria-current={active ? 'page' : undefined}
            data-testid={`tab-${tab.route}`}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${active ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface hover:text-fg'}`}
          >
            <Icon name={tab.icon} size={18} />
            {t(tab.key)}
          </button>
        );
      })}
    </nav>
  );
}

function TopBar() {
  const { t } = useT();
  const route = useRoute((s) => s.route.name);
  const desktop = useDesktop();
  const actions: ReadonlyArray<{ icon: IconName; label: string; run: () => void; testId: string }> = [
    { icon: 'translate', label: t('cTranslate'), run: () => openSheet('translate'), testId: 'open-translate' },
    { icon: 'chat', label: t('cAsk'), run: () => openSheet('ask'), testId: 'open-ask' },
    { icon: 'gear', label: t('cSettings'), run: () => openSheet('settings'), testId: 'open-settings' },
  ];
  const inFlow = isFlow(route);
  const nav = desktop && !inFlow;
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 lg:max-w-5xl">
        <span className={`text-sm font-semibold tracking-tight text-fg ${nav ? '' : 'mr-auto'}`}>{inFlow ? '' : 'Lingo'}</span>
        {nav && <DesktopNav />}
        {actions.map((a) => (
          <button
            key={a.testId}
            type="button"
            onClick={a.run}
            aria-label={a.label}
            title={a.label}
            data-testid={a.testId}
            className="grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <Icon name={a.icon} size={20} />
          </button>
        ))}
      </div>
    </header>
  );
}

function TabBar() {
  const { t } = useT();
  const route = useRoute((s) => s.route.name);
  const desktop = useDesktop();
  if (isFlow(route) || desktop) return null;
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-bg/85 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map((tab) => {
          const active = route === tab.route;
          return (
            <button
              key={tab.route}
              type="button"
              onClick={() => go({ name: tab.route })}
              aria-current={active ? 'page' : undefined}
              data-testid={`tab-${tab.route}`}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors ${active ? 'text-accent-text' : 'text-muted hover:text-fg'}`}
            >
              <Icon name={tab.icon} size={22} />
              {t(tab.key)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Screen() {
  const route = useRoute((s) => s.route);
  const status = useCoach((s) => s.status);
  const { t } = useT();
  if (status === 'nodb' || status === 'error') {
    return (
      <p className="mx-auto mt-16 max-w-md px-4 text-center text-sm text-muted" data-testid="no-db">
        {status === 'nodb' ? t('cNoDb') : t('cDbError')}
      </p>
    );
  }
  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-8 lg:max-w-5xl" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={route.name}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: DURATION.base }}
      >
        {route.name === 'home' && <HomeScreen />}
        {route.name === 'plan' && <PlanScreen />}
        {route.name === 'input' && <InputScreen />}
        {route.name === 'vocab' && <VocabScreen />}
        {route.name === 'preply' && <PreplyScreen />}
        {route.name === 'blitz' && <BlitzScreen />}
        {route.name === 'write' && <WriteScreen from={route.from} />}
        {route.name === 'placement' && <PlacementScreen />}
        {route.name === 'check' && <PlacementScreen mode="check" />}
        {route.name === 'session' && <SessionScreen extra={!!route.extra} />}
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  useBoot();
  const sheet = useRoute((s) => s.sheet);
  return (
    <MotionConfig reducedMotion="user">
      <HiddenInputProvider>
        <div className="min-h-dvh bg-bg text-fg">
          <TopBar />
          <main className="pb-28 lg:pb-16">
            <Screen />
          </main>
          <TabBar />
        </div>
        <SettingsSheet open={sheet === 'settings'} onClose={closeSheet} />
        <TranslateSheet open={sheet === 'translate'} onClose={closeSheet} />
        <AskSheet open={sheet === 'ask'} onClose={closeSheet} />
        <WordSheet />
        <Toaster />
      </HiddenInputProvider>
    </MotionConfig>
  );
}
