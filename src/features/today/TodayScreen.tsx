import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card, ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { ProgressRing } from '../../ui/ProgressRing';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useLive } from '../../data/live';
import { legacyDayKey } from '../../domain/date';
import { lessonMeta } from '../../domain/course/catalog';
import { dutyMinutes } from '../../domain/plan/buildPlan';
import { feasible, type FeasibleData } from '../../domain/plan/channels';
import { pflichtMarked } from '../../domain/plan/pflicht';
import type { DutyId, WhyKey } from '../../domain/plan/types';
import type { ExecChannel } from '../../domain/learn/types';
import { DECKS, DECK_SIZES, type Deck } from '../../domain/srs/vocabList';
import { computeStreak, pflichtDays } from '../../domain/streak';
import { useHiddenInput } from '../../engine/HiddenInput';
import { flush, usePending } from '../progress/persist';
import { startSession } from '../vocab/session';
import { startGrammar } from '../grammar/session';
import { drillCards, startDrill } from '../drills/session';
import { startDuty } from '../learn/flow';
import { dutyLabel } from '../learn/ui';
import { unlockSpeech, useSpeech } from '../../platform/speech';
import { firstOpenDuty, useToday } from './state';
import { feasibleData, healToday, retryPlan, useTodayPlan } from './store';
import { TodayOffers } from '../speak/TodayOffers';

// „Heute": beim Öffnen ist sofort klar, was dran ist (Kap. 2.1). Eine Statuszeile, EIN großer
// Knopf (erster offener Pflichtpunkt); Erledigtes ist Zustand, kein Knopf (Kap. 2.2). Angebote
// erscheinen erst, wenn die Pflicht erledigt ist – mit Grund, klar als Extra (Kap. 2.6).

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

const CHANNEL_KEY: Record<string, MessageKey> = { gram: 'drGram', cloze: 'drCloze', order: 'drOrder', sprint: 'drSprint', dictate: 'drDictate', vocab: 'tdOfferVocab' };
const CHANNEL_ICON: Record<string, IconName> = { gram: 'grammar', cloze: 'link', order: 'grid', sprint: 'bolt', dictate: 'headphones', vocab: 'cards' };
const CHANNEL_TONE: Record<string, Channel> = { gram: 'grammar', cloze: 'cards', order: 'grammar', sprint: 'write', dictate: 'listen', vocab: 'cards' };
const DUTY_TONE = (id: DutyId): Channel => (id === 'review' ? 'cards' : id === 'lesson' ? 'read' : (CHANNEL_TONE[id.slice(3)] ?? 'grammar'));
const DUTY_ICON = (id: DutyId): IconName => (id === 'review' ? 'cards' : id === 'lesson' ? 'book' : (CHANNEL_ICON[id.slice(3)] ?? 'grammar'));
const DECK_KEY: Record<Deck, MessageKey> = { all: 'tdDeckAll', hard: 'tdDeckHard', job: 'tdDeckJob', phrases: 'tdDeckPhrases' };

/** Begründung einer Planzeile (Schlüssel der alten App, D14). */
export function whyText(why: readonly WhyKey[] | undefined, t: (k: MessageKey, v?: Record<string, string | number>) => string): string {
  return (why ?? [])
    .map((w) => {
      const key = `why_${w[0]}` as MessageKey;
      return w.length > 1 ? t(key, { n: w[1] as number }) : t(key);
    })
    .filter((s) => !s.startsWith('why_'))
    .join(' · ');
}

