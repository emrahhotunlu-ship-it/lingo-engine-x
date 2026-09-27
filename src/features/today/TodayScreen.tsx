import { motion } from 'framer-motion';
import { armShared } from '../../engine/shared';
import { useEffect, useMemo, useRef } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { ProgressRing } from '../../ui/ProgressRing';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useLive } from '../../data/live';
import { dayKeyNoon, legacyDayKey } from '../../domain/date';
import { lessonMeta } from '../../domain/course/catalog';
import { dutyChannelMinutes, dutyMinutes } from '../../domain/plan/buildPlan';
import { feasible, type FeasibleData } from '../../domain/plan/channels';
import { pflichtMarked } from '../../domain/plan/pflicht';
import type { DutyId, StoredPlan, WhyKey } from '../../domain/plan/types';
import type { Lang } from '../../app/settings';
import { actionLabel } from '../progress/actionRoute';
import { normGoalMin } from '../../domain/progress/settings';
import { maybeAutoAssess } from '../progress/assessRun';
import { logWarn } from '../../platform/diagnostics';
import type { ExecChannel } from '../../domain/learn/types';
import { computeStreak, pflichtDays } from '../../domain/streak';
import { mergeArchives } from '../../domain/capacity/compact';
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
import { PreplyTodayLine, usePreplyToday } from '../preply/TodayLine';
import { LateRescueHint } from '../migration/LateRescueCard';
import { checkAvailable, startCheck } from '../check/session';
import { toast } from '../../ui/Toast';
import { TitleActions } from '../system/Chrome';

// „Heute": beim Öffnen ist sofort klar, was dran ist (Kap. 2.1). Titelzeile mit Zähler, darunter
// EINE Pflichtliste; der erste offene Punkt ist aufgeklappt und trägt den einen großen Knopf.
// Erledigtes ist Zustand, kein Knopf (Kap. 2.2). Nach der Pflicht nur der Zustand, EIN Vorschlag
// und „Mehr üben →" (UX-Beratung 27.09., Nr. 1 und 5) – alles Weitere lebt in „Üben" und „Sprechen".

const EMPTY_ARCHIVE = new Map<string, Record<string, unknown>>();
let statusMarked = false;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

const CHANNEL_KEY: Record<string, MessageKey> = { gram: 'drGram', cloze: 'drCloze', order: 'drOrder', sprint: 'drSprint', dictate: 'drDictate', vocab: 'tdOfferVocab', say: 'sayTitle' };
const CHANNEL_ICON: Record<string, IconName> = { gram: 'grammar', cloze: 'link', order: 'grid', sprint: 'bolt', dictate: 'headphones', vocab: 'cards', say: 'chat' };
const CHANNEL_TONE: Record<string, Channel> = { gram: 'grammar', cloze: 'cards', order: 'grammar', sprint: 'write', dictate: 'listen', vocab: 'cards', say: 'speak' };
const DUTY_TONE = (id: DutyId): Channel => (id === 'review' ? 'cards' : id === 'lesson' ? 'read' : (CHANNEL_TONE[id.slice(3)] ?? 'grammar'));
const DUTY_ICON = (id: DutyId): IconName => (id === 'review' ? 'cards' : id === 'lesson' ? 'book' : (CHANNEL_ICON[id.slice(3)] ?? 'grammar'));

/** Begründung einer Planzeile (Schlüssel der alten App, D14; `whyFocus` mit Kennung ab Phase 6, E10). */
export function whyText(why: readonly WhyKey[] | undefined, t: (k: MessageKey, v?: Record<string, string | number>) => string, lang: Lang = 'de'): string {
  return (why ?? [])
    .map((w) => {
      if (w[0] === 'whyFocus' && typeof w[2] === 'string' && w[2]) return t('why_whyFocusRef', { topic: actionLabel(w[2], t, lang) });
      if (w[0] === 'whyDue' && w[2] === 'gram') return t('why_whyDueErrors', { n: w[1] ?? 0 });
      const key = `why_${w[0]}` as MessageKey;
      return w.length > 1 ? t(key, { n: w[1] as number }) : t(key);
    })
    .filter((s) => !s.startsWith('why_'))
    .join(' · ');
}

