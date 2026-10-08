import { useEffect, useMemo, useRef, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useNav, type Route } from '../../app/nav';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import type { AssessC1 } from '../../domain/assessment/types';
import { patchC1 } from '../../domain/c1/c1doc';
import { programChapters } from '../../domain/c1/chapters';
import { CRITERIA, type CritId, type Criterion } from '../../domain/c1/criteria';
import { fcOf, freezeIndex, withFc, type ForecastView } from '../../domain/c1/forecast';
import { openCrit, type Way } from '../../domain/c1/way';
import { preloadC1x } from '../../domain/c1x/preload';
import { CHECK_PART_MAX } from '../../domain/metrics/c1';
import { useT } from '../../i18n';
import { useWide } from '../../platform/input';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { topicName } from '../grammar/topicUi';
import { runAssess, stopAssess, useAssessRun } from '../progress/assessRun';
import { useDocsOnce } from '../progress/useOnce';
import { useChapterState } from './ProgramMap';
import { PATTERNS_DOC, wayFromLive, wayLogPaths } from './wayData';

// „Weg zu C1“ (Lernplattform 3.0 §4.4, P45): Kopfzeile im Fortschritt (Slot `progress.head`) und das Blatt.
// Handy, von oben nach unten: Urteil (1–2 Sätze, „von Claude · Stand <Datum>“), „Was dir noch fehlt“ (≤ 3 Zeilen mit „Üben“), K1–K7 (Zustandswort
// und EIN Beleg, Antippen öffnet das Detail mit den vier Fragen), Kapitelband (7 Segmente), Prognose, „Messwerte dahinter“ (eingeklappt).
// Laptop: zwei Spalten – links Urteil und Kriterien, rechts Kapitelband, Check-Verlauf und Prognose.
// Keine Prozentzahl „x % C1“. Der Satz „Sprechen, Hören und Lesen misst die App nicht“ steht immer; „C1-Etappe …“ nur, wenn K1–K7 erfüllt sind.
// Claude urteilt in assess@4 (höchstens alle 3 Tage, `complex`); ohne Claude steht die feste Zählung „a von 7 Kriterien erreicht“.
// Ohne `sample`/`not_granted` fehlt der Knopf, `rate_limited` zeigt einen Hinweis; nie ein automatischer zweiter Versuch.

type Doc = Record<string, unknown>;

/** Wohin „Üben“ je Kriterium führt; `null` = (noch) kein Übungsort (K7: Schreibklinik kommt mit P46/P47/P51). */
const PRACTICE: Record<CritId, Route | null> = {
  k1: { name: 'learn' },
  k2: { name: 'patterns' },
  k3: { name: 'vtest' },
  k4: { name: 'vocab' },
  k5: { name: 'apply' },
  k6: { name: 'apply' },
  k7: null,
};

const STATE_TONE: Record<Criterion['state'], string> = {
  met: 'text-success-text',
  course: 'text-accent',
  open: 'text-muted',
  few: 'text-subtle',
};

const dayMs = (d: string): number => Date.parse(`${d}T12:00:00`);
const monthLabel = (m: string, lang: 'de' | 'en'): string => {
  const [y, mo] = m.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(y ?? 2026, (mo ?? 1) - 1, 15));
};

// ------------------------------------------------------------------ Daten

