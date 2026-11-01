import { motion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { comebackBand, comebackGap, lastReturn, RESTART_DAYS, RESTART_GAP } from '../../domain/plan/comeback';
import { dowOf, unitPlanFor } from '../../domain/unit/planFor';
import { armShared } from '../../engine/shared';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { VButton, VRow } from '../../ui/v';
import { noteDayOpen } from './dayMoment';
import { topicName } from '../grammar/topicUi';
import type { GrammarDay } from '../../domain/plan/types';
import { ExtraRow, MoreRows } from './ExtraRow';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { invalidIdsOf, useLive } from '../../data/live';
import { addDays, isoWeek } from '../../domain/date';
import { pflichtMarked } from '../../domain/plan/pflicht';
import type { DutyId, StoredPlan, WhyKey } from '../../domain/plan/types';
import type { Lang } from '../../app/settings';
import { actionLabel } from '../progress/actionRoute';
import { maybeAutoAssess } from '../progress/assessRun';
import { logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';
import { DoneCard3 } from './DoneCard3';
import { StillThere } from './StillThere';
import { useHiddenInput } from '../../engine/HiddenInput';
import { DayBlocks, DayCardFrame, dayRowName, GoLabel, NextLine, StartCard, TodayRing, TodaySkeletonCard, useEnterStart, type DayRow } from './DayCard';
import { useValidTodayDoc } from '../../data/todayDoc';
import { markStart } from './startPerf';
import { requestStart } from './startRun';
import { flush, usePending } from '../progress/persist';
import { useToday, type TodayView } from './state';
import { healToday, retryPlan } from './store';
import { unitRows, type UnitRow } from '../../domain/unit/rows';
import { isUnitPlan, unitPlanOf } from '../../domain/unit/plan';
import type { UnitBlock } from '../../domain/unit/types';
import { buildTrainCards, legacyDutyMinutes, overdueUnits, todaySummary, type TodaySummary } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { blockWhy } from '../unit/labels';
import { vocabModuleOn } from '../../modules/vocab/api';
import { lessonMeta } from '../../domain/course/catalog';
import { Slot } from '../../app/slots';
import { useMediaQuery } from '../../platform/input';
import { TodayMid } from './TodayMid';
import { TodayWeekStrip, WeekList, useStreakWeek } from './TodayWeek';

// „Heute“ im Design der Vorschau (Relaunch Teil 1c, D2 V-HEUTE; Vorschau H1 screens.js:117–176, L1 desk.js:79–150): die rote Linie.
// Kopf „Heute“ (Rahmen, `TodayHead`), EINE Tageskarte mit großem Segmentring (Restminuten), Thema, Unterzeile, „Als Nächstes“ und EIN Knopf;
// Antippen des Rings zeigt die Blöcke von heute (Zustand, kein Knopf; Kap. 2 Nr. 2). Darunter am Handy der Wochenstreifen mit Serie und
// „Wenn du mehr willst“ (höchstens drei Zeilen, zählt nie zur Pflicht); ab 1.280 px stehen beide rechts in der Kontextspalte (`TodayContext`),
// am Laptop darunter Kapitelstand und Wörter fest (`TodayMid`). Nach der Pflicht: Abschlusskarte (Zustand, kein Knopf).
// Die Logik (Plan, Zahlen, Serie, Tageswechsel 04:00, Wiedereinstieg) ist unverändert: Alle Zahlen kommen aus EINEM `todaySummary`.

let statusMarked = false;
/** U2: Die erste Heute-Ansicht nach dem Seitenstart ersetzt das Start-Bild/Ladeskelett an derselben Stelle – ohne Ein-Animation (kein Rutschen). */
let firstMount = true;
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
    const min = legacyDutyMinutes(d.id);
    return {
      id: d.id,
      name: dayRowName({ kind: d.id === 'review' ? 'review' : 'legacy', block: 0, id: d.id }, t),
      why,
      whyKey,
      min,
      kind: d.id === 'review' ? 'review' : 'legacy',
      state,
      progress: d.progress,
    };
  });
}


