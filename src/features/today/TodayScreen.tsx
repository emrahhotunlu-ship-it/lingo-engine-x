import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card, ChannelIcon } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { ProgressRing } from '../../ui/ProgressRing';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useLive } from '../../data/live';
import { legacyDayKey } from '../../domain/date';
import { deriveToday, mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { computeStreak, pflichtDays } from '../../domain/streak';
import { useHiddenInput } from '../../engine/HiddenInput';
import { flush, usePending } from '../vocab/persist';
import { startSession, type Round } from '../vocab/session';
import { unlockSpeech } from '../../platform/speech';
import { retryPlan, useTodayPlan } from './store';

// „Heute": beim Öffnen ist sofort klar, was dran ist (Kap. 2.1). Eine Statuszeile, EIN großer
// Knopf; Erledigtes ist Zustand, kein Knopf (Kap. 2.2). Freiwilliges steht klar getrennt als Extra.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const EMPTY: DayEntry[] = [];

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export function TodayScreen() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const plan = useTodayPlan((s) => (s.day === today ? s.plan : null));
  const planStatus = useTodayPlan((s) => (s.day === today ? s.status : 'idle'));
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const day = useLive((s) => s.day);
  const pendingEntries = usePending((s) => s.entries);
  const pendingMinutes = usePending((s) => s.minutes[today] ?? 0);
  const saveFailed = usePending((s) => s.failed);

  const liveEntries = day?.key === today && day.doc && Array.isArray(day.doc.entries) ? (day.doc.entries as DayEntry[]) : EMPTY;
  const dayLoaded = day?.key === today && day.doc !== undefined;
  const state = useMemo(() => {
    const entries = mergeEntries(
      liveEntries,
      pendingEntries.filter((e) => e.day === today),
    );
    const minutes = Number(obj(obj(profile).minutes)[today] ?? 0) + pendingMinutes;
    return deriveToday({ day: today, plan, entries, minutes: Number.isFinite(minutes) ? minutes : 0 });
  }, [liveEntries, pendingEntries, pendingMinutes, today, plan, profile]);

  const streak = useMemo(() => {
    const p = obj(profile);
    const pflichtSince = typeof obj(schema).pflichtSince === 'string' ? (obj(schema).pflichtSince as string) : null;
    return computeStreak({
      days: obj(p.days) as Record<string, number>,
      xpDays: obj(p.xpDays) as Record<string, number>,
      pflichtSince,
      pflichtDone: pflichtDays(p.pflicht),
      today,
      legacyToday: legacyDayKey(now),
    });
  }, [profile, schema, today, now]);

  const start = (round: Round) => {
    // iPhone: Sprachausgabe nur in einer Nutzergeste freischalten.
    unlockSpeech();
    const first = startSession(round);
    // iPhone: die Tastatur öffnet nur synchron in der Nutzergeste.
    if (first === 'typed') api.focusNow();
    go({ name: 'trainer', round });
  };

  const ready = planStatus === 'ready' || planStatus === 'local';
  const dateLabel = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const { done, total } = state.review;
  const left = Math.max(0, total - done);
  const pct = state.balance.answers ? Math.round((state.balance.correct / state.balance.answers) * 100) : 0;

  return (
    <motion.div className="flex flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item} className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{dateLabel}</span>
          <span className="lx-tnum" data-testid="today-streak">
            {tn('tdStreak', streak.count)}
          </span>
        </p>
        {planStatus === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3" data-testid="plan-error">
            <p className="text-base text-muted">{t('tdPlanError')}</p>
            <Button onClick={() => retryPlan(Date.now())} icon="refresh">
              {t('tdPlanRetry')}
            </Button>
          </div>
        ) : ready && dayLoaded ? (
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="today-status" data-status={state.status}>
            {state.status === 'allDone'
              ? t('tdStatusDone')
              : state.status === 'nothing'
                ? t('tdStatusNothing')
                : t('tdStatusOpen', { done, total })}
          </h1>
        ) : (
          <div role="status" aria-label={t('tdLoading')}>
            <Skeleton className="h-9 w-72 max-w-full" />
          </div>
        )}
      </motion.header>

      {ready && dayLoaded && state.status === 'open' && (
        <motion.div variants={item}>
          <Card channel="cards" aria-labelledby="td-review" data-testid="hero">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="lx-eyebrow">{t('tdPflicht')}</p>
                <h2 id="td-review" className="text-xl font-semibold tracking-tight">
                  {t('tdReviewTitle')}
                </h2>
                <p className="text-sm text-muted">{tn('tdReviewWhy', total, { min: Math.max(1, Math.ceil(left * 0.45)) })}</p>
              </div>
              <ProgressRing value={total ? done / total : 0} size={56} label={t('tdProgressLabel', { done, total })} />
            </div>
            <div className="mt-5">
              <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => start('pflicht')} data-testid="start">
                {done > 0 ? t('tdContinue', { n: left }) : t('tdStart')}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {ready && dayLoaded && state.status === 'allDone' && (
        <motion.ul variants={item} className="flex flex-col gap-3">
          <li data-state="done" data-testid="done-item" className="lx-glass flex items-center gap-3 rounded-[var(--radius-card)] p-5">
            <ChannelIcon channel="cards">
              <Icon name="check" />
            </ChannelIcon>
            <span className="text-base font-medium">{t('tdDoneItem', { total })}</span>
          </li>
        </motion.ul>
      )}

      {ready && dayLoaded && (state.status === 'allDone' || state.status === 'nothing') && (
        <motion.section variants={item} aria-labelledby="td-extra" className="flex flex-col gap-2 border-t border-line pt-5" data-testid="extra">
          <p id="td-extra" className="lx-eyebrow">
            {t('tdExtraTitle')}
          </p>
          <p className="text-sm text-muted">{t('tdExtraHint')}</p>
          <div>
            <Button variant="secondary" icon="plus" onClick={() => start('extra')} data-testid="start-extra">
              {t('tdExtraStart')}
            </Button>
          </div>
        </motion.section>
      )}

      {dayLoaded && (state.balance.answers > 0 || state.extra > 0) && (
        <motion.p variants={item} className="lx-tnum text-sm text-muted" data-testid="balance">
          {state.balance.answers > 0 && tn('tdBalance', state.balance.answers, { answers: state.balance.answers, pct, min: state.balance.minutes })}
          {state.balance.answers > 0 && state.extra > 0 && ' · '}
          {state.extra > 0 && tn('tdExtraCount', state.extra)}
        </motion.p>
      )}

      {saveFailed && (
        <motion.div variants={item} className="flex flex-wrap items-center gap-3 text-sm text-danger-text" role="alert">
          <span>{t('tdNotSaved')}</span>
          <Button onClick={() => void flush()} icon="refresh">
            {t('tdRetrySave')}
          </Button>
        </motion.div>
      )}
      {planStatus === 'local' && (
        <motion.p variants={item} className="text-xs text-subtle">
          {t('tdLocalPlan')}
        </motion.p>
      )}
    </motion.div>
  );
}
