import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import { FOCUS_DIMS } from '../../domain/assessment/types';
import { buildOverview } from '../../domain/overview';
import { useT, type MessageKey } from '../../i18n';
import { local } from '../../platform/storage';
import { Tabs } from '../../ui/Tabs';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { LateRescueCard } from '../migration/LateRescueCard';
import { maybeAutoAssess } from './assessRun';
import { ErrorsTab } from './ErrorsTab';
import { HistoryTab } from './HistoryTab';
import { JudgeTab } from './JudgeTab';
import { PathTab } from './PathTab';
import { LevelScale } from './StandHeader';
import { StatsTab } from './StatsTab';

// „Dein Stand" (Kap. 6.13, Neubau plan.md §1.3; Fokus-Umbau: ohne Kurs): Kopf Wörter · Niveau-Skala, darunter fünf
// Reiter Urteil · Fehler · Ziel C1 · Statistik · Verlauf – kein endloses Scrollen am Handy, nichts
// doppelt. Serie und Wochenstreifen stehen im Profil-Blatt, die Tests und der Wochenbericht dort als
// Zeilen. Das Profil-Blatt öffnet die Seite direkt auf einem Reiter (`route.tab`); sonst gilt der
// zuletzt offene Reiter aus localStorage (Bequemlichkeit). Das Öffnen ist einer der beiden Auslöser
// der Einschätzung (Plan W1).

export type ProgressTab = 'judge' | 'errors' | 'path' | 'stats' | 'history';
const TAB_KEY = 'lx:progress-tab';
const TABS: ReadonlyArray<{ id: ProgressTab; label: MessageKey }> = [
  { id: 'judge', label: 'nbProfilTabJudge' },
  { id: 'errors', label: 'nbProfilTabErrors' },
  { id: 'path', label: 'nbProfilTabPath' },
  { id: 'stats', label: 'nbProfilTabStats' },
  { id: 'history', label: 'nbProfilTabHistory' },
];
const isTab = (v: unknown): v is ProgressTab => TABS.some((x) => x.id === v);
const EMPTY = new Map<string, Record<string, unknown>>();

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

function Stat({ label, value, unit, testId }: { label: string; value: string; unit: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-xs text-muted">{label}</span>
      {/* Nie mitten im Wort umbrechen (Befund H8): Zahl und Einheit dürfen untereinander stehen. */}
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="lx-tnum text-2xl font-semibold tracking-tight" data-testid={testId}>
          {value}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </span>
    </div>
  );
}

export function ProgressScreen() {
  const { t, num, date } = useT();
  const route = useNav((s) => s.route);
  const now = useClock((s) => s.now);
  const docs = useLive((s) => s.docs);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const archive = useLive((s) => s.collections.archive) ?? EMPTY;
  const [tab, setTab] = useState<ProgressTab>(() => {
    const fromRoute = route.name === 'overview' ? route.tab : undefined;
    if (fromRoute) return fromRoute;
    const saved = local.get(TAB_KEY);
    return isTab(saved) ? saved : 'judge';
  });
  const choose = (id: ProgressTab) => {
    setTab(id);
    local.set(TAB_KEY, id);
  };
  // Aus dem Profil-Blatt direkt auf einen Reiter, auch wenn die Seite schon offen ist.
  const routeTab = route.name === 'overview' ? route.tab : undefined;
  const [seenRouteTab, setSeenRouteTab] = useState(routeTab);
  if (routeTab !== seenRouteTab) {
    setSeenRouteTab(routeTab);
    if (routeTab) setTab(routeTab);
  }

  // Auslöser der Einschätzung (Plan W1): Reiter „Dein Stand" geöffnet – höchstens einmal je Tag.
  useEffect(() => {
    void maybeAutoAssess(Date.now());
  }, []);

  const ov = useMemo(
    () => buildOverview({ nowMs: now, profile: docs['app/profile'], course: docs['app/course'], assess: docs['app/assess'], schema: docs['app/schema'], vocab, grammar, archives: archive.values() }),
    [now, docs, vocab, grammar, archive],
  );
  const assess = useMemo(() => readAssess(docs['app/assess']), [docs]);
  const tabLabel = t(TABS.find((x) => x.id === tab)?.label ?? 'progJudge');
  useCompanionSee({
    area: 'overview',
    label: `${t('ovTitle')} · ${tabLabel}`.slice(0, 60),
    phase: 'idle',
    detail: assess
      ? `Level ${assess.data.cefr ?? '?'}; skills ${assess.data.dims.filter((d) => (FOCUS_DIMS as readonly string[]).includes(d.id)).map((d) => `${d.id}=${d.level ?? 'thin'}`).join(', ')}${assess.data.focus ? `; focus: ${assess.data.focus.action ?? assess.data.focus.title}` : ''}`
      : undefined,
  });

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item}>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('ovTitle')}</h1>
      </motion.header>

      {/* plan.md §1.3: EINE Kopfkarte – Wörter · Niveau, darunter die Niveau-Skala. */}
      <motion.section variants={item} aria-label={t('ovTitle')} className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-4 sm:p-6" data-testid="stand-head">
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <Stat label={t('vocabLabel')} value={num(ov.vocab.total)} unit={t(ov.vocab.total === 1 ? 'vocabUnit_one' : 'vocabUnit_other')} testId="vocab-total" />
          <Stat label={t('nbProfilLevel')} value={assess?.data.cefr ?? '–'} unit={assess?.data.cefr ? t('nbProfilLevelUnit') : t('nbProfilLevelNone')} testId="stand-level" />
        </div>
        {assess?.data.cefr && (
          <div className="border-t border-line pt-4">
            <LevelScale data={{ cefr: assess.data.cefr, dims: assess.data.dims.filter((d) => (FOCUS_DIMS as readonly string[]).includes(d.id)) }} />
          </div>
        )}
      </motion.section>

      <LateRescueCard />

      <motion.div variants={item}>
        <Tabs label={t('progTabs')} items={TABS.map((x) => ({ id: x.id, label: t(x.label), testId: `tab-${x.id}` }))} value={tab} onChange={choose} testId="progress-tabs">
          {tab === 'judge' && <JudgeTab />}
          {tab === 'errors' && <ErrorsTab />}
          {tab === 'path' && <PathTab />}
          {tab === 'stats' && <StatsTab />}
          {tab === 'history' && <HistoryTab />}
        </Tabs>
      </motion.div>

      {ov.schema && ov.schema.migratedAt > 0 && (
        <motion.p variants={item} className="text-xs text-subtle">
          {t('migratedOn', { date: date(ov.schema.migratedAt) })}
        </motion.p>
      )}
    </motion.div>
  );
}