/**
 * Start der Tageseinheit (Tageskarte und Willkommens-Karte): der erste offene Block, sonst der alte Weg. SYNCHRON im Klick (iPhone-Tastatur).
 * Relaunch P6: über `requestStart` – fehlt noch etwas (gepackte Inhalte), wartet der Start im Übungsrahmen statt ins Leere zu laufen.
 */
function useStartUnit(): () => void {
  const api = useHiddenInput();
  return () => requestStart(api, true);
}

/**
 * Thema der Tageskarte (Vorschau `.dtopic .t`): das Grammatikthema des Tages aus dem eingefrorenen `u.gt` (§2.3, nie neu berechnet) –
 * „Kapitel n · Thema“ (K5), sonst „Neues Thema: …“ bzw. das erste Thema; ohne Grammatik „Dein Plan für heute“. Ein Wochenthema steht nicht auf Heute.
 */
function dayTitle(gt: GrammarDay | null, t: T, lang: Lang): string {
  const intro = gt?.intro ?? null;
  const head = intro ?? gt?.topics[0] ?? null;
  if (gt?.ch && head) return t('pxKNext', { n: gt.ch, topic: topicName(head, lang) });
  if (intro) return t('vhNewTopic', { topic: topicName(intro, lang) });
  if (head) return topicName(head, lang);
  return t('vhDayTitle');
}

/** Minuten je Segment des Rings: die Minuten der Zeilen (Bogenlänge wie in der Vorschau). */
const minutesOf = (rows: readonly CardRow[]): number[] => rows.map((r) => r.min);

/** Tageskarte offen (Vorschau H1 `start`/`mid`/`ring`, L1 `main`/`start`): Ring mit Restminuten, Thema, Unterzeile, „Als Nächstes“, EIN Knopf. */
function UnitCard({ view, rows, sum, fixNone, settled, sub }: { view: TodayView; rows: CardRow[]; sum: TodaySummary; fixNone: boolean; settled: boolean; sub: ReactNode }) {
  const { t, lang } = useT();
  const { done, total } = sum;
  const [list, setList] = useState(false);
  const listId = useId();
  const now = rows.find((r) => r.state === 'now') ?? null;
  const start = useStartUnit();
  const started = done > 0 || sum.fills.some((f) => f > 0);
  const shown: DayRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    why: r.id === 'review' && r.progress && r.state !== 'done' && r.progress.done > 0 ? t('tdProgressLabel', { done: r.progress.done, total: r.progress.total }) : r.why,
    whyKey: r.whyKey,
    min: r.min,
    kind: r.kind,
    state: r.state,
  }));
  const nowRow = shown.find((r) => r.state === 'now') ?? null;
  // Zeichnen des Rings nur einmal je Laden (Vorschau `S.drawOnce`) und nie, wenn die Karte ein Skelett/Startbild ersetzt (kein Sprung).
  const [draw] = useState(() => !settled && takeDraw());
  useEffect(() => markStart('lx:button'), []);
  useEnterStart(true, start);
  return (
    <DayCardFrame
      data-settled={settled ? '' : undefined}
      aria-labelledby="td-unit-title"
      data-testid="today-card"
      data-shape={view.plan?.u?.shape ?? 'legacy'}
      data-list={list ? '' : undefined}
      onClickCapture={(e) => armShared('lx-hero', e.currentTarget)}
      ring={
        <TodayRing
          fills={sum.fills}
          minutes={minutesOf(rows)}
          label={`${t('vRingShowBlocks')} · ${t('nbHeuteRingLabel', { done, total })}`}
          open={list}
          onToggle={() => setList((v) => !v)}
          controls={listId}
          draw={draw}
          testId="today-ring"
        >
          <b className="lx-v-disp lx-v-num" data-testid="today-min">
            {sum.rest}
          </b>
          <span>{t(started ? 'vhMinLeft' : 'vhMinToday')}</span>
        </TodayRing>
      }
    >
      <DayBlocks rows={shown} prefix="today" id={listId} open={list} />
      {fixNone && (
        <p className="lx-vh-fixnone" data-testid="fix-none" hidden={!list}>
          <span className="lx-v-st-mk" aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
          {t('nbHeuteFixNone')}
        </p>
      )}
      <div className="lx-vh-topic" data-testid="hero" data-duty={now?.id} hidden={list}>
        <h2 id="td-unit-title" className="lx-vh-t lx-v-disp" data-testid="today-topic">
          {dayTitle(view.plan?.u?.gt ?? null, t, lang)}
        </h2>
        <span data-testid="today-status" data-status={view.status} data-done={done} data-total={total} className="sr-only">
          {t('nbHeuteRing', { done, total })}
        </span>
        {sub}
      </div>
      <div hidden={list}>
        <NextLine now={nowRow} testId="today-title" />
      </div>
      <div className="lx-vh-go">
        <VButton variant="pri" full onClick={start} data-testid="start" data-duty={now?.id}>
          <GoLabel label={started && now ? t('vhContinue') : t('vhGo')} />
        </VButton>
      </div>
    </DayCardFrame>
  );
}