export function TodayScreen() {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const planStatus = useTodayPlan((s) => (s.day === today ? s.status : 'idle'));
  const plan = useTodayPlan((s) => (s.day === today ? s.plan : null));
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const saveFailed = usePending((s) => s.failed);
  const tts = useSpeech((s) => s.status === 'ready');
  const state = useToday();
  const { ready, dayLoaded } = state;
  const [deck, setDeck] = useState<Deck>('all');
  const [size, setSize] = useState<(typeof DECK_SIZES)[number]>(10);

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

  // Selbstheilung (Regel 1): alles erledigt, aber `pflicht[heute]` fehlt noch.
  const marked = pflichtMarked(profile, today);
  useEffect(() => {
    if (ready && state.status === 'allDone' && !marked) void healToday();
  }, [ready, state.status, marked]);

  const data: FeasibleData | null = useMemo(() => (ready && state.status !== 'open' ? feasibleData(drillCards(now), lang, now) : null), [ready, state.status, now, lang]);

  const dateLabel = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const { done, total } = state.review;
  const left = Math.max(0, total - done);
  const pct = state.balance.answers ? Math.round((state.balance.correct / state.balance.answers) * 100) : 0;
  const hero = firstOpenDuty(state);
  const onlyReview = state.duties.total === 1 && state.duties.items[0]?.id === 'review';
  const lesson = plan?.lesson ? lessonMeta(plan.lesson) : null;

  const statusText = (): string => {
    if (state.status === 'allDone') return t('tdStatusDone');
    if (state.status === 'nothing') return t('tdStatusNothing');
    if (onlyReview) return tn('tdStatusOpen', left);
    return t('tdStatusMulti', { done: state.duties.done, total: state.duties.total, missing: state.duties.missing.map((d) => dutyLabel(d, t)).join(', ') });
  };

  const extraRound = () => {
    unlockSpeech();
    const first = startSession('extra', { deck, size });
    if (first === 'typed') api.focusNow();
    go({ name: 'trainer', round: 'extra' });
  };

  const startOffer = (id: string) => {
    unlockSpeech();
    if (id === 'vocab') return extraRound();
    if (id === 'gram') {
      const first = startGrammar({ mode: 'xtra' });
      if (first === 'typed') api.focusNow();
      go({ name: 'grammarSession', mode: 'xtra' });
      return;
    }
    const kind = id as 'cloze' | 'order' | 'dictate' | 'sprint';
    const first = startDrill(kind);
    if (first === 'typed') api.focusNow();
    go({ name: 'drill', kind, ctx: 'xtra' });
  };

  const offers = (plan?.ids.slice(1) ?? [])
    .map((id, i) => ({ id, why: plan?.why[i + 1] }))
    .filter((o) => CHANNEL_KEY[o.id] && (!data || feasible(o.id as ExecChannel, data, { tts })));

  const heroSub = (id: DutyId): string => {
    if (id === 'review') {
      const min = Math.max(1, Math.ceil(left * 0.45));
      return done > 0 ? t('tdReviewProgress', { done, total, min }) : t('tdReviewEta', { min });
    }
    if (id === 'lesson') return lesson ? t('tdDutyLessonSub', { cando: lang === 'de' ? lesson.cando_de : lesson.cando_en }) : t('tdLessonNext');
    return whyText(plan?.why[0], t) || t('tdDutyChSub');
  };
  const heroTitle = (id: DutyId): string => {
    if (id === 'review') return t('tdReviewTitle');
    if (id === 'lesson') return lesson ? t('tdDutyLesson', { title: lang === 'de' ? lesson.de : lesson.en }) : t('lrDutyLesson');
    return t('tdDutyCh', { channel: dutyLabel(id, t), min: 5 });
  };

  return (
    <motion.div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="today-status" data-status={state.status} data-done={state.duties.done} data-total={state.duties.total}>
            {statusText()}
          </h1>
        ) : (
          <div role="status" aria-label={t('tdLoading')}>
            <Skeleton className="h-9 w-72 max-w-full" />
          </div>
        )}
      </motion.header>

      {ready && dayLoaded && state.status === 'open' && hero && (
        <motion.div variants={item}>
          <Card channel={DUTY_TONE(hero)} aria-labelledby="td-hero" data-testid="hero" data-duty={hero}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="lx-eyebrow">{t('tdPflicht')}</p>
                <h2 id="td-hero" className="text-xl font-semibold tracking-tight">
                  {heroTitle(hero)}
                </h2>
                <p className="text-sm text-muted" data-testid="hero-sub">
                  {heroSub(hero)}
                </p>
              </div>
              {hero === 'review' && <ProgressRing value={total ? done / total : 0} size={56} label={t('tdProgressLabel', { done, total })} />}
            </div>
            <div className="mt-5">
              <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => startDuty(hero, api)} data-testid="start">
                {hero === 'review' && done > 0 ? t('tdContinue') : t('tdStart')}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {ready && dayLoaded && state.duties.total > 0 && (!onlyReview || state.status === 'allDone') && (
        <motion.ul variants={item} className="flex flex-col gap-2" aria-label={t('tdPflicht')} data-testid="duties">
          {state.duties.items.map((d) => (
            <li
              key={d.id}
              data-testid={onlyReview ? 'done-item' : 'duty'}
              data-duty={d.id}
              data-state={d.state}
              className={`lx-glass flex items-center gap-3 rounded-[var(--radius-card)] p-4 ${d.state === 'done' ? '' : 'opacity-80'}`}
            >
              <ChannelIcon channel={DUTY_TONE(d.id)}>
                <Icon name={d.state === 'done' ? 'check' : DUTY_ICON(d.id)} />
              </ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium">{d.id === 'review' && onlyReview ? t('tdDoneItem', { total }) : dutyLabel(d.id, t)}</span>
                {d.id === 'review' && d.progress && !onlyReview && (
                  <span className="lx-tnum text-sm text-muted">{t('tdProgressLabel', { done: d.progress.done, total: d.progress.total })}</span>
                )}
              </span>
              <span className="text-sm text-muted">{d.state === 'done' ? t('tdDutyDone') : t('tdDutyOpen')}</span>
            </li>
          ))}
        </motion.ul>
      )}

      {ready && dayLoaded && plan && state.status !== 'allDone' && state.duties.total > 1 && (
        <motion.p variants={item} className="text-xs text-subtle" data-testid="duty-minutes">
          {t('tdDutyMinutes', { min: dutyMinutes(plan) })}
        </motion.p>
      )}

      {ready && dayLoaded && (state.status === 'allDone' || state.status === 'nothing') && (
        <motion.section variants={item} aria-labelledby="td-extra" className="flex flex-col gap-4 border-t border-line pt-5" data-testid="extra">
          <div className="flex flex-col gap-1">
            <p id="td-extra" className="lx-eyebrow">
              {t('tdExtraTitle')}
            </p>
            <p className="text-sm text-muted">{t('tdExtra')}</p>
          </div>
          {offers.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {offers.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => startOffer(o.id)} data-testid="offer" data-channel={o.id} className="lx-glass flex w-full items-center gap-3 rounded-[var(--radius-card)] p-4 text-left hover:bg-surface-strong">
                    <ChannelIcon channel={CHANNEL_TONE[o.id] ?? 'grammar'}>
                      <Icon name={CHANNEL_ICON[o.id] ?? 'grammar'} />
                    </ChannelIcon>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{t(CHANNEL_KEY[o.id] as MessageKey)}</span>
                      <span className="text-sm text-muted" data-testid="offer-why">
                        {whyText(o.why, t) || t('why_whyRotation')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-4" data-testid="free-round">
            <p className="text-sm font-medium">{t('tdFreeRound')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('tdDeck')}>
              {DECKS.map((d) => (
                <button key={d} type="button" className="lx-chip" aria-pressed={deck === d} onClick={() => setDeck(d)} data-testid="deck" data-deck={d}>
                  {t(DECK_KEY[d])}
                </button>
              ))}
            </div>
            <div className="max-w-xs">
              <Segmented label={t('tdDeckSize')} value={String(size) as '10' | '20' | '30'} options={DECK_SIZES.map((n) => ({ value: String(n) as '10' | '20' | '30', label: String(n) }))} onChange={(v) => setSize(Number(v) as (typeof DECK_SIZES)[number])} />
            </div>
            <div>
              <Button variant="secondary" icon="plus" onClick={extraRound} data-testid="start-extra">
                {t('tdExtraStart')}
              </Button>
            </div>
          </div>
        </motion.section>
      )}

      {/* Sprechen und Business (Phase 3) sind Angebote: erst nach der Pflicht (Kap. 2.1, 2.6). */}
      {ready && dayLoaded && (state.status === 'allDone' || state.status === 'nothing') && <TodayOffers />}

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