/** Grund einer Pflichtzeile: Kanal aus dem Plan, Wiederholen und Lektion aus dem eingefrorenen Plan. */
function dutyWhy(id: DutyId, plan: StoredPlan | null, t: (k: MessageKey, v?: Record<string, string | number>) => string, lang: Lang): { text: string; keys: string } {
  if (id === 'review') {
    const due = plan?.goal.due ?? 0;
    return due > 0 ? { text: t('why_whyDue', { n: due }), keys: 'whyDue' } : { text: t('why_whyReviewDaily'), keys: 'whyReviewDaily' };
  }
  if (id === 'lesson') return { text: t('tdLessonNext'), keys: 'lessonNext' };
  const why = plan?.why[0];
  return { text: whyText(why, t, lang) || t('why_whyRotation'), keys: (why ?? [['whyRotation']]).map((w) => w[0]).join(',') };
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
  const archive = useLive((s) => s.collections.archive) ?? EMPTY_ARCHIVE;
  const saveFailed = usePending((s) => s.failed);
  const tts = useSpeech((s) => s.status === 'ready');
  const state = useToday();
  const { ready, dayLoaded } = state;

  const streak = useMemo(() => {
    // Phase 7 (Plan §12.3): ausgelagerte Jahre zählen mit.
    const p = obj(mergeArchives(profile ? obj(profile) : null, archive.values()));
    const pflichtSince = typeof obj(schema).pflichtSince === 'string' ? (obj(schema).pflichtSince as string) : null;
    return computeStreak({
      days: obj(p.days) as Record<string, number>,
      xpDays: obj(p.xpDays) as Record<string, number>,
      pflichtSince,
      pflichtDone: pflichtDays(p.pflicht),
      today,
      legacyToday: legacyDayKey(now),
    });
  }, [profile, schema, today, now, archive]);

  // Selbstheilung (Regel 1): alles erledigt, aber `pflicht[heute]` fehlt noch.
  const marked = pflichtMarked(profile, today);
  useEffect(() => {
    if (ready && state.status === 'allDone' && !marked) void healToday();
  }, [ready, state.status, marked]);

  // Auslöser der Einschätzung (Plan W1): der Übergang zu „Pflicht erledigt" – einmal je Tab und
  // Lerntag, nur mit Grund (`assessDue`). Die Einschätzung selbst erscheint nie auf Heute (Kap. 2.1).
  // P7-1: Messpunkt „Statuszeile zeigt echte Daten" (Kap. 14: < 2 s), einmal je Laden der Seite.
  useEffect(() => {
    if (!ready || !dayLoaded || statusMarked) return;
    statusMarked = true;
    try {
      performance.mark('lx:status');
    } catch (err) {
      logWarn('perf:mark', err);
    }
  }, [ready, dayLoaded]);

  const seenOpen = useRef(false);
  useEffect(() => {
    if (!ready || !dayLoaded) return;
    if (state.status === 'open') seenOpen.current = true;
    else if (state.status === 'allDone' && seenOpen.current) {
      seenOpen.current = false;
      void maybeAutoAssess(Date.now());
    }
  }, [ready, dayLoaded, state.status]);
  const goalMin = normGoalMin(obj(profile).goalMin);

  const data: FeasibleData | null = useMemo(() => (ready && state.status !== 'open' ? feasibleData(drillCards(now), lang, now) : null), [ready, state.status, now, lang]);

  // Lerntag (Wechsel um 04:00), dieselbe Datumsfunktion wie der Plan: nachts gilt noch der Vortag.
  const dateLabel = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyNoon(today));
  const { done, total } = state.review;
  const left = Math.max(0, total - done);
  const pct = state.balance.answers ? Math.round((state.balance.correct / state.balance.answers) * 100) : 0;
  // Minuten gegen das Tagesziel ohne gehaltene Preply-Stunden (Extra, eigene Zeile darunter).
  const preplyToday = usePreplyToday();
  const learnMin = Math.max(0, state.balance.minutes - preplyToday.minutes);
  const hero = firstOpenDuty(state);
  const onlyReview = state.duties.total === 1 && state.duties.items[0]?.id === 'review';
  const lesson = plan?.lesson ? lessonMeta(plan.lesson) : null;

  const statusText = (): string => {
    if (state.status === 'allDone') return t('tdStatusDone');
    if (state.status === 'nothing') return t('tdStatusNothing');
    if (onlyReview) return tn('tdStatusOpen', left);
    return t('tdHeadMulti', { done: state.duties.done, total: state.duties.total });
  };

  // Wochen-Check (M10): Angebot nach der Pflicht, höchstens einmal je Kalenderwoche, erst mit
  // genug Übung (alte App: 40 Antworten). Zählt nie als Pflicht.
  const checkOffer = checkAvailable(profile, today) && Number(obj(profile).answers ?? 0) >= 40;
  const startWeekly = () => {
    unlockSpeech();
    const first = startCheck();
    if (first === 'empty') {
      toast(t('ckEmpty'));
      return;
    }
    if (first === 'typed') api.focusNow();
    go({ name: 'check' });
  };

  const extraRound = () => {
    unlockSpeech();
    const first = startSession('extra', { deck: 'all', size: 10 });
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
    return whyText(plan?.why[0], t, lang) || t('tdDutyChSub');
  };
  const heroTitle = (id: DutyId): string => {
    if (id === 'review') return t('tdReviewTitle');
    if (id === 'lesson') return lesson ? t('tdDutyLesson', { title: lang === 'de' ? lesson.de : lesson.en }) : t('lrDutyLesson');
    return t('tdDutyCh', { channel: dutyLabel(id, t), min: dutyChannelMinutes(id.slice(3)) });
  };

  const ok = ready && dayLoaded;
  const done3 = state.status === 'allDone' || state.status === 'nothing';
  // Nach der Pflicht (UX-Beratung Nr. 1): EIN Vorschlag – die größte Lücke laut Plan, sonst eine freie Vokabelrunde.
  const suggestion = offers[0] ?? null;

  const dutyRow = (d: (typeof state.duties.items)[number]) => {
    const why = d.state === 'open' && !onlyReview ? dutyWhy(d.id, plan, t, lang) : null;
    const isHero = d.state === 'open' && d.id === hero;
    if (isHero) {
      return (
        <li key={d.id} data-testid={onlyReview ? undefined : 'duty'} data-duty={d.id} data-state="open" className="p-4 sm:p-5">
          <div data-testid="hero" data-duty={d.id} className="flex flex-col gap-4" onClickCapture={(e) => armShared('lx-hero', e.currentTarget)}>
            <div className="flex items-start gap-3">
              <ChannelIcon channel={DUTY_TONE(d.id)}>
                <Icon name={DUTY_ICON(d.id)} />
              </ChannelIcon>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id="td-hero" className="text-lg font-semibold tracking-tight">
                  {heroTitle(d.id)}
                  <span className="sr-only"> · {t('tdDutyOpen')}</span>
                </h2>
                <p className="text-sm text-muted" data-testid="hero-sub">
                  {heroSub(d.id)}
                </p>
                {why && (
                  <p className="text-xs text-subtle" data-testid="reason" data-why={why.keys}>
                    {why.text}
                  </p>
                )}
              </div>
              {d.id === 'review' && <ProgressRing value={total ? done / total : 0} size={48} label={t('tdProgressLabel', { done, total })} />}
            </div>
            <div>
              <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => startDuty(d.id, api)} data-testid="start">
                {d.id === 'review' && done > 0 ? t('tdContinue') : t('tdStart')}
              </Button>
            </div>
          </div>
        </li>
      );
    }
    return (
      <li key={d.id} data-testid="duty" data-duty={d.id} data-state={d.state} className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span className={`inline-flex size-6 flex-none items-center justify-center rounded-full border ${d.state === 'done' ? 'border-transparent bg-accent-soft text-accent-text' : 'border-line text-subtle'}`} aria-hidden="true">
          {d.state === 'done' && <Icon name="check" size={14} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`text-sm font-medium ${d.state === 'done' ? 'text-muted' : ''}`}>{dutyLabel(d.id, t)}</span>
          {d.id === 'review' && d.progress && d.state === 'open' && (
            <span className="lx-tnum text-xs text-muted">{t('tdProgressLabel', { done: d.progress.done, total: d.progress.total })}</span>
          )}
          {why && (
            <span className="text-xs text-subtle" data-testid="reason" data-why={why.keys}>
              {why.text}
            </span>
          )}
        </span>
        <span className="flex-none text-xs text-muted">{d.state === 'done' ? t('tdDutyDone') : t('tdDutyOpen')}</span>
      </li>
    );
  };

  return (
    <motion.div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 sm:py-10" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
      <motion.header variants={item} className="flex flex-col gap-1">
        <div className="flex min-h-11 items-center justify-between gap-3">
          {planStatus === 'error' ? (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('navToday')}</h1>
          ) : ok ? (
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="today-status" data-status={state.status} data-done={state.duties.done} data-total={state.duties.total}>
              {statusText()}
            </h1>
          ) : (
            <div role="status" aria-label={t('tdLoading')}>
              <Skeleton className="h-9 w-56 max-w-full" />
            </div>
          )}
          <TitleActions />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="whitespace-nowrap" data-testid="today-date" data-day={today}>
            {dateLabel}
          </span>
          {ok && plan && state.status === 'open' && state.duties.total > 1 && (
            <span className="whitespace-nowrap">
              <span aria-hidden="true">· </span>
              <span className="lx-tnum" data-testid="duty-minutes">
                {t('tdMinutesShort', { min: dutyMinutes(plan) })}
              </span>
            </span>
          )}
          <span className="whitespace-nowrap">
            <span aria-hidden="true">· </span>
            <span className="lx-tnum" data-testid="today-streak">
              {tn('tdStreak', streak.count)}
            </span>
          </span>
        </p>
        {planStatus === 'error' && (
          <div role="alert" className="mt-3 flex flex-col items-start gap-3" data-testid="plan-error">
            <p className="text-base text-muted">{t('tdPlanError')}</p>
            <Button onClick={() => retryPlan(Date.now())} icon="refresh">
              {t('tdPlanRetry')}
            </Button>
          </div>
        )}
      </motion.header>

      {/* Offen (UX-Beratung Nr. 5): EINE Liste; der erste offene Punkt ist aufgeklappt und trägt den einen großen Knopf (Kap. 2.1). */}
      {ok && state.status === 'open' && state.duties.total > 0 && (
        <motion.ul variants={item} className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]" aria-label={t('tdPflicht')} data-testid="duties">
          {state.duties.items.map(dutyRow)}
        </motion.ul>
      )}

      {/* Fertig (UX-Beratung Nr. 1): nur der Zustand in einer Zeile – erledigt ist Zustand, kein Knopf (Kap. 2.2). */}
      {ok && state.status === 'allDone' && state.duties.total > 0 && (
        <motion.ul variants={item} className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t('tdPflicht')} data-testid="duties">
          {state.duties.items.map((d) => (
            <li key={d.id} data-testid={onlyReview ? 'done-item' : 'duty'} data-duty={d.id} data-state={d.state} className="flex items-center gap-1.5 text-sm text-muted">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
              {d.id === 'review' && onlyReview ? t('tdDoneItem', { total }) : dutyLabel(d.id, t)}
              <span className="sr-only"> · {t('tdDutyDone')}</span>
            </li>
          ))}
        </motion.ul>
      )}

      {/* Nach der Pflicht: ein Vorschlag, „Mehr üben →" und – falls fällig – der Wochen-Check. Alles Extra (Kap. 2.6). */}
      {ok && done3 && (
        <motion.section variants={item} aria-labelledby="td-extra" className="flex flex-col gap-3" data-testid="extra">
          <p id="td-extra" className="lx-eyebrow">
            {t('tdNextWorth')}
          </p>
          {suggestion ? (
            <button type="button" onClick={() => startOffer(suggestion.id)} data-testid="offer" data-channel={suggestion.id} className="lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong">
              <ChannelIcon channel={CHANNEL_TONE[suggestion.id] ?? 'grammar'}>
                <Icon name={CHANNEL_ICON[suggestion.id] ?? 'grammar'} />
              </ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{t(CHANNEL_KEY[suggestion.id] as MessageKey)}</span>
                <span className="text-sm text-muted" data-testid="offer-why">
                  <span data-testid="reason" data-why={(suggestion.why ?? [['whyRotation']]).map((w) => w[0]).join(',')}>
                    {whyText(suggestion.why, t, lang) || t('why_whyRotation')}
                  </span>
                </span>
              </span>
              <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
            </button>
          ) : (
            <button type="button" onClick={extraRound} data-testid="offer" data-channel="vocab" className="lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong">
              <ChannelIcon channel="cards">
                <Icon name="cards" />
              </ChannelIcon>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{t('tdFreeRound')}</span>
                <span className="text-sm text-muted" data-testid="offer-why">
                  {t('tdFreeRoundSub')}
                </span>
              </span>
              <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
            </button>
          )}
          {checkOffer && (
            <button type="button" onClick={startWeekly} data-testid="check-offer" className="flex min-h-12 w-full items-center gap-3 text-left text-sm">
              <Icon name="target" size={18} className="flex-none text-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{t('ckTitle')}</span>
                <span className="text-muted">{t('ckOfferSub')}</span>
              </span>
              <span className="flex-none font-medium text-accent-text" data-testid="check-offer-start">
                {t('ckStart')}
              </span>
            </button>
          )}
          <div>
            <button type="button" onClick={() => go({ name: 'learn' })} data-testid="more-practice" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-text hover:underline">
              {t('tdMorePractice')}
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
        </motion.section>
      )}

      {dayLoaded && (state.balance.answers > 0 || state.extra > 0) && (
        <motion.p variants={item} className="lx-tnum text-sm text-muted" data-testid="balance">
          {state.balance.answers > 0 && tn('tdBalance', state.balance.answers, { answers: state.balance.answers, pct, min: learnMin, goal: goalMin })}
          {state.balance.answers > 0 && state.extra > 0 && ' · '}
          {state.extra > 0 && tn('tdExtraCount', state.extra)}
        </motion.p>
      )}

      {/* Phase 5: gehaltene Preply-Stunde als Extra (Zustand, zählt nicht zu „x von y"). */}
      {dayLoaded && <PreplyTodayLine />}

      {/* W5 (A7): Kopien der alten App in diesem Browser – eine leise Zeile, keine konkurrierende Karte. */}
      {dayLoaded && <LateRescueHint />}

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
