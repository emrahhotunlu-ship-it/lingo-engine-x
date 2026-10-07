import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import { addDays } from '../../domain/date';
import { historySeries, type SeriesKey } from '../../domain/progress/history';
import { learningEffect, type Rate } from '../../domain/metrics';
import { bktMeasures } from '../../domain/progress/measures';
import { lastWeekOf } from '../../domain/progress/weekly';
import { useT, type MessageKey } from '../../i18n';
import { Fold, FoldGroup } from '../../ui/Fold';
import { LineChart } from '../../ui/charts/LineChart';
import { PatternsWeekly } from '../patterns/WeeklyTrend';
import { useDocsOnce } from './useOnce';

// Reiter „Verlauf" (plan.md §1.3, O14/O16/O17/O19): Fallen-Wochenzeile, Verlauf der letzten 120 Tage,
// Einschätzungen und die Grammatik-Messwerte (BKT) als zugeklappte Zeilen (Fokus-Umbau: nur Wörter und Grammatik). Tests und Wochenbericht liegen im Profil-Blatt, die Aktivitäts-Heatmap und
// die Karten-Messwerte (FSRS) im Reiter „Statistik“.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const SERIES: ReadonlyArray<{ key: SeriesKey; label: MessageKey; color: string }> = [
  { key: 'gr', label: 'hs_gr', color: 'var(--lx-ch-grammar)' },
  { key: 'vo', label: 'hs_vo', color: 'var(--lx-ch-cards)' },
];
const dayMs = (d: string) => Date.parse(`${d}T12:00:00`);

