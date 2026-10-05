import { motion } from 'framer-motion';
import { checkAvailable, startCheck } from '../check/session';
import { comebackBand, comebackGap, lastReturn, RESTART_DAYS, RESTART_GAP } from '../../domain/plan/comeback';
import { cardStats } from '../../domain/plan/dayStats';
import { dowOf, unitPlanFor } from '../../domain/unit/planFor';
import { toast } from '../../ui/Toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import { armShared } from '../../engine/shared';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Eyebrow } from '../../ui/Eyebrow';
import { HeroCard } from '../../ui/HeroCard';
import { ChannelIcon, type Channel } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKeyNoon, addDays } from '../../domain/date';
import { dutyChannelMinutes, dutyMinutes } from '../../domain/plan/buildPlan';
import { feasible, rankChannels } from '../../domain/plan/channels';
import { pflichtMarked } from '../../domain/plan/pflicht';
import type { DutyId, StoredPlan, WhyKey } from '../../domain/plan/types';
import type { Lang } from '../../app/settings';
import { actionLabel } from '../progress/actionRoute';
import { maybeAutoAssess } from '../progress/assessRun';
import { logWarn } from '../../platform/diagnostics';
import { useStreakCount } from '../../app/shell/useStreak';
import { isoWeek } from '../../domain/date';
import { KEY_PREFIX, local } from '../../platform/storage';
import { useDoneFacts } from './doneFacts';
import { useHiddenInput } from '../../engine/HiddenInput';
import { flush, usePending } from '../progress/persist';
import { startSession } from '../vocab/session';
import { startGrammar } from '../grammar/session';
import { drillCards, startDrill } from '../drills/session';
import { startDuty } from '../learn/flow';
import { dutyLabel } from '../learn/ui';
import { unlockSpeech, useSpeech } from '../../platform/speech';
import { firstOpenDuty, useToday, type TodayView } from './state';
import { feasibleData, healToday, retryPlan } from './store';
import { TabTitle } from '../system/Chrome';
import { unitRows, minutesLeft, type UnitRow } from '../../domain/unit/rows';
import { isUnitPlan, unitPlanOf } from '../../domain/unit/plan';
import type { UnitBlock } from '../../domain/unit/types';
import { assessPlanInput } from '../../domain/assessment/planInput';
import { dueErrors } from '../../domain/grammar/errors';
import { dueCards } from '../../domain/srs/queue';
import { buildTrainCards } from '../../domain/srs/cards';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { startUnit } from '../unit/run';
import { blockName, blockWhy } from '../unit/labels';
import { lessonMeta } from '../../domain/course/catalog';

// „Heute" (plan.md §1.3): die rote Linie. Unterzeile mit Datum und Serie, darunter EINE
// Tageskarte – „Deine Tageseinheit“ mit Ring „2 von 5 · noch ca. 18 Min.“, Kernaufgabe der Woche,
// Blockliste (Name, Grund, Minuten, Zustand) und EIN Knopf. Erledigtes ist Zustand (Kap. 2.2).
// Nach der Pflicht: Fertig-Karte mit Bilanz (Zustand, kein Knopf), EINE Zeile „Lohnt sich jetzt“
// und ein leiser Verweis „Mehr üben ›“. Alles andere lebt in den Reitern.

let statusMarked = false;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

const CHANNEL_KEY: Record<string, MessageKey> = {
  gram: 'drGram',
  cloze: 'drCloze',
  order: 'drOrder',
  sprint: 'drSprint',
  dictate: 'drDictate',
  vocab: 'tdOfferVocab',
};
const CHANNEL_ICON: Record<string, IconName> = {
  gram: 'grammar',
  cloze: 'link',
  order: 'grid',
  sprint: 'bolt',
  dictate: 'headphones',
  vocab: 'cards',
};
const CHANNEL_TONE: Record<string, Channel> = {
  gram: 'grammar',
  cloze: 'cards',
  order: 'grammar',
  sprint: 'write',
  dictate: 'listen',
  vocab: 'cards',
};

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

