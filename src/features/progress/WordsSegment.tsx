import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { invalidIdsOf, useLive } from '../../data/live';
import { FEST_GOAL, festNoteActive, buildTrainCards, checkMean, expectedKnown, festCount, festForecast, festGrowth28, retention28, vtestView } from '../../domain/metrics';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { activationRates, ratePct, readyCount } from '../../domain/activation/ready';
import { useActs } from '../vocab/actStore';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { WK_MIN_N, WK_TARGETS, wordKernStats, type Rate } from '../../domain/metrics/wordKern';
import type { MessageKey } from '../../i18n';
import { PathTab } from './PathTab';
import { StatsTab } from './StatsTab';

// Segment „Wörter“ (Gesamtkonzept 3.5): höchstens drei Karten – Fest (Zuwachs und Prognose), Wortschatzziel,
// „Wie gut sitzt es?“ (Erwartet gekonnt, Behalten nach Pause). Alles andere steht unter „Messwerte dahinter“.
// Die große Fest-Zahl steht im Kopf der Seite, hier nicht noch einmal. Alle Zahlen sinken bei Pausen.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Cards und Fest-Zahl: eine Quelle für Kopf und Segment. */
export function useVocabMetrics() {
  const now = useClock((s) => s.now);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const invalid = useLive((s) => s.invalid);
  const cards = useMemo(() => buildTrainCards(vocab, now, invalidIdsOf(invalid, 'vocab')), [vocab, now, invalid]);
  const fest = useMemo(() => festCount(cards, now), [cards, now]);
  return { cards, fest, now };
}

function FestCard({ fest }: { fest: number }) {
  const { t, num } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const growth = useMemo(() => festGrowth28(fest, (profile as Doc | undefined)?.history, today), [fest, profile, today]);
  const forecast = useMemo(() => festForecast(fest, growth, FEST_GOAL), [fest, growth]);
  const head = growth
    ? growth.delta > 0
      ? t('nbProfilFestGrow', { n: num(growth.delta) })
      : growth.delta < 0
        ? t('nbProfilFestShrink', { n: num(growth.delta) })
        : t('nbProfilFestSame')
    : fest === 0
      ? t('nbProfilFestEmpty')
      : t('nbProfilFestNoTrend');
  return (
    <Card aria-labelledby="fest-title" className="flex flex-col gap-2" data-testid="fest-card" data-delta={growth?.delta ?? ''}>
      <p id="fest-title" className="lx-eyebrow">
        {t('nbProfilFestTitle')}
      </p>
      <p className={growth ? 'lx-tnum text-2xl font-semibold tracking-tight' : 'text-sm text-muted'} data-testid="fest-growth">
        {head}
      </p>
      {forecast && (
        <p className="text-sm text-muted" data-testid="fest-forecast">
          {t('nbProfilFestForecast', { goal: num(FEST_GOAL), lo: forecast.weeksLo, hi: forecast.weeksHi })}
        </p>
      )}
      {growth && growth.delta < 0 && <p className="text-sm text-muted">{t('nbProfilFestPause')}</p>}
      <p className="text-xs text-subtle">{t('nbProfilFestExplain')}</p>
      {festNoteActive(today) && (
        <p className="text-sm text-muted" data-testid="fest-rule-note">
          {t('stxFestRuleNote')}
        </p>
      )}
    </Card>
  );
}

