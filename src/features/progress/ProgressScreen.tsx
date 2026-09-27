import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import { buildOverview } from '../../domain/overview';
import { useT, type MessageKey } from '../../i18n';
import { local } from '../../platform/storage';
import { Tabs } from '../../ui/Tabs';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCompanionSee } from '../companion/seeing';
import { LateRescueCard } from '../migration/LateRescueCard';
import { PreplyEntry } from '../preply/PreplyEntry';
import { maybeAutoAssess } from './assessRun';
import { ErrorsTab } from './ErrorsTab';
import { HistoryTab } from './HistoryTab';
import { JudgeTab } from './JudgeTab';
import { PathTab } from './PathTab';

// „Dein Stand" (Kap. 6.13, Plan E18): Kopfzeile mit Serie · Kurs · Karten und vier Reiter
// Urteil · Fehler · Weg nach C1 · Verlauf – kein endloses Scrollen am Handy, nichts doppelt.
// Der zuletzt offene Reiter steht in localStorage (Bequemlichkeit). Das Öffnen ist einer der
// beiden Auslöser der Einschätzung (Plan W1).

export type ProgressTab = 'judge' | 'errors' | 'path' | 'history';
const TAB_KEY = 'lx:progress-tab';
const TABS: ReadonlyArray<{ id: ProgressTab; label: MessageKey }> = [
  { id: 'judge', label: 'progJudge' },
  { id: 'errors', label: 'progErrors' },
  { id: 'path', label: 'progPath' },
  { id: 'history', label: 'progHistory' },
];
const isTab = (v: unknown): v is ProgressTab => TABS.some((x) => x.id === v);
const EMPTY = new Map<string, Record<string, unknown>>();

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

function Stat({ label, value, unit, testId }: { label: string; value: string; unit: string; testId: string }) {
  return (
    <div className="lx-glass flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] px-3 py-3 sm:px-4">
      {/* Nie mitten im Wort umbrechen (Befund H8): auf schmalen Bildschirmen enger gesetzt. */}
      <span className="lx-eyebrow whitespace-nowrap tracking-[0.02em] sm:tracking-[0.08em]">{label}</span>
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
      ? `Level ${assess.data.cefr ?? '?'}; skills ${assess.data.dims.map((d) => `${d.id}=${d.level ?? 'thin'}`).join(', ')}${assess.data.focus ? `; focus: ${assess.data.focus.action ?? assess.data.focus.title}` : ''}`
      : undefined,
  });

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item} className="flex flex-col gap-3">
        <p className="lx-eyebrow">{t('ovEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('ovTitle')}</h1>
        <p className="max-w-2xl text-base text-muted">{t('progLead')}</p>
      </motion.header>

      <motion.div variants={item} className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat label={t('streakLabel')} value={num(ov.streak.count)} unit={t(ov.streak.count === 1 ? 'streakUnit_one' : 'streakUnit_other')} testId="streak-count" />
        <Stat label={t('courseLabel')} value={num(ov.course.done)} unit={t('courseUnit', { total: ov.course.total })} testId="course-done" />
        <Stat label={t('vocabLabel')} value={num(ov.vocab.total)} unit={t(ov.vocab.total === 1 ? 'vocabUnit_one' : 'vocabUnit_other')} testId="vocab-total" />
      </motion.div>

      <LateRescueCard />

      <motion.div variants={item}>
        <Tabs label={t('progTabs')} items={TABS.map((x) => ({ id: x.id, label: t(x.label), testId: `tab-${x.id}` }))} value={tab} onChange={choose} testId="progress-tabs">
          {tab === 'judge' && <JudgeTab />}
          {tab === 'errors' && <ErrorsTab />}
          {tab === 'path' && <PathTab />}
          {tab === 'history' && <HistoryTab />}
        </Tabs>
      </motion.div>

      <motion.div variants={item}>
        <PreplyEntry />
      </motion.div>

      {ov.schema && ov.schema.migratedAt > 0 && (
        <motion.p variants={item} className="text-xs text-subtle">
          {t('migratedOn', { date: date(ov.schema.migratedAt) })}
        </motion.p>
      )}
    </motion.div>
  );
}
