import { motion } from 'framer-motion';
import { comebackBand, comebackGap, lastReturn, RESTART_DAYS, RESTART_GAP } from '../../domain/plan/comeback';
import { cardStats } from '../../domain/plan/dayStats';
import { dowOf, unitPlanFor } from '../../domain/unit/planFor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { armShared } from '../../engine/shared';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SegmentRing } from '../../ui/ProgressRing';
import { WeekStrip } from '../progress/StandHeader';
import { streakWeek } from '../../domain/metrics';
import { topicName } from '../grammar/topicUi';
import { ExtraRow } from './ExtraRow';
import { bigGain, patternGains } from './doneCard';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKeyNoon, addDays } from '../../domain/date';
import { dutyChannelMinutes, dutyMinutes } from '../../domain/plan/buildPlan';
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
import { startDuty } from '../learn/flow';
import { dutyLabel } from '../learn/ui';
import { unlockSpeech } from '../../platform/speech';
import { firstOpenDuty, useToday, type TodayView } from './state';
import { healToday, retryPlan } from './store';
import { TabTitle } from '../system/Chrome';
import { unitRows, minutesLeft, type UnitRow } from '../../domain/unit/rows';
import { isUnitPlan, unitPlanOf } from '../../domain/unit/plan';
import type { UnitBlock } from '../../domain/unit/types';
import { buildTrainCards } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { startUnit } from '../unit/run';
import { blockName, blockWhy } from '../unit/labels';
import { lessonMeta } from '../../domain/course/catalog';
import { Slot } from '../../app/slots';

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

/** Eine Zeile der Tageskarte (Einheit oder – am Übergangstag – ein Pflichtpunkt des alten Plans). */
type CardRow = {
  id: DutyId;
  name: string;
  why: string;
  whyKey: string;
  min: number;
  kind: string;
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
      kind: d.id === 'review' ? 'review' : 'legacy',
      state,
      progress: d.progress,
    };
  });
}

/** Lerntag (Wechsel um 04:00), dieselbe Datumsfunktion wie der Plan: nachts gilt noch der Vortag. Der Titel von Heute ist das Datum (§2.2). */
function dateLabelOf(today: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyNoon(today));
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
      <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-ok" style={{ color: 'var(--lx-accent-fg)' }} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
    );
  return (
    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full border-2" style={{ borderColor: state === 'now' ? 'var(--lx-ch-grammar)' : 'var(--lx-line-strong)' }} aria-hidden="true">
      {state === 'now' && <span className="size-2 rounded-full" style={{ background: 'var(--lx-ch-grammar)' }} />}
    </span>
  );
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

/** Titel der Tageskarte: der nächste Schritt. Das Grammatikthema kommt nur aus dem eingefrorenen `u.gt` (§2.3), nie aus einer Neuberechnung. */
function nextTitle(now: CardRow | null, intro: string | null, t: T, lang: Lang): string {
  if (!now) return t('hxTodayNext', { what: t('nbHeuteBlock_review') });
  if (now.kind === 'grammar' && intro) return t('hxTodayNextGrammarNew', { topic: topicName(intro, lang) });
  return t('hxTodayNext', { what: now.name });
}