function QualityCard({ cards, now }: { cards: ReturnType<typeof useVocabMetrics>['cards']; now: number }) {
  const { t, num } = useT();
  const expected = useMemo(() => expectedKnown(cards, now), [cards, now]);
  const learned = useMemo(() => cards.filter((c) => !c.hidden && !c.isNew).length, [cards]);
  const ret = useMemo(() => retention28(cards, now), [cards, now]);
  const bandKey = ret.band === 'low' ? 'nbProfilRetentionLow' : ret.band === 'high' ? 'nbProfilRetentionHigh' : 'nbProfilRetentionIn';
  return (
    <Card aria-labelledby="qual-title" className="flex flex-col gap-4" data-testid="quality-card">
      <p id="qual-title" className="lx-eyebrow">
        {t('nbProfilQualTitle')}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t('nbProfilExpected')}</span>
          <span className="lx-tnum text-2xl font-semibold tracking-tight" data-testid="expected-known">
            {num(expected)}
          </span>
          <span className="text-xs text-subtle">{t('nbProfilExpectedSub', { n: num(learned) })}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{t('nbProfilRetention')}</span>
          <span className="lx-tnum text-2xl font-semibold tracking-tight" data-testid="retention-28" data-n={ret.n}>
            {ret.enough && ret.rate !== null ? `${num(Math.round(ret.rate * 100))} %` : '–'}
          </span>
          <span className="text-xs text-subtle" data-testid="retention-note">
            {ret.enough ? t(bandKey) : t('nbProfilRetentionNone', { n: num(ret.n) })}
          </span>
          <span className="text-xs text-subtle">{t('nbProfilRetentionSub')}</span>
          {ret.recognition.rate !== null && (
            <span className="lx-tnum text-xs text-subtle" data-testid="retention-recognition">
              {t('stxRetentionRecognition', { pct: num(Math.round(ret.recognition.rate * 100)), n: num(ret.recognition.n) })}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * „Einsatzbereit“ (Wörter aktivieren, Stufe 2): die vierte Zahl, eingeklappt unter den Messwerten. Aus `act/…` berechnet, nie gespeichert. Dazu der Begleitwert:
 * Trefferquote mit gezeigtem Wort gegen ohne (A4) – nur mit genug geprüften Aktivierungen.
 */
function ReadyMeasure({ cards }: { cards: ReturnType<typeof useVocabMetrics>['cards'] }) {
  const { t, num } = useT();
  const today = useClock((s) => s.today);
  const entries = useActs((s) => s.entries);
  const n = useMemo(() => readyCount(cards, entries, today), [cards, entries, today]);
  const rates = useMemo(() => activationRates(entries), [entries]);
  const a = ratePct(rates.shown);
  const b = ratePct(rates.hidden);
  return (
    <div className="flex flex-col gap-1" data-testid="ready-measure" data-n={n}>
      <h3 className="text-sm font-semibold">{t('readyLabel')}</h3>
      <p className="lx-tnum text-2xl font-semibold tracking-tight" data-testid="ready-count">
        {t('readyCount', { n: num(n) })}
      </p>
      <p className="lx-tnum text-xs text-subtle" data-testid="ready-rate">
        {a === null && b === null ? t('readyRateNone') : t('readyRate', { a: a === null ? '–' : `${num(a)} %`, b: b === null ? '–' : `${num(b)} %` })}
      </p>
      <p className="text-xs text-subtle">{t('readyHelp')}</p>
    </div>
  );
}

/** Wochen-Check (erst ab 3 Checks) und Wortschatztest (nur mit belastbarer Messung), eingeklappt unter den Messwerten. */
function TestsMeasures() {
  const { t, num, date } = useT();
  const now = useClock((s) => s.now);
  const profile = useLive((s) => s.docs['app/profile']);
  const checks = useMemo(() => checkMean(profile), [profile]);
  const vt = useMemo(() => vtestView(profile as Doc | undefined, now), [profile, now]);
  return (
    <div className="flex flex-col gap-4" data-testid="tests-measures">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t('nbProfilCheckTitle')}</h3>
        {checks.enough && checks.vocab !== null && checks.gram !== null ? (
          <>
            <p className="lx-tnum text-sm text-muted" data-testid="check-mean">
              {t('nbProfilCheckMean', { k: checks.k, v: num(checks.vocab), g: num(checks.gram) })}
            </p>
            <p className="text-xs text-subtle">{t('nbProfilCheckNote')}</p>
          </>
        ) : (
          <p className="text-sm text-muted" data-testid="check-mean">
            {t('nbProfilCheckNeed', { n: checks.n })}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t('nbProfilVtestTitle')}</h3>
        <p className="lx-tnum text-sm text-muted" data-testid="vtest-measure">
          {vt.state === 'none'
            ? t('nbProfilVtestNone')
            : vt.state === 'old'
              ? t('nbProfilVtestOld')
              : vt.lo !== null && vt.hi !== null
                ? t('nbProfilVtestRange', { lo: num(vt.lo), hi: num(vt.hi), date: date(vt.t) })
                : t('nbProfilVtestPoint', { n: num(vt.passive), date: date(vt.t) })}
        </p>
      </div>
    </div>
  );
}

type WkRow = { id: string; label: MessageKey; value: string | null; target: MessageKey; ok: boolean | null };

/**
 * Wort-Lernen 2 (Paket „Kern“): sechs Kennzahlen in Worten – gemessen am freien Abruf, nicht am Erkennen (`metrics/wordKern.ts`).
 * Vokabeln und Wendungen. Unter 5 Messpunkten steht „noch zu wenige Messwerte“ statt einer Zahl.
 */
function WordKernMeasure({ cards, now }: { cards: ReturnType<typeof useVocabMetrics>['cards']; now: number }) {
  const { t, num } = useT();
  const today = useClock((s) => s.today);
  const chunkDocs = useLive((s) => s.collections.chunk) ?? EMPTY;
  const invalid = useLive((s) => s.invalid);
  const chunks = useMemo(() => buildChunkCards(chunkDocs, now, invalidIdsOf(invalid, 'chunk')), [chunkDocs, now, invalid]);
  const st = useMemo(() => wordKernStats([...cards, ...chunks], today), [cards, chunks, today]);
  const pctOf = (r: Rate): string | null => (r.share === null || r.n < WK_MIN_N ? null : t('pxWkPct', { pct: num(Math.round(r.share * 100)), n: num(r.n) }));
  const atLeast = (r: Rate, goal: number): boolean | null => (r.share === null || r.n < WK_MIN_N ? null : r.share >= goal);
  const rows: WkRow[] = [
    { id: 'next-day', label: 'pxWkNextDayLabel', value: pctOf(st.nextDay), target: 'pxWkTargetNextDay', ok: atLeast(st.nextDay, WK_TARGETS.nextDay) },
    { id: 'chunk-first', label: 'pxWkChunkFirstLabel', value: pctOf(st.chunkFirst), target: 'pxWkTargetChunkFirst', ok: atLeast(st.chunkFirst, WK_TARGETS.chunkFirst) },
    { id: 'long-gap', label: 'pxWkLongGapLabel', value: pctOf(st.longGap), target: 'pxWkTargetLongGap', ok: atLeast(st.longGap, WK_TARGETS.longGap) },
    {
      id: 'median-safe',
      label: 'pxWkMedianSafeLabel',
      value: st.medianSafe.days === null || st.medianSafe.n < WK_MIN_N ? null : t(Math.round(st.medianSafe.days) === 1 ? 'pxWkDays_one' : 'pxWkDays_other', { n: num(Math.round(st.medianSafe.days)), k: num(st.medianSafe.n) }),
      target: 'pxWkTargetMedianSafe',
      ok: st.medianSafe.days === null || st.medianSafe.n < WK_MIN_N ? null : st.medianSafe.days <= WK_TARGETS.medianSafeDays,
    },
    {
      id: 'problem',
      label: 'pxWkProblemLabel',
      value: st.problem.share === null || st.problem.of < WK_MIN_N ? null : t('pxWkProblemValue', { pct: num(Math.round(st.problem.share * 100)), n: num(st.problem.n), of: num(st.problem.of) }),
      target: 'pxWkTargetProblem',
      ok: st.problem.share === null || st.problem.of < WK_MIN_N ? null : st.problem.share < WK_TARGETS.problemShare,
    },
    {
      id: 'ratio',
      label: 'pxWkRatioLabel',
      value: st.ratio.free + st.ratio.recog < WK_MIN_N ? null : t('pxWkRatioValue', { free: num(st.ratio.free), recog: num(st.ratio.recog) }),
      target: 'pxWkTargetRatio',
      ok: st.ratio.free + st.ratio.recog < WK_MIN_N ? null : st.ratio.free >= WK_TARGETS.freeToRecog * st.ratio.recog,
    },
  ];
  return (
    <div className="flex flex-col gap-2" data-testid="word-kern-measure">
      <h3 className="text-sm font-semibold">{t('pxWkTitle')}</h3>
      <p className="text-xs text-subtle">{t('pxWkLead')}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5" data-testid={`wk-${r.id}`} data-ok={r.ok === null ? '' : r.ok ? '1' : '0'}>
            <span className="text-sm text-muted">{t(r.label)}</span>
            <span className="lx-tnum text-sm font-medium">{r.value ?? t('pxWkNoData')}</span>
            <span className="text-xs text-subtle">
              {t(r.target)}
              {r.ok !== null && ` · ${t(r.ok ? 'pxWkOnTarget' : 'pxWkOffTarget')}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WordsSegment() {
  const { t } = useT();
  const { cards, fest, now } = useVocabMetrics();
  return (
    <div className="flex flex-col gap-4" data-testid="seg-words">
      <FestCard fest={fest} />
      <PathTab part="goal" />
      <QualityCard cards={cards} now={now} />
      <Disclosure label={t('nbProfilMeasures')} testId="measures-words">
        <div className="flex flex-col gap-6">
          <WordKernMeasure cards={cards} now={now} />
          <ReadyMeasure cards={cards} />
          <TestsMeasures />
          <StatsTab />
          <PathTab part="cando" />
        </div>
      </Disclosure>
    </div>
  );
}