/** Grammatik-Messwerte (BKT) je Thema. */
function BktMeasures() {
  const { t, num, lang } = useT();
  const now = useClock((s) => s.now);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const b = useMemo(() => bktMeasures(grammar, now), [grammar, now]);
  return (
    <table className="w-full text-left text-xs">
      <caption className="pb-1 text-left text-sm font-semibold">{t('msBkt')}</caption>
      <thead>
        <tr className="text-subtle">
          <th scope="col" className="py-1 font-medium">
            {t('grammarLabel')}
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            {t('measuresMastery')}
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            {t('msLast10')}
          </th>
          <th scope="col" className="hidden py-1 text-right font-medium sm:table-cell">
            {t('msDue')}
          </th>
        </tr>
      </thead>
      <tbody>
        {b.map((r) => (
          <tr key={r.id} className="border-t border-line">
            <td className="py-1.5 pr-2 text-muted">
              {lang === 'en' ? r.nameEn : r.name} <span className="text-subtle">· {num(r.n)}</span>
            </td>
            <td className="lx-tnum py-1.5 text-right text-muted">{num(Math.round(r.p * 100))} %</td>
            <td className="lx-tnum py-1.5 text-right text-muted">{r.last10.n ? `${num(r.last10.ok)}/${num(r.last10.n)}` : '–'}</td>
            <td className="lx-tnum hidden py-1.5 text-right text-muted sm:table-cell">{r.due ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(r.due) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** „Messwerte dahinter“ (§4.9): die fünf Größen, an denen sich zeigt, ob die neue Methode wirkt. Fehlen Daten, steht „noch keine Daten“. */
function EffectMeasures() {
  const { t, num } = useT();
  const today = useClock((s) => s.today);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const paths = useMemo(() => Array.from({ length: 14 }, (_, k) => `log/${addDays(today, -k)}`), [today]);
  const logs = useDocsOnce(paths);
  const eff = useMemo(() => learningEffect({ grammarDocs: grammar, repairDoc, logs: logs.status === 'ready' ? [...logs.value.values()] : [], today }), [grammar, repairDoc, logs, today]);
  const none = t('hxEffectNone');
  const rate = (r: Rate | undefined) => (r && r.n > 0 ? t('hxEffectRate', { pct: num(Math.round((r.hit / r.n) * 100)), hit: num(r.hit), n: num(r.n) }) : none);
  const min = (v: number | null | undefined) => (typeof v === 'number' ? num(Math.round(v * 10) / 10) : '–');
  const steps = ([1, 2, 3, 5] as const).map((k) => eff?.minutesPerStep[k]);
  const hasMinutes = steps.some((x) => x && (x.t !== null || x.k !== null));
  const rows: Array<[string, string, string]> = [
    ['first', t('hxEffectFirst'), eff ? [eff.firstTry.box1, eff.firstTry.box3, eff.firstTry.box9].map(rate).join(' · ') : none],
    ['relapse', t('hxEffectRelapse'), eff ? rate(eff.relapse14) : none],
    ['pretest', t('hxEffectPretest'), eff ? rate(eff.pretest) : none],
    ['minutes', t('hxEffectMinutes'), eff && hasMinutes ? steps.map((x) => `${min(x?.t)} · ${min(x?.k)}`).join(' / ') : none],
    ['queue', t('hxEffectQueue'), eff ? `${num(eff.queue.today)} · ${num(eff.queue.max7)}` : none],
  ];
  return (
    <div className="flex flex-col gap-2" data-testid="effect-measures">
      <h3 className="text-sm font-semibold">{t('hxEffectTitle')}</h3>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[1fr_auto]">
        {rows.map(([id, label, value]) => (
          <div key={id} className="contents" data-testid="effect-row" data-id={id}>
            <dt className="text-muted">{label}</dt>
            <dd className="lx-tnum m-0 sm:text-right" data-testid={`effect-${id}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function HistoryTab() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const assessDoc = useLive((s) => s.docs['app/assess']);
  const { series, seam } = useMemo(() => historySeries(profile, today), [profile, today]);
  const lastWeek = useMemo(() => lastWeekOf(today), [today]);
  const hist = useMemo(() => readAssess(assessDoc)?.hist ?? [], [assessDoc]);
  const from = addDays(today, -119);
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(dayMs(d));
  const hasLines = SERIES.some((s) => series[s.key].length > 1);

  return (
    <div className="flex flex-col gap-4" data-testid="history">
      {/* O19: Deutsch-Fallen der letzten Woche – seltener, gleich oder häufiger. */}
      <PatternsWeekly firstDay={lastWeek.days[0] ?? today} />
      {/* Backlog B1: monatliche Vergleichsaufgabe – beide Fassungen und Claudes Worte. */}

      {/* Der Rest zugeklappt – nichts geht verloren, alles bleibt per Aufklappen erreichbar. */}
      <FoldGroup label={t('progHistory')}>
        <Fold title={t('historyTitle')} testId="history-fold" toggleTestId="history-toggle">
          {hasLines ? (
            <LineChart
              series={SERIES.map((s) => ({ key: s.key, label: t(s.label), color: s.color, points: series[s.key] }))}
              from={from}
              to={today}
              label={t('historyChartLabel')}
              seam={seam ? { d: seam, label: t('historySeam') } : null}
              tableLabel={t('tableShow')}
              dateLabel={t('colDate')}
              formatDate={fmt}
              testId="history-chart"
            />
          ) : (
            <p className="text-sm text-muted" data-testid="history-chart">
              {t('historyEmpty')}
            </p>
          )}
        </Fold>

        {hist.length > 0 && (
          <Fold title={t('histTraceTitle')} meta={hist.map((h) => h.cefr ?? '–').slice(-4).join(' → ')} toggleTestId="trace-toggle">
            <h3 className="text-sm font-semibold">{t('assessTrace')}</h3>
            <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="assess-trace">
              {hist.slice(-12).map((h) => (
                <li key={h.d} className="lx-tnum text-sm">
                  <span className="text-subtle">{fmt(h.d)}</span> <span className="font-semibold">{h.cefr ?? '–'}</span>
                </li>
              ))}
            </ol>
          </Fold>
        )}

        <Fold title={t('measuresToggle')} testId="measures" toggleTestId="measures-toggle">
          <EffectMeasures />
          <BktMeasures />
        </Fold>
      </FoldGroup>
    </div>
  );
}