/** Die Tageskarte (offen): Ring mit einem Segment je Pflichtschritt, „Als Nächstes“, Pflichtschritte als Zustand und der EINE Knopf. `fixNone`: „Fehler korrigieren“ entfällt, weil nichts fällig ist. */
function UnitCard({ view, rows, minLeft, fixNone }: { view: TodayView; rows: CardRow[]; minLeft: number; fixNone: boolean }) {
  const { t, lang } = useT();
  const done = view.duties.done;
  const total = view.duties.total;
  const now = rows.find((r) => r.state === 'now') ?? null;
  const start = useStartUnit(view);
  const title = nextTitle(now, view.plan?.u?.gt?.intro ?? null, t, lang);
  return (
    <section
      className="lx-card flex flex-col gap-3.5 p-[1.125rem]"
      aria-labelledby="td-unit-title"
      data-testid="today-card"
      data-shape={view.plan?.u?.shape ?? 'legacy'}
      onClickCapture={(e) => armShared('lx-hero', e.currentTarget)}
    >
      <div className="flex items-center gap-3.5">
        <SegmentRing segments={Math.max(1, total)} done={done} size={112} stroke={8} label={t('nbHeuteRingLabel', { done, total })}>
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-3xl leading-none font-semibold tracking-tight">{minLeft}</span>
            <span className="text-xs font-normal text-subtle">{t('hxTodayRingOpen')}</span>
          </span>
        </SegmentRing>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="td-unit-title" className="text-xl leading-7 font-semibold tracking-tight text-balance" data-testid="today-title">
            {title}
          </h2>
          <span data-testid="today-status" data-status={view.status} data-done={done} data-total={total} className="lx-tnum text-xs text-muted">
            {t('nbHeuteRing', { done, total, min: minLeft })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-4" data-testid="hero" data-duty={now?.id}>
        <ol className="flex flex-col gap-1.5" aria-label={t('tdPflicht')} data-testid="duties">
          {rows.map((r) => (
            <li
              key={r.id}
              data-testid="duty"
              data-duty={r.id}
              data-state={r.state === 'done' ? 'done' : 'open'}
              data-now={r.state === 'now' ? 'true' : undefined}
              className={`flex min-h-[3.25rem] items-center gap-3 rounded-[0.875rem] px-3 py-1.5 ${r.state === 'now' ? 'bg-surface-strong' : ''}`}
            >
              <BlockDot state={r.state} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-base font-medium ${r.state === 'now' ? 'text-fg' : 'text-muted'}`}>{r.name}</span>
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
            <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-ok-soft text-ok-text" aria-hidden="true">
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
 * Abschlusskarte (§5.10): voller Ring mit Häkchen, EINE große Zahl tatsächlich Gefestigten (nie eine Antwortzahl), eine Wahrheitszeile
 * („Neu sicher: wish + Past · Fehlersätze erledigt: 2“, nur echte Zustandswechsel), der Wochenstreifen mit sichtbarem Ruhetag, „Morgen“
 * und höchstens ein Meilenstein-Satz. Ein Zustand, kein Knopf, kein Konfetti. Darunter steht die eine Zeile „Extra ›“.
 */
function DoneCard({ view, tomorrow, today }: { view: TodayView; tomorrow: string; today: string }) {
  const { t, lang } = useT();
  const now = useClock((s) => s.now);
  const facts = useDoneFacts(view, true);
  const grammar = useLive((s) => s.collections.grammar);
  const profile = useLive((s) => s.docs['app/profile']);
  const schema = useLive((s) => s.docs['app/schema']);
  const archive = useLive((s) => s.collections.archive);
  const blocks = view.duties.total;
  const gains = useMemo(() => patternGains({ ps: view.plan?.u?.ps, grammarDocs: grammar ?? new Map(), today, lang }), [view.plan, grammar, today, lang]);
  const big = bigGain({ wordsSure: facts.sure, patterns: gains.count });
  const week = useMemo(() => {
    try {
      return streakWeek({ nowMs: now, profile, schema, archives: (archive ?? new Map()).values() }).week;
    } catch (err) {
      logWarn('today:week', err);
      return [];
    }
  }, [now, profile, schema, archive]);
  const truth = [
    gains.names.length > 0 ? t('hxDoneNewSafe', { names: gains.names.join(' + ') }) : null,
    facts.fixed !== null && facts.fixed > 0 ? t('hxDoneFixed', { n: facts.fixed }) : null,
    facts.over !== null ? t('nbHeuteTruthOver', { n: facts.over }) : null,
  ].filter((x): x is string => x !== null);
  const ms = facts.milestone;
  const msText = ms ? (ms.id.startsWith('fest') ? t('nbHeuteMsFest', { n: ms.n ?? 0 }) : ms.id === 'topic1' ? t('nbHeuteMsTopic') : ms.id === 'fix10' ? t('nbHeuteMsFix', { n: ms.n ?? 0 }) : t('nbHeuteMsOver')) : null;
  return (
    <section className="lx-card flex flex-col gap-3.5 p-[1.125rem]" data-testid="today-card" data-done="true" aria-labelledby="td-done-title">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="lx-eyebrow text-ok-text">
          <span aria-hidden="true">✓ </span>
          <span data-testid="today-status" data-status={view.status} data-done={view.duties.done} data-total={view.duties.total}>
            {t('nbHeuteDoneTitle')}
          </span>
        </p>
        <span className="relative inline-flex" style={{ filter: 'drop-shadow(0 0 28px var(--lx-ok-soft))' }}>
          <SegmentRing segments={Math.max(1, blocks)} done={blocks} size={168} stroke={12} label={t('nbHeuteRingLabel', { done: blocks, total: blocks })}>
            <Icon name="check" size={72} />
          </SegmentRing>
        </span>
        <h2 id="td-done-title" className="lx-tnum text-4xl leading-none font-semibold tracking-tight text-balance" data-testid="balance" data-kind={big?.kind ?? 'steps'}>
          {big ? t(big.kind === 'words' ? 'hxDoneBigWords' : 'hxDoneBigPatterns', { n: big.n }) : t('nbHeuteDoneSteps', { blocks })}
        </h2>
      </div>
      {truth.length > 0 && (
        <p className="lx-tnum text-sm text-muted" data-testid="today-truth">
          {truth.join(' · ')}
        </p>
      )}
      {week.length > 0 && <WeekStrip week={week} />}
      {msText && (
        <p className="text-sm font-medium" data-testid="today-milestone" data-id={ms?.id}>
          {msText}
        </p>
      )}
      {tomorrow && (
        <p className="text-sm text-muted" data-testid="today-tomorrow">
          {tomorrow}
        </p>
      )}
      <StreakFoot />
    </section>
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
        name: blockName(r.kind, r.block, t, r.fmt),
        why: b ? blockWhy(b, t, plan.goal.review, b.kind === 'review' && b.min * 60 > up.reviewSec) : '',
        whyKey: b?.kind ?? r.kind,
        min: r.min,
        kind: r.kind,
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

  return (
    <motion.div className="mx-auto flex w-full max-w-[70rem] flex-col gap-5 py-4 sm:py-8" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
      <motion.div variants={item}>
        <TabTitle title={dateLabelOf(today, lang)} testId="today-date" />
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
          <UnitCard view={view} rows={rows} minLeft={minLeft} fixNone={fixNone} />
        </motion.div>
      )}

      {ok && done && (
        <motion.div variants={item} className="flex flex-col gap-5">
          <DoneCard view={view} tomorrow={tomorrow} today={today} />
          <Slot name="today.done" />
          <ExtraRow today={today} />
          <Slot name="today.extra" />
        </motion.div>
      )}

      {ok && !unit && plan && !done && (
        <p className="text-xs text-subtle" data-testid="today-legacy">
          {t('nbHeuteLegacy')}
        </p>
      )}

      {/* Während der Pflicht steht unter der Tageskarte nichts außer Speicher- und Planfehlern (§2.2 Nr. 4). */}
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