/** Ein Laden der Seite zeichnet den Ring höchstens einmal (Vorschau `S.drawOnce`). */
let drawn = false;
function takeDraw(): boolean {
  if (drawn) return false;
  drawn = true;
  return true;
}

/**
 * Willkommens-Karte der Neustart-Woche (Pause ≥ 14 Lerntage; Vorschau H1 `pause`): dieselbe Tageskarte mit Ring, „Willkommen zurück.“, der Pause
 * ohne Vorwurf, „Das ist noch da“ und dem Knopf „Neustart-Woche beginnen“. Steht statt der Tageskarte, solange heute noch nichts gestartet wurde.
 */
function RestartCard({ view, rows, sum, gap, overdue }: { view: Pick<TodayView, 'day'>; rows: CardRow[]; sum: TodaySummary; gap: number; overdue: number }) {
  const { t } = useT();
  const start = useStartUnit();
  useEffect(() => markStart('lx:button'), []);
  const go = () => {
    local.set(`${KEY_PREFIX}restart:${view.day}`, '1');
    start();
  };
  const now = rows.find((r) => r.state === 'now') ?? null;
  const nowRow: DayRow | null = now ? { ...now } : null;
  return (
    <DayCardFrame
      aria-labelledby="td-restart-title"
      data-testid="restart-card"
      ring={
        <TodayRing fills={sum.fills} minutes={minutesOf(rows)} label={t('nbHeuteRingLabel', { done: sum.done, total: sum.total })} testId="restart-ring">
          <b className="lx-v-disp lx-v-num" data-testid="restart-min">
            {sum.rest}
          </b>
          <span>{t('vhMinToday')}</span>
        </TodayRing>
      }
    >
      <div className="lx-vh-topic">
        <h2 id="td-restart-title" className="lx-vh-t lx-v-disp">
          {t('nbHeuteRestartTitle')}
        </h2>
        <p className="lx-vh-sub">
          {t('nbHeuteRestartPause', { gap })} {overdue > 0 ? t('nbHeuteRestartWords', { n: overdue }) : t('nbHeuteRestartNoWords')}
        </p>
        <StillThere gap={gap} className="lx-vh-sub" />
      </div>
      <NextLine now={nowRow} />
      <div className="lx-vh-go">
        <VButton variant="pri" full onClick={go} data-testid="restart-start">
          {t('nbHeuteRestartStart', { min: sum.rest })}
        </VButton>
      </div>
    </DayCardFrame>
  );
}