/** Messwerte, Kriterien und Prognose. Protokolle und `app/patterns` werden nur gelesen, solange das Blatt offen ist. */
export function useWay(open: boolean): { way: Way; loading: boolean } {
  const today = useClock((s) => s.today);
  const nowMs = useClock((s) => s.now);
  const docs = useLive((s) => s.docs);
  const collections = useLive((s) => s.collections);
  const invalid = useLive((s) => s.invalid);
  const paths = useMemo(() => [...wayLogPaths(today), PATTERNS_DOC], [today]);
  const once = useDocsOnce(paths, open);
  const [items, setItems] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void preloadC1x(['err']).then(() => {
      if (alive) setItems((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [open]);
  const ready = once.status !== 'loading';
  const way = useMemo(() => {
    const logs: Doc[] | null = ready ? paths.slice(0, -1).flatMap((p) => (once.value.get(p) ? [once.value.get(p) as Doc] : [])) : null;
    return wayFromLive({ docs, collections, invalid }, { today, nowMs, logs, patterns: ready ? once.value.get(PATTERNS_DOC) : undefined });
    // `items`: nach dem Laden der Fehler-Aufgaben neu rechnen (K6 braucht sie).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, collections, invalid, today, nowMs, ready, once.value, paths, items]);
  return { way, loading: !ready };
}

// ------------------------------------------------------------------ Kopfzeile im Fortschritt

export function WayHead() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const state = useChapterState();
  const chs = programChapters();
  const cur = state.current >= 0 ? chs[state.current] : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('pxWayHeadAria')}
        aria-haspopup="dialog"
        data-testid="way-head"
        className="lx-glass flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors hover:bg-surface sm:px-6"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-semibold tracking-tight">{t('pxWayHead')}</span>
          <span className="truncate text-sm text-muted" data-testid="way-head-sub">
            {cur ? t('pxWayHeadSub', { n: cur.n, name: cur.name[lang] }) : t('pxWayHeadSubNone')}
          </span>
        </span>
        <Icon name="chevronRight" size={20} />
      </button>
      <WayToC1 open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ------------------------------------------------------------------ Blatt

export function WayToC1({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const wide = useWide();
  return (
    <Sheet open={open} onClose={onClose} title={t('pxWayTitle')} closeLabel={t('pxWayClose')} wide>
      {open && <WayBody wide={wide} onClose={onClose} />}
    </Sheet>
  );
}

function WayBody({ wide, onClose }: { wide: boolean; onClose: () => void }) {
  const { t } = useT();
  const today = useClock((s) => s.today);
  const { way, loading } = useWay(true);
  useFreeze(way, today, loading);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-2" data-testid="way-sheet" data-state="loading" aria-busy="true">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (way.empty) {
    return (
      <div className="flex flex-col gap-4 py-2" data-testid="way-sheet" data-state="empty">
        <h3 className="text-base font-semibold">{t('pxWayEmptyTitle')}</h3>
        <p className="text-sm text-muted">{t('pxWayEmpty')}</p>
        <p className="text-sm text-muted" data-testid="way-not-measured">
          {t('pxWayNotMeasured')}
        </p>
        <div>
          <Button variant="primary" onClick={() => go({ name: 'learn' }, onClose)} data-testid="way-empty-cta">
            {t('pxWayEmptyCta')}
          </Button>
        </div>
      </div>
    );
  }

  const left = (
    <>
      <p className="text-sm text-muted">{t('pxWayIntro')}</p>
      <Verdict way={way} />
      <Missing way={way} onClose={onClose} />
      <CritList way={way} />
    </>
  );
  const right = (
    <>
      <Band way={way} />
      <Forecast view={way.view} stage={way.crit.stage} />
      <More way={way} />
    </>
  );
  return (
    <div className="flex flex-col gap-6 py-2" data-testid="way-sheet" data-state="ready" data-met={way.crit.met} data-stage={way.crit.stage || undefined}>
      {wide ? (
        <div className="grid grid-cols-2 gap-6">
          <div className="flex min-w-0 flex-col gap-6" data-testid="way-col-left">
            {left}
          </div>
          <div className="flex min-w-0 flex-col gap-6" data-testid="way-col-right">
            {right}
          </div>
        </div>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
    </div>
  );
}

function go(route: Route, close: () => void): void {
  close();
  useNav.getState().go(route);
}

/**
 * Prognose einfrieren (§4.6): nur im Check-Fenster, nur für den Check dieses Monats, nur einmal und erst mit gelesenen Protokollen.
 * Danach zeigt die Anzeige nur den eingefrorenen Wert.
 */
function useFreeze(way: Way, today: string, loading: boolean): void {
  const done = useRef(false);
  useEffect(() => {
    if (loading || done.current) return;
    const idx = freezeIndex(way.c1, today);
    const check = way.c1.checks[idx];
    const fc = fcOf(way.calc);
    if (idx < 0 || !check || fc === undefined) return;
    done.current = true;
    void patchC1((doc) => withFc(doc, check.d, fc));
  }, [way, today, loading]);
}

// ------------------------------------------------------------------ Urteil

function useVerdict(): { c1: AssessC1 | null; d: string | null } {
  const { lang } = useT();
  const doc = useLive((s) => s.docs['app/assess']);
  return useMemo(() => {
    const a = readAssess(doc);
    // Gespeicherte Texte nur in ihrer eigenen Sprache (Kap. 10).
    if (!a || a.lang !== lang || !a.data.c1) return { c1: null, d: null };
    return { c1: a.data.c1, d: a.d };
  }, [doc, lang]);
}

function Verdict({ way }: { way: Way }) {
  const { t, date } = useT();
  const ai = useAiAvailable();
  const run = useAssessRun();
  const { c1, d } = useVerdict();
  const running = run.phase === 'locking' || run.phase === 'gathering' || run.phase === 'asking' || run.phase === 'saving';
  return (
    <section className="flex flex-col gap-2" aria-labelledby="way-verdict" data-testid="way-verdict" data-source={c1 ? 'claude' : 'app'} data-status={c1?.status}>
      <h3 id="way-verdict" className="lx-eyebrow">
        {t('pxWayVerdict')}
      </h3>
      {c1 ? (
        <>
          <span className="text-sm font-semibold text-accent" data-testid="way-status">
            {t(`pxWayStatus_${c1.status}`)}
          </span>
          <p className="text-base text-fg" data-testid="way-why">
            {c1.why}
          </p>
          <p className="text-xs text-subtle" data-testid="way-by">
            {t('pxWayBy', { date: d ? date(dayMs(d)) : '' })}
          </p>
        </>
      ) : (
        <>
          <p className="text-base text-fg" data-testid="way-fixed">
            {t('pxWayFixed', { a: way.crit.met })}
          </p>
          <p className="text-xs text-subtle">{t('pxWayFixedBy')}</p>
        </>
      )}
      {ai && running && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted" data-testid="way-asking">
            {run.aiPhase === 'slow' ? t('pxWaySlow') : t('pxWayAsking')}
          </p>
          <Button variant="ghost" icon="stop" onClick={stopAssess} data-testid="way-stop">
            {t('pxWayStop')}
          </Button>
        </div>
      )}
      {ai && !running && !c1 && (
        <div>
          <Button variant="secondary" icon="sparkle" onClick={() => void runAssess('manual')} data-testid="way-ask" data-ai="">
            {t('pxWayAsk')}
          </Button>
        </div>
      )}
      {run.phase === 'error' && (
        <p role="status" className="text-sm text-danger-text" data-testid="way-error">
          {t('pxWayErr')}
          {run.error && run.error !== 'assessFailed' ? ` ${t(run.error)}` : ''}
        </p>
      )}
      {run.phase === 'busy' && (
        <p role="status" className="text-sm text-muted" data-testid="way-busy">
          {t('pxWayBusy')}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Was dir noch fehlt

function Missing({ way, onClose }: { way: Way; onClose: () => void }) {
  const { t } = useT();
  const { c1 } = useVerdict();
  const open = openCrit(way.crit);
  // Claude nennt die wichtigsten (≤ 3); ohne Claude die offenen Kriterien in fester Reihenfolge, „auf Kurs“ zuerst.
  const rows = useMemo(() => {
    const byClaude = (c1?.missing ?? []).filter((m) => open.includes(m.crit as CritId)).map((m) => ({ id: m.crit as CritId, title: m.title }));
    if (byClaude.length) return byClaude.slice(0, 3);
    const rank = { course: 0, open: 1, few: 2, met: 3 } as const;
    return [...way.crit.list]
      .filter((c) => c.state !== 'met')
      .sort((a, b) => rank[a.state] - rank[b.state])
      .slice(0, 3)
      .map((c) => ({ id: c.id, title: t(`pxKGoal_${c.id}`) }));
  }, [c1, open, way.crit.list, t]);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="way-missing" data-testid="way-missing">
      <h3 id="way-missing" className="lx-eyebrow">
        {t('pxWayMissing')}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('pxWayAllMet')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const route = PRACTICE[r.id];
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-[0.875rem] border border-line p-3" data-testid="way-missing-row" data-crit={r.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-subtle">{t(`pxK_${r.id}`)}</span>
                  <span className="text-sm text-fg">{r.title}</span>
                </span>
                {route && (
                  <Button size="md" variant="secondary" onClick={() => go(route, onClose)} aria-label={t('pxWayPracticeAria', { name: t(`pxK_${r.id}`) })} data-testid="way-practice">
                    {t('pxWayPractice')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ K1–K7

/** Der eine Beleg einer Kriterienzeile (Text aus `p44`). */
export function evText(c: Criterion, t: (k: string, v?: Record<string, string | number>) => string, num: (n: number) => string): string {
  const e = c.ev;
  const n = (v: unknown): string => (typeof v === 'number' ? num(v) : '–');
  switch (c.id) {
    case 'k1':
      return c.state === 'few' ? t('pxKEvFew_k1') : t('pxKEv_k1', { safe: n(e.safe), total: n(e.total), gates: n(e.gates) });
    case 'k2':
      return c.state === 'few' ? t('pxKEvFew_k2') : t('pxKEv_k2', { n: n(e.relapses) });
    case 'k3':
      if (c.state === 'few') return e.old ? t('pxKEvOld_k3') : t('pxKEvFew_k3');
      return t('pxKEv_k3', { n: n(e.passive), lo: n(e.lo), hi: n(e.hi) });
    case 'k4':
      return c.state === 'few' ? t('pxKEvFew_k4') : t('pxKEv_k4', { n: n(e.fest) });
    case 'k5':
      return c.state === 'few' ? t('pxKEvFew_k5') : t('pxKEv_k5', { pts: n(typeof e.pct === 'number' ? Math.round(e.pct * 36) : null) });
    case 'k6':
      return c.state === 'few' ? t('pxKEvFew_k6', { n: n(e.n ?? 0) }) : t('pxKEv_k6', { ok: n(e.ok), n: n(e.n) });
    case 'k7':
      return c.state === 'few' ? t('pxKEvFew_k7', { words: n(e.words) }) : t('pxKEv_k7', { rate: typeof e.rate === 'number' ? e.rate.toFixed(1) : '–' });
  }
}

function CritList({ way }: { way: Way }) {
  const { t, lang } = useT();
  const [openId, setOpenId] = useState<CritId | null>(null);
  const fmt = useMemo(() => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US'), [lang]);
  const tt = t as (k: string, v?: Record<string, string | number>) => string;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="way-crit">
      <h3 id="way-crit" className="lx-eyebrow">
        {t('pxWayCrit')}
      </h3>
      <ul className="flex flex-col divide-y divide-line rounded-[0.875rem] border border-line" data-testid="way-crit">
        {CRITERIA.map((id) => {
          const c = way.crit.list.find((x) => x.id === id);
          if (!c) return null;
          const state = t(`pxKState_${c.state}`);
          const expanded = openId === id;
          return (
            <li key={id} data-testid="way-crit-row" data-crit={id} data-state={c.state}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`way-crit-${id}`}
                aria-label={t('pxWayCritAria', { name: t(`pxK_${id}`), state })}
                onClick={() => setOpenId(expanded ? null : id)}
                className="flex min-h-11 w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">{t(`pxK_${id}`)}</span>
                  <span className="text-xs text-muted" data-testid="way-crit-ev">
                    {evText(c, tt, (x) => fmt.format(x))}
                  </span>
                </span>
                <span className={`shrink-0 text-xs font-semibold ${STATE_TONE[c.state]}`} data-testid="way-crit-state">
                  {state}
                </span>
              </button>
              {expanded && (
                <dl id={`way-crit-${id}`} className="flex flex-col gap-2 px-3 pb-3 text-sm" data-testid="way-crit-detail">
                  <div>
                    <dt className="text-xs text-subtle">{t('pxKGoalLabel')}</dt>
                    <dd className="text-fg">{t(`pxKGoal_${id}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">{t('pxKWhyLabel')}</dt>
                    <dd className="text-muted">{t(`pxKWhy_${id}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">{t('pxKNowLabel')}</dt>
                    <dd className="text-muted">{evText(c, tt, (x) => fmt.format(x))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">{t('pxKReasonLabel', { state })}</dt>
                    <dd className="text-muted">{t(`pxKReason_${c.state}`)}</dd>
                  </div>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ Kapitelband

function Band({ way }: { way: Way }) {
  const { t, lang } = useT();
  const chs = programChapters();
  const passed = new Set(way.c1.gates.filter((g) => g.ok).map((g) => g.ch));
  if (chs.length !== way.chapters.chapters.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="way-band">
      <h3 id="way-band" className="lx-eyebrow">
        {t('pxWayBand')}
      </h3>
      <ol className="grid grid-cols-7 gap-1" data-testid="way-band">
        {way.chapters.chapters.map((p, k) => {
          const c = chs[k];
          const here = k === way.chapters.current;
          const done = p.status === 'done' || passed.has(k + 1);
          const state = done ? t('pxWayBandDone') : here ? t('pxWayBandHere') : t('pxWayBandOpen');
          return (
            <li
              key={p.id}
              className={`flex h-9 items-center justify-center rounded-md text-xs font-semibold ${here ? 'bg-accent text-on-accent' : done ? 'bg-surface text-fg' : 'border border-line text-subtle'}`}
              aria-label={t('pxWayBandAria', { n: k + 1, state })}
              title={c ? c.name[lang] : undefined}
              data-testid="way-band-seg"
              data-here={here || undefined}
              data-done={done || undefined}
            >
              {k + 1}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ Prognose

function Forecast({ view, stage }: { view: ForecastView; stage: boolean }) {
  const { t, lang, date } = useT();
  let text: string;
  switch (view.kind) {
    case 'wait':
      text = view.from ? t('pxWayFcWait', { date: date(dayMs(view.from)) }) : t('pxWayFcWaitNone');
      break;
    case 'pending':
      text = t('pxWayFcPending', { date: date(dayMs(view.next)) });
      break;
    case 'pause':
      text = t('pxWayFcPause');
      break;
    case 'range':
      text = `${t('pxWayFcRange', { from: monthLabel(view.from, lang), to: monthLabel(view.to, lang) })} ${t('pxWayFcLate', { name: t(`pxK_${view.late}`) })}`;
      break;
    case 'reached':
      text = '';
      break;
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="way-fc" data-testid="way-forecast" data-kind={view.kind}>
      <h3 id="way-fc" className="lx-eyebrow">
        {t('pxWayForecast')}
      </h3>
      {stage && (
        <p className="text-base font-semibold text-fg" data-testid="way-stage">
          {t('pxWayStage')}
        </p>
      )}
      {text && <p className="text-sm text-fg">{text}</p>}
      {view.kind === 'range' && <p className="text-xs text-subtle">{t('pxWayFcNote')}</p>}
      <p className="text-sm text-muted" data-testid="way-not-measured">
        {t('pxWayNotMeasured')}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ Messwerte dahinter

function More({ way }: { way: Way }) {
  const { t, lang, date } = useT();
  const grammar = useLive((s) => s.collections.grammar);
  const topics = useMemo(() => {
    const out: Array<{ id: string; p: number }> = [];
    for (const [id, d] of grammar ?? new Map<string, Doc>()) if (typeof d.p === 'number' && Number.isFinite(d.p)) out.push({ id, p: d.p });
    return out.sort((a, b) => a.p - b.p);
  }, [grammar]);
  const p = way.c1.place;
  const checks = [...way.c1.checks].sort((a, b) => b.d.localeCompare(a.d));
  const fmt2 = (x: number): string => x.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <section className="flex flex-col gap-2" data-testid="way-more">
      <Disclosure label={t('pxWayMore')} testId="way-more-toggle">
        <div className="flex flex-col gap-3 pt-2 text-sm text-muted">
          <p data-testid="way-place">
            {p
              ? typeof p.th === 'number' && typeof p.se === 'number'
                ? t('pxWayPlace', { date: date(dayMs(p.d)), th: fmt2(p.th), se: fmt2(p.se), n: p.n })
                : t('pxWayPlaceNoTh', { date: date(dayMs(p.d)), n: p.n })
              : t('pxWayPlaceNone')}
          </p>
          <div>
            <h4 className="text-xs text-subtle">{t('pxWayChecks')}</h4>
            {checks.length === 0 ? (
              <p>{t('pxWayChecksNone')}</p>
            ) : (
              <ul className="flex flex-col gap-1" data-testid="way-checks">
                {checks.map((c) => (
                  <li key={`${c.d}-${c.f}`}>
                    {t('pxWayCheckRow', {
                      date: date(dayMs(c.d)),
                      inp: c.inp === 'desk' ? t('pxWayDesk') : t('pxWayTouch'),
                      pts: c.pts,
                      a: Math.min(c.p[0], CHECK_PART_MAX[0]),
                      b: Math.min(c.p[1], CHECK_PART_MAX[1]),
                      c: Math.min(c.p[2], CHECK_PART_MAX[2]),
                      d: Math.min(c.p[3], CHECK_PART_MAX[3]),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {topics.length > 0 && (
            <div>
              <h4 className="text-xs text-subtle">{t('pxWayTopics')}</h4>
              <ul className="flex flex-col gap-1" data-testid="way-topics">
                {topics.map((x) => (
                  <li key={x.id}>{t('pxWayTopicRow', { name: topicName(x.id, lang), p: fmt2(x.p) })}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Disclosure>
    </section>
  );
}