/** Begründung einer Planzeile (Schlüssel der alten App, D14; `whyFocus` mit Kennung ab Phase 6, E10). */
export function whyText(why: readonly WhyKey[] | undefined, t: T, lang: Lang = 'de'): string {
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

/** Fokus-Aktion der Einschätzung (`grammar:<topic>`, `colloc` …), nur bei passender Sprache (B6). */
function focusAction(assess: Record<string, unknown> | null | undefined, lang: Lang): string | null {
  if (!assess) return null;
  if (typeof assess.lang === 'string' && assess.lang !== lang) return null;
  const data = assess.data && typeof assess.data === 'object' ? (assess.data as Record<string, unknown>) : assess;
  const focus = data.focus && typeof data.focus === 'object' ? (data.focus as Record<string, unknown>) : null;
  return typeof focus?.action === 'string' ? focus.action.trim() || null : null;
}

/** Eine Zeile der Tageskarte (Einheit oder – am Übergangstag – ein Pflichtpunkt des alten Plans). */
type CardRow = {
  id: DutyId;
  name: string;
  why: string;
  whyKey: string;
  min: number;
  state: UnitRow['state'];
  progress: UnitRow['progress'];
};

/** Zeilen eines Plans von Phase 1/2 (gilt nach einem Update noch bis 04:00, Kap. 15). */
function legacyRows(plan: StoredPlan, items: TodayView['duties']['items'], t: T, lang: Lang): CardRow[] {
  let now = false;
  return items.map((d): CardRow => {
    const state: CardRow['state'] = d.state === 'done' ? 'done' : now ? 'open' : 'now';
    if (d.state !== 'done') now = true;
    let why: string;
    let whyKey: string;
    if (d.id === 'review') {
      why = plan.goal.due ? t('why_whyDue', { n: plan.goal.due }) : t('why_whyReviewDaily');
      whyKey = plan.goal.due ? 'whyDue' : 'whyReviewDaily';
    } else if (d.id === 'lesson') {
      const l = plan.lesson ? lessonMeta(plan.lesson) : null;
      why = l ? (lang === 'de' ? l.de : l.en) : t('tdLessonNext');
      whyKey = 'lessonNext';
    } else {
      why = whyText(plan.why[0], t, lang) || t('why_whyRotation');
      whyKey = (plan.why[0] ?? [['whyRotation']]).map((w) => w[0]).join(',');
    }
    const min = d.id === 'review' ? 10 : d.id === 'lesson' ? 12 : dutyChannelMinutes(d.id.slice(3));
    return {
      id: d.id,
      name: dutyLabel(d.id, t),
      why,
      whyKey,
      min,
      state,
      progress: d.progress,
    };
  });
}

function TodaySubline({ today, lang }: { today: string; lang: Lang }) {
  // Lerntag (Wechsel um 04:00), dieselbe Datumsfunktion wie der Plan: nachts gilt noch der Vortag. Keine Serie hier (Gesamtkonzept 3.1).
  const dateLabel = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dayKeyNoon(today));
  return (
    <div className="flex flex-col gap-0.5 text-sm text-muted">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="whitespace-nowrap" data-testid="today-date" data-day={today}>
          {dateLabel}
        </span>
      </p>
    </div>
  );
}

/** Serie im Fuß der Tageskarte: nur ab 1 Tag, nach einer Pause nichts (Gesamtkonzept 3.1, „Serie 0“ nie). Die einzige Stelle auf Heute. */
function StreakFoot() {
  const { tn } = useT();
  const streak = useStreakCount();
  if (streak === null || streak < 1) return null;
  return (
    <p className="lx-tnum text-xs text-muted" data-testid="today-streak">
      {tn('tdStreak', streak)}
    </p>
  );
}

function BlockDot({ state }: { state: CardRow['state'] }) {
  if (state === 'done')
    return (
      <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
    );
  return <span className={`inline-flex size-6 flex-none items-center justify-center rounded-full border-2 ${state === 'now' ? 'border-accent' : 'border-line'}`} aria-hidden="true" />;
}

/** Start der Tageseinheit (Tageskarte und Willkommens-Karte): der erste offene Block, sonst der alte Weg. SYNCHRON im Klick (iPhone-Tastatur). */
function useStartUnit(view: TodayView): () => void {
  const api = useHiddenInput();
  return () => {
    unlockSpeech();
    if (startUnit(api)) return;
    const id = firstOpenDuty(view);
    if (id) startDuty(id, api);
  };
}

