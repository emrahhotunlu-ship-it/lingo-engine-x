import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import { LESSONS, UNITS } from '../../domain/content';
import { addDays } from '../../domain/date';
import { historySeries, type SeriesKey } from '../../domain/progress/history';
import { bktMeasures } from '../../domain/progress/measures';
import { lastWeekOf } from '../../domain/progress/weekly';
import { useT, type MessageKey } from '../../i18n';
import { Fold, FoldGroup } from '../../ui/Fold';
import { LineChart } from '../../ui/charts/LineChart';
import { LegacyFeedFold } from './ChecksCard';
import { PatternsWeekly } from '../patterns/WeeklyTrend';

// Reiter „Verlauf" (plan.md §1.3, O14/O16/O17/O19): Fallen-Wochenzeile, Verlauf der letzten 120 Tage,
// Einschätzungen und Meilensteine, alte Fortschritte und die Grammatik-Messwerte (BKT) als
// zugeklappte Zeilen. Tests und Wochenbericht liegen im Profil-Blatt, die Aktivitäts-Heatmap und
// die Karten-Messwerte (FSRS) im Reiter „Statistik“.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const SERIES: ReadonlyArray<{ key: SeriesKey; label: MessageKey; color: string }> = [
  { key: 'gr', label: 'hs_gr', color: 'var(--lx-ch-grammar)' },
  { key: 'vo', label: 'hs_vo', color: 'var(--lx-ch-cards)' },
  { key: 'li', label: 'hs_li', color: 'var(--lx-ch-listen)' },
  { key: 'wr', label: 'hs_wr', color: 'var(--lx-ch-write)' },
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

export function HistoryTab() {
  const { t, date, lang } = useT();
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const course = useLive((s) => s.docs['app/course']);
  const assessDoc = useLive((s) => s.docs['app/assess']);
  const { series, seam } = useMemo(() => historySeries(profile, today), [profile, today]);
  const lastWeek = useMemo(() => lastWeekOf(today), [today]);
  const hist = useMemo(() => readAssess(assessDoc)?.hist ?? [], [assessDoc]);
  const from = addDays(today, -119);
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(dayMs(d));
  const hasLines = SERIES.some((s) => series[s.key].length > 1);

  const milestones = useMemo(() => {
    const done = obj(obj(course).done);
    return UNITS.map((u) => {
      const ls = LESSONS.filter((l) => l.unit === u.id);
      const ds = ls.map((l) => obj(done[l.id]).d).filter((d): d is string => typeof d === 'string');
      return ds.length === ls.length && ls.length ? { id: u.id, de: u.de, en: u.en, d: ds.sort().at(-1) ?? '' } : null;
    }).filter((x): x is { id: string; de: string; en: string; d: string } => !!x);
  }, [course]);

  return (
    <div className="flex flex-col gap-4" data-testid="history">
      {/* O19: Deutsch-Fallen der letzten Woche – seltener, gleich oder häufiger. */}
      <PatternsWeekly firstDay={lastWeek.days[0] ?? today} />

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

        {(hist.length > 0 || milestones.length > 0) && (
          <Fold title={t('histTraceTitle')} meta={hist.length > 0 ? hist.map((h) => h.cefr ?? '–').slice(-4).join(' → ') : undefined} toggleTestId="trace-toggle">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">{t('assessTrace')}</h3>
                <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="assess-trace">
                  {hist.slice(-12).map((h) => (
                    <li key={h.d} className="lx-tnum text-sm">
                      <span className="text-subtle">{fmt(h.d)}</span> <span className="font-semibold">{h.cefr ?? '–'}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t('milestones')}</h3>
                {milestones.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">{t('milestonesNone')}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                    {milestones.map((m) => (
                      <li key={m.id}>{t('milestoneUnit', { unit: lang === 'en' ? m.en : m.de, date: date(dayMs(m.d)) })}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Fold>
        )}

        <LegacyFeedFold />

        <Fold title={t('measuresToggle')} testId="measures" toggleTestId="measures-toggle">
          <BktMeasures />
        </Fold>
      </FoldGroup>
    </div>
  );
}