/**
 * Wochenrückblick (Gesamtkonzept 3.5f): montags einmal je Woche eine Zeile bei „Diese Woche“ (Handy unter dem Wochenstreifen, Laptop in der
 * Kontextspalte), führt zur Seite „Wochenrückblick“. Gemerkt nur in diesem Browser (nichts wird geschrieben).
 */
export function WeeklyBand({ today }: { today: string }) {
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
    <div className="lx-vh-weekly" data-testid="weekly-band">
      <VRow icon="chart" title={t('vhWeekRecap')} sub={t('nbHeuteRecapBand')} onClick={open} data-testid="weekly-band-open" />
    </div>
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
  // Relaunch P6: Startbild aus `app/today`, bei JEDEM Zeichnen frisch gegen den Lerntag geprüft (sonst Skelett). Der berechnete Plan gewinnt,
  // sobald er steht (`ok`): Die echte Karte ersetzt das Startbild an derselben Stelle und in derselben Höhe.
  const startDoc = useValidTodayDoc();
  useEffect(() => markStart('lx:skeleton'), []);

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
    if (view.status === 'open') {
      seenOpen.current = true;
      noteDayOpen(view.day);
    } else if (view.status === 'allDone' && seenOpen.current) {
      seenOpen.current = false;
      void maybeAutoAssess(Date.now());
    }
  }, [ready, dayLoaded, view.status, view.day]);

  const unit = isUnitPlan(plan) ? plan : null;
  const up = useMemo(() => (unit ? unitPlanOf(unit, null) : null), [unit]);
  const vocabMod = vocabModuleOn(profile);
  const rows: CardRow[] = useMemo(() => {
    if (!plan) return [];
    const ur = unitRows(plan, view.duties.items);
    if (!ur || !up) return legacyRows(plan, view.duties.items, t, lang);
    return ur.map((r) => {
      const b: UnitBlock | undefined = up.blocks.find((x) => x.channel === r.id);
      return {
        id: r.id,
        name: dayRowName({ kind: r.kind, block: r.block, id: r.id, fmt: r.fmt }, t),
        // Neues Wörter-Modul: der Block ist eine Runde (fällige und neue Wörter), keine Kartenzahl.
        why: b ? (b.kind === 'review' && vocabMod ? t('nbHeuteWhy_vocabMod') : blockWhy(b, t, plan.goal.review, b.kind === 'review' && b.min * 60 > up.reviewSec)) : '',
        whyKey: b?.kind ?? r.kind,
        min: r.min,
        kind: r.kind,
        state: r.state,
        progress: r.progress,
      };
    });
  }, [plan, up, view.duties.items, t, lang, vocabMod]);
  // Alle Zahlen von Heute aus EINER Quelle (P5 S1-ZAHL, `metrics.todaySummary`): Ring (`fills`), „x von N“ (`done`, `total`), Restminuten (`rest`).
  const sum = useMemo(() => todaySummary({ plan, items: view.duties.items }), [plan, view.duties.items]);

  // „Morgen: …“ aus dem Wochenplan von morgen (rein, ohne `env`). `topic` allein (R5): für die eine Zeile mit der Lernzeit.
  const tomorrow = useMemo((): { line: string; topic: string } => {
    const next = addDays(today, 1);
    const p = unitPlanFor(next, null, { goalMin: unit?.u.goalMin });
    const task = p.blocks.find((b) => b.block === 3);
    if (p.shape === 'sun') {
      const sun = `${t('nbHeuteBlock_check')} · ${t('nbHeuteWhy_check')}`;
      return { line: sun, topic: sun };
    }
    if (!task) return { line: '', topic: '' };
    const what = blockWhy(task, t);
    return { line: t('nbHeuteTomorrow', { what }), topic: what };
  }, [today, unit, t]);

  const ok = ready && dayLoaded;
  // U2: Erste Heute-Ansicht nach dem Start (Datum und Skelett standen schon da) bzw. Karte ersetzt ein Skelett: ohne Ein-Animation.
  const [boot] = useState(() => firstMount);
  const [sawSkeleton] = useState(() => !ok);
  useEffect(() => {
    firstMount = false;
  }, []);
  const settled = boot || sawSkeleton;
  const wide = useMediaQuery('(min-width: 1024px)');
  const ctxWide = useMediaQuery('(min-width: 1280px)');
  const sw = useStreakWeek();
  const gap = useMemo(() => comebackGap(obj(profile), today), [profile, today]);
  const comeback = comebackBand(gap);
  const ret = useMemo(() => lastReturn(obj(profile), today), [profile, today]);
  const done = view.status === 'allDone' || view.status === 'nothing';
  // Neustart-Woche: die Willkommens-Karte steht statt der Tageskarte, bis heute etwas gestartet wurde (oder der Knopf gedrückt ist).
  const restartStarted = local.get(`${KEY_PREFIX}restart:${today}`) === '1';
  const welcome = ok && !done && comeback === 'restart' && unit !== null && sum.done === 0 && !restartStarted;
  const overdueNow = useMemo(() => {
    if (!welcome) return 0;
    try {
      const live = useLive.getState();
      const cards = buildTrainCards(live.collections.vocab ?? new Map(), clockNow, invalidIdsOf(live.invalid, 'vocab'));
      return overdueUnits([...cards, ...buildChunkCards(live.collections.chunk ?? new Map(), clockNow, invalidIdsOf(live.invalid, 'chunk'))], lang, clockNow);
    } catch (err) {
      logWarn('today:overdue', err);
      return 0;
    }
  }, [welcome, lang, clockNow]);
  // Kein Fehlersatz fällig: „Fehler korrigieren“ steht nicht im Plan (Plan der Einheit, nicht am Sonntag) – Zustand statt leerem Schritt.
  const fixNone = !!unit && unit.u.shape !== 'sun' && !unit.u.b.some(([, kind]) => kind === 'again');
  const restartDay = ret && ret.gap >= RESTART_GAP && ret.since < RESTART_DAYS ? ret.since + 1 : null;

  // Unterzeile der Tageskarte (Vorschau `.sub`): die früheren Bänder „Wiedereinstieg“ und „Neustart-Woche · Tag n“ (stufe1c-plan §3.1 D2).
  const bandSub =
    ok && !done && !welcome ? (
      <>
        {comeback !== 'none' && comeback !== 'restart' && (
          <p className="lx-vh-sub" role="status" data-testid="comeback-band" data-band={comeback}>
            {t(comeback === 'short' ? 'nbHeuteComebackShort' : 'nbHeuteComebackLong')}
            <StillThere gap={gap} />
          </p>
        )}
        {restartDay !== null && (
          <p className="lx-vh-sub" role="status" data-testid="comeback-band" data-band="restart" data-day={restartDay}>
            {t('nbHeuteRestartDay', { n: restartDay, total: RESTART_DAYS })}
          </p>
        )}
      </>
    ) : null;
  const weekly = ok && comeback === 'none' && restartDay === null ? <WeeklyBand today={today} /> : null;

  return (
    <motion.div className="lx-vh" initial={boot ? false : 'hidden'} animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
      {planStatus === 'error' && (
        <div role="alert" className="lx-vh-alert" data-testid="plan-error">
          <p>{t('tdPlanError')}</p>
          <VButton variant="sec" icon="refresh" onClick={() => retryPlan(Date.now())}>
            {t('tdPlanRetry')}
          </VButton>
        </div>
      )}

      {!ok && planStatus !== 'error' && (
        <div role="status" aria-label={t('tdLoading')}>
          {startDoc ? <StartCard doc={startDoc} /> : <TodaySkeletonCard />}
        </div>
      )}

      {welcome && (
        <motion.div variants={item}>
          <RestartCard view={view} rows={rows} sum={sum} gap={gap ?? 0} overdue={overdueNow} />
        </motion.div>
      )}

      {ok && !done && !welcome && sum.total > 0 && (
        <motion.div variants={item} initial={settled ? false : undefined}>
          <UnitCard view={view} rows={rows} sum={sum} fixNone={fixNone} settled={settled} sub={bandSub} />
        </motion.div>
      )}

      {ok && done && (
        <motion.div variants={item} className="lx-vh-stack">
          <DoneCard3 view={view} sum={sum} mins={rows.map((r) => r.min)} tomorrow={tomorrow.line} tomorrowTopic={tomorrow.topic} today={today} />
          <Slot name="today.done" />
        </motion.div>
      )}

      {/* Woche und „Wenn du mehr willst“: am Handy unter der Karte (Vorschau H1), ab 1.280 px nur rechts in der Kontextspalte (L1). */}
      {ok && !ctxWide && (
        <motion.div variants={item}>
          <TodayWeekStrip sw={sw} todayDone={view.status === 'allDone'} />
          {weekly}
        </motion.div>
      )}
      {ok && !ctxWide && (
        <motion.div variants={item}>
          <ExtraRow today={today} done={done} />
        </motion.div>
      )}
      {/* „Mein Arbeitsalltag“ & Co.: am Handy unter den Extras mit Abstand, ab 1.280 px in der Kontextspalte bei „Wenn du mehr willst“. */}
      {ok && done && !ctxWide && (
        <div className="lx-vh-slot">
          <Slot name="today.extra" />
        </div>
      )}

      {ok && !unit && plan && !done && (
        <p className="lx-vh-note" data-testid="today-legacy">
          {t('nbHeuteLegacy')}
        </p>
      )}

      {saveFailed && (
        <div className="lx-vh-alert" role="alert" data-testid="save-failed">
          <p>{t('tdNotSaved')}</p>
          <VButton variant="sec" icon="refresh" onClick={() => void flush()}>
            {t('tdRetrySave')}
          </VButton>
        </div>
      )}
      {planStatus === 'local' && <p className="lx-vh-note">{t('nbHeuteLocal')}</p>}
      {wide && ok && (
        <motion.div variants={item}>
          <TodayMid />
        </motion.div>
      )}
    </motion.div>
  );
}