/** Die Tageskarte (offen): Ring, Kernaufgabe, Blockliste und der EINE Knopf. `fixNone`: „Fehler korrigieren“ entfällt, weil nichts fällig ist. */
function UnitCard({ view, rows, title, minLeft, fixNone }: { view: TodayView; rows: CardRow[]; title: string; minLeft: number; fixNone: boolean }) {
  const { t } = useT();
  const done = view.duties.done;
  const total = view.duties.total;
  const now = rows.find((r) => r.state === 'now') ?? null;
  const start = useStartUnit(view);
  return (
    <section
      className="lx-card flex flex-col gap-3.5 p-[1.125rem]"
      aria-labelledby="td-unit-title"
      data-testid="today-card"
      data-shape={view.plan?.u?.shape ?? 'legacy'}
      onClickCapture={(e) => armShared('lx-hero', e.currentTarget)}
    >
      <Eyebrow
        meta={
          <span data-testid="today-status" data-status={view.status} data-done={done} data-total={total} aria-label={t('nbHeuteRingLabel', { done, total })} className="whitespace-nowrap">
            {t('nbHeuteRing', { done, total, min: minLeft })}
          </span>
        }
      >
        {t('nbHeuteUnit')}
      </Eyebrow>
      <div className="flex flex-col gap-4" data-testid="hero" data-duty={now?.id}>
        <h2 id="td-unit-title" className="text-lg leading-snug font-semibold tracking-tight text-balance" data-testid="today-title">
          {title}
        </h2>
        <ol className="flex flex-col" aria-label={t('tdPflicht')} data-testid="duties">
          {rows.map((r) => (
            <li
              key={r.id}
              data-testid="duty"
              data-duty={r.id}
              data-state={r.state === 'done' ? 'done' : 'open'}
              data-now={r.state === 'now' ? 'true' : undefined}
              className="flex min-h-12 items-center gap-3 border-t border-line py-1.5 first:border-t-0"
            >
              <BlockDot state={r.state} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-sm font-semibold ${r.state === 'done' ? 'text-muted' : ''}`}>{r.name}</span>
                <span className="text-xs text-muted" data-testid="reason" data-why={r.whyKey}>
                  {r.id === 'review' && r.progress && r.state !== 'done' && r.progress.done > 0
                    ? t('tdProgressLabel', {
                        done: r.progress.done,
                        total: r.progress.total,
                      })
                    : r.why}
                </span>
              </span>
              <span className="lx-tnum flex-none text-xs text-muted">
                {r.state === 'done' ? t('nbHeuteBlockDone') : t('nbHeuteMin', { min: r.min })}
                <span className="sr-only"> · {r.state === 'done' ? t('nbHeuteBlockDone') : r.state === 'now' ? t('nbHeuteBlockNow') : t('nbHeuteBlockOpen')}</span>
              </span>
            </li>
          ))}
        </ol>
        {fixNone && (
          <p className="flex min-h-9 items-center gap-3 border-t border-line pt-2 text-xs text-muted" data-testid="fix-none">
            <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text" aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            {t('nbHeuteFixNone')}
          </p>
        )}
      </div>
      <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={start} data-testid="start" data-duty={now?.id} className="w-full">
        {done > 0 && now ? t('nbHeuteContinue', { block: now.name }) : t('nbHeuteStart')}
      </Button>
      <StreakFoot />
    </section>
  );
}

/**
 * Fertig-Zustand (N15, Gesamtkonzept 3.2 „Abschluss“): Häkchen, EINE zählende Zahl, eine Wahrheitszeile („Heute neu sicher: 3 ·
 * Fehler weg: 1 · überfällig −12“, nur was stimmt) und höchstens ein Meilenstein-Satz. Ein Zustand, kein Knopf, kein Konfetti.
 */
function DoneCard({ view, tomorrow }: { view: TodayView; tomorrow: string }) {
  const { t, tn } = useT();
  const facts = useDoneFacts(view, true);
  const blocks = view.duties.total;
  const truth = [
    facts.sure !== null ? t('nbHeuteTruthSure', { n: facts.sure }) : null,
    facts.fixed !== null ? t('nbHeuteTruthFixed', { n: facts.fixed }) : null,
    facts.over !== null ? t('nbHeuteTruthOver', { n: facts.over }) : null,
  ].filter((x): x is string => x !== null);
  const ms = facts.milestone;
  const msText = ms ? (ms.id.startsWith('fest') ? t('nbHeuteMsFest', { n: ms.n ?? 0 }) : ms.id === 'topic1' ? t('nbHeuteMsTopic') : ms.id === 'fix10' ? t('nbHeuteMsFix', { n: ms.n ?? 0 }) : t('nbHeuteMsOver')) : null;
  return (
    <div data-testid="today-card" data-done="true">
      <HeroCard
        tone="done"
        eyebrow={
          <>
            <span aria-hidden="true">✓ </span>
            <span data-testid="today-status" data-status={view.status} data-done={view.duties.done} data-total={view.duties.total}>
              {t('nbHeuteDoneTitle')}
            </span>
          </>
        }
        title={
          <span className="lx-tnum" data-testid="balance">
            {view.balance.answers > 0 ? tn('nbHeuteDoneAnswers', view.balance.answers) : t('nbHeuteDoneSteps', { blocks })}
          </span>
        }
      >
        {truth.length > 0 && (
          <p className="lx-tnum text-sm text-muted" data-testid="today-truth">
            {truth.join(' · ')}
          </p>
        )}
        {msText && (
          <p className="text-sm font-medium" data-testid="today-milestone" data-id={ms?.id}>
            {msText}
          </p>
        )}
        <p className="text-sm text-muted" data-testid="today-tomorrow">
          {tomorrow}
        </p>
        <StreakFoot />
      </HeroCard>
    </div>
  );
}

/** Willkommens-Karte der Neustart-Woche (Pause ≥ 14 Lerntage): steht statt der Tageskarte, solange heute noch nichts gestartet wurde. */
function RestartCard({ view, gap, overdue, minutes }: { view: TodayView; gap: number; overdue: number; minutes: number }) {
  const { t } = useT();
  const start = useStartUnit(view);
  const go = () => {
    local.set(`${KEY_PREFIX}restart:${view.day}`, '1');
    start();
  };
  return (
    <section className="lx-card flex flex-col gap-3.5 p-[1.125rem]" aria-labelledby="td-restart-title" data-testid="restart-card">
      <h2 id="td-restart-title" className="text-lg leading-snug font-semibold tracking-tight text-balance">
        {t('nbHeuteRestartTitle')}
      </h2>
      <p className="text-sm text-muted">
        {t('nbHeuteRestartPause', { gap })} {overdue > 0 ? t('nbHeuteRestartWords', { n: overdue }) : t('nbHeuteRestartNoWords')}
      </p>
      <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={go} data-testid="restart-start" className="w-full">
        {t('nbHeuteRestartStart', { min: minutes })}
      </Button>
    </section>
  );
}

/** „Lohnt sich jetzt“ (B10): EINE Zeile mit Grund – der stärkste machbare Kanal, sonst eine freie Vokabelrunde. */
function WorthNow({ today, lang }: { today: string; lang: Lang }) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const now = useClock((s) => s.now);
  const tts = useSpeech((s) => s.status === 'ready');
  const suggestion = useMemo(() => {
    try {
      const live = useLive.getState();
      const profile = live.docs['app/profile'];
      const cards = drillCards(now);
      const data = feasibleData(cards, lang, now);
      const visible = buildTrainCards(live.collections.vocab ?? new Map(), now, invalidIdsOf(live.invalid, 'vocab')).filter((c) => !c.hidden);
      const ranked = rankChannels({
        today,
        profile: profile ?? {},
        focus: focusAction(live.docs['app/assess'], lang),
        assess: assessPlanInput(live.docs['app/assess'], today),
        dueErrors: dueErrors(live.collections.grammar ?? new Map(), now).length,
        dueCards: dueCards(visible, now).length,
        data,
        env: { tts },
      });
      return ranked.find((r) => CHANNEL_KEY[r.id] && feasible(r.id, data, { tts })) ?? null;
    } catch (err) {
      logWarn('today:worth', err);
      return null;
    }
  }, [today, lang, now, tts]);

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
  const row = suggestion
    ? {
        id: suggestion.id,
        title: t(CHANNEL_KEY[suggestion.id] as MessageKey),
        why: whyText(suggestion.why, t, lang) || t('why_whyRotation'),
        keys: suggestion.why.map((w) => w[0]).join(','),
        run: () => startOffer(suggestion.id),
      }
    : {
        id: 'vocab',
        title: t('tdFreeRound'),
        why: t('tdFreeRoundSub'),
        keys: 'free',
        run: extraRound,
      };
  return (
    <section aria-labelledby="td-extra" className="flex flex-col gap-3" data-testid="extra">
      <p id="td-extra" className="lx-eyebrow">
        {t('nbHeuteWorth')}
      </p>
      <button
        type="button"
        onClick={row.run}
        data-testid="offer"
        data-channel={row.id}
        className="lx-glass flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] p-4 text-left transition-colors hover:bg-surface-strong"
      >
        <ChannelIcon channel={CHANNEL_TONE[row.id] ?? 'cards'}>
          <Icon name={CHANNEL_ICON[row.id] ?? 'cards'} />
        </ChannelIcon>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{row.title}</span>
          <span className="text-sm text-muted" data-testid="offer-why">
            <span data-testid="reason" data-why={row.keys}>
              {row.why}
            </span>
          </span>
        </span>
        <Icon name="arrowRight" size={18} className="flex-none text-subtle" />
      </button>
      <div>
        <button
          type="button"
          onClick={() => go({ name: 'learn' })}
          data-testid="more-practice"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-text hover:underline"
        >
          {t('nbHeuteMore')}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}

/**
 * Sprechen als freiwilliges Extra (Emrahs Wahl 04.10.2026): seit dem Fokus auf Vokabeln und Grammatik kein Reiter und kein
 * Teil der Pflicht mehr, aber über diese ruhige Zeile erreichbar (zählt nie zum Tagesziel, Kap. 2.6).
 */
function SpeakExtra() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <div>
      <button type="button" onClick={() => go({ name: 'speak' })} data-testid="today-speak" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-text hover:underline">
        <Icon name="chat" size={16} />
        {t('nbHeuteSpeakExtra')}
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

/** S5: Ein verpasster Wochen-Check erscheint am Montag als ruhige Extra-Zeile (zählt nie zur Pflicht). */
function MissedCheck({ today }: { today: string }) {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const profile = useLive((s) => s.docs['app/profile']);
  if (dowOf(today) !== 1 || !checkAvailable(profile, addDays(today, -1)) || Number(obj(profile).answers ?? 0) < 40) return null;
  const run = () => {
    unlockSpeech();
    const first = startCheck();
    if (first === 'empty') {
      toast(t('ckEmpty'));
      return;
    }
    if (first === 'typed') api.focusNow();
    go({ name: 'check' });
  };
  return (
    <button type="button" onClick={run} data-testid="check-missed" className="flex min-h-11 items-center gap-2 text-left text-sm text-muted hover:text-fg">
      <Icon name="target" size={16} className="flex-none" />
      <span className="flex-1">{t('nbHeuteCheckMissed')}</span>
      <Icon name="arrowRight" size={14} className="flex-none text-subtle" />
    </button>
  );
}

/** Wochenrückblick-Band (Gesamtkonzept 3.5f): montags einmal je Woche, führt zur Seite „Wochenrückblick“. Gemerkt nur in diesem Browser (nichts wird geschrieben). */
function WeeklyBand({ today }: { today: string }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const profile = useLive((s) => s.docs['app/profile']);
  const key = `${KEY_PREFIX}weeklyband:${isoWeek(today)}`;
  const [seen, setSeen] = useState(() => local.get(key) === '1');
  if (seen || dowOf(today) !== 1 || Number(obj(profile).answers ?? 0) < 40) return null;
  const open = () => {
    local.set(key, '1');
    setSeen(true);
    go({ name: 'weekly' });
  };
  return (
    <p className="lx-glass flex flex-wrap items-center justify-between gap-x-3 rounded-[var(--radius-card)] px-4 py-2 text-sm text-muted" data-testid="weekly-band">
      <span>{t('nbHeuteRecapBand')}</span>
      <button type="button" onClick={open} className="inline-flex min-h-11 items-center font-medium text-accent-text hover:underline" data-testid="weekly-band-open">
        {t('nbHeuteRecapOpen')}
      </button>
    </p>
  );
}

export function TodayScreen() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const clockNow = useClock((s) => s.now);
  const view = useToday((s) => s);
  const profile = useLive((s) => s.docs['app/profile']);
  const saveFailed = usePending((s) => s.failed);
  const { ready, dayLoaded, planStatus, plan } = view;

  // Selbstheilung (Regel 1): alles erledigt, aber `pflicht[heute]` fehlt noch.
  const marked = pflichtMarked(profile, today);
  useEffect(() => {
    if (ready && view.status === 'allDone' && !marked) void healToday();
  }, [ready, view.status, marked]);

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

  // Auslöser der Einschätzung (Plan W1): der Übergang zu „Pflicht erledigt" – einmal je Tab und
  // Lerntag, nur mit Grund (`assessDue`). Nach dem ersten Bild, nie auf dem Startpfad (N14).
  const seenOpen = useRef(false);
  useEffect(() => {
    if (!ready || !dayLoaded) return;
    if (view.status === 'open') seenOpen.current = true;
    else if (view.status === 'allDone' && seenOpen.current) {
      seenOpen.current = false;
      void maybeAutoAssess(Date.now());
    }
  }, [ready, dayLoaded, view.status]);

  const unit = isUnitPlan(plan) ? plan : null;
  const up = useMemo(() => (unit ? unitPlanOf(unit, null) : null), [unit]);
  const rows: CardRow[] = useMemo(() => {
    if (!plan) return [];
    const ur = unitRows(plan, view.duties.items);
    if (!ur || !up) return legacyRows(plan, view.duties.items, t, lang);
    return ur.map((r) => {
      const b: UnitBlock | undefined = up.blocks.find((x) => x.channel === r.id);
      return {
        id: r.id,
        name: blockName(r.kind, r.block, t),
        why: b ? blockWhy(b, t, plan.goal.review, b.kind === 'review' && b.min * 60 > up.reviewSec) : '',
        whyKey: b?.kind ?? r.kind,
        min: r.min,
        state: r.state,
        progress: r.progress,
      };
    });
  }, [plan, up, view.duties.items, t, lang]);
  const minLeft = useMemo(() => {
    if (!plan) return 0;
    if (unit) return minutesLeft(unitRows(unit, view.duties.items) ?? []);
    return rows.filter((r) => r.state !== 'done').reduce((s, r) => s + r.min, 0) || dutyMinutes(plan);
  }, [plan, unit, rows, view.duties.items]);

  // „Morgen: …“ aus dem Wochenplan von morgen (rein, ohne `env`).
  const tomorrow = useMemo(() => {
    const next = addDays(today, 1);
    const p = unitPlanFor(next, null, { goalMin: unit?.u.goalMin });
    const task = p.blocks.find((b) => b.block === 3);
    if (!task || p.shape === 'sun') return p.shape === 'sun' ? `${t('nbHeuteBlock_check')} · ${t('nbHeuteWhy_check')}` : '';
    return t('nbHeuteTomorrow', { what: blockWhy(task, t) });
  }, [today, unit, t]);

  const ok = ready && dayLoaded;
  const gap = useMemo(() => comebackGap(obj(profile), today), [profile, today]);
  const comeback = comebackBand(gap);
  const ret = useMemo(() => lastReturn(obj(profile), today), [profile, today]);
  const done = view.status === 'allDone' || view.status === 'nothing';
  // Neustart-Woche: die Willkommens-Karte steht statt der Tageskarte, bis heute etwas gestartet wurde (oder der Knopf gedrückt ist).
  const restartStarted = local.get(`${KEY_PREFIX}restart:${today}`) === '1';
  const welcome = ok && !done && comeback === 'restart' && unit !== null && view.duties.done === 0 && !restartStarted;
  const overdueNow = useMemo(() => {
    if (!welcome) return 0;
    try {
      const live = useLive.getState();
      const cards = buildTrainCards(live.collections.vocab ?? new Map(), clockNow, invalidIdsOf(live.invalid, 'vocab'));
      return cardStats([...cards, ...buildChunkCards(live.collections.chunk ?? new Map(), clockNow, invalidIdsOf(live.invalid, 'chunk'))], lang, clockNow).overdue;
    } catch (err) {
      logWarn('today:overdue', err);
      return 0;
    }
  }, [welcome, lang, clockNow]);
  // Kein Fehlersatz fällig: „Fehler korrigieren“ steht nicht im Plan (Plan der Einheit, nicht am Sonntag) – Zustand statt leerem Schritt.
  const fixNone = !!unit && unit.u.shape !== 'sun' && !unit.u.b.some(([, kind]) => kind === 'again');
  const restartDay = ret && ret.gap >= RESTART_GAP && ret.since < RESTART_DAYS ? ret.since + 1 : null;
  const title = t('nbHeuteUnit');

  return (
    <motion.div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-4 sm:py-8" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
      <motion.div variants={item}>
        <TabTitle title={t('navToday')} sub={<TodaySubline today={today} lang={lang} />} />
      </motion.div>

      {ok && !done && !welcome && comeback !== 'none' && comeback !== 'restart' && (
        <motion.p variants={item} className="lx-glass rounded-[var(--radius-card)] px-4 py-3 text-sm text-muted" role="status" data-testid="comeback-band" data-band={comeback}>
          {t(comeback === 'short' ? 'nbHeuteComebackShort' : 'nbHeuteComebackLong')}
        </motion.p>
      )}

      {ok && !done && !welcome && restartDay !== null && (
        <motion.p variants={item} className="lx-glass rounded-[var(--radius-card)] px-4 py-3 text-sm text-muted" role="status" data-testid="comeback-band" data-band="restart" data-day={restartDay}>
          {t('nbHeuteRestartDay', { n: restartDay, total: RESTART_DAYS })}
        </motion.p>
      )}

      {ok && comeback === 'none' && restartDay === null && <WeeklyBand today={today} />}

      {planStatus === 'error' && (
        <div role="alert" className="flex flex-col items-start gap-3" data-testid="plan-error">
          <p className="text-base text-muted">{t('tdPlanError')}</p>
          <Button onClick={() => retryPlan(Date.now())} icon="refresh">
            {t('tdPlanRetry')}
          </Button>
        </div>
      )}

      {!ok && planStatus !== 'error' && (
        <div role="status" aria-label={t('tdLoading')} className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-4 sm:p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {welcome && (
        <motion.div variants={item}>
          <RestartCard view={view} gap={gap ?? 0} overdue={overdueNow} minutes={minLeft} />
        </motion.div>
      )}

      {ok && !done && !welcome && view.duties.total > 0 && (
        <motion.div variants={item}>
          <UnitCard view={view} rows={rows} title={title} minLeft={minLeft} fixNone={fixNone} />
        </motion.div>
      )}

      {ok && done && (
        <motion.div variants={item} className="flex flex-col gap-5">
          <DoneCard view={view} tomorrow={tomorrow} />
          <WorthNow today={today} lang={lang} />
        </motion.div>
      )}

      {ok && !unit && plan && !done && (
        <p className="text-xs text-subtle" data-testid="today-legacy">
          {t('nbHeuteLegacy')}
        </p>
      )}

      {ok && <SpeakExtra />}

      {/* Ruhige Zeilen (plan.md §1.3 Nr. 4): Speicher- und Planfehler (P1). */}
      {ok && <MissedCheck today={today} />}
      {saveFailed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-danger-text" role="alert" data-testid="save-failed">
          <span>{t('tdNotSaved')}</span>
          <Button onClick={() => void flush()} icon="refresh">
            {t('tdRetrySave')}
          </Button>
        </div>
      )}
      {planStatus === 'local' && <p className="text-xs text-subtle">{t('nbHeuteLocal')}</p>}
    </motion.div>
  );
}