/** Kontextspalte auf Heute ab 1.280 px (Vorschau L1 `l1Ctx`): „Diese Woche“ und „Wenn du mehr willst“. Gerendert vom Rahmen (`ContextHost`). */
export function TodayContext() {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const view = useToday((s) => s);
  const profile = useLive((s) => s.docs['app/profile']);
  const sw = useStreakWeek();
  const ok = view.ready && view.dayLoaded;
  const done = view.status === 'allDone' || view.status === 'nothing';
  const gap = useMemo(() => comebackGap(obj(profile), today), [profile, today]);
  const ret = useMemo(() => lastReturn(obj(profile), today), [profile, today]);
  const restartDay = ret && ret.gap >= RESTART_GAP && ret.since < RESTART_DAYS ? ret.since + 1 : null;
  if (!ok) return null;
  return (
    <div className="lx-vh-ctx" data-testid="today-context">
      <section aria-labelledby="td-ctx-week">
        <h3 id="td-ctx-week">{t('vWeek')}</h3>
        <WeekList sw={sw} todayDone={view.status === 'allDone'} extra={comebackBand(gap) === 'none' && restartDay === null ? <WeeklyBand today={today} /> : null} />
      </section>
      <section aria-labelledby="td-ctx-more">
        <h3 id="td-ctx-more">{t('vhMore')}</h3>
        <MoreRows today={today} done={done} idp="ctx-" />
        {done && (
          <div className="lx-vh-slot">
            <Slot name="today.extra" />
          </div>
        )}
      </section>
    </div>
  );
}
