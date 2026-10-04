import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { sectionsFor } from '../../app/registry';
import { HubSections } from '../../app/shell/Hub';
import { useLive } from '../../data/live';
import { addDays } from '../../domain/date';
import { fsrsMeasures } from '../../domain/progress/measures';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { useDocsOnce } from './useOnce';

// Reiter „Statistik" (plan.md §1.3, N91): der Platz `stand` – dort hängt P3 die Wortschatz-Statistik an
// (Prognose, Erinnerungsquote, Karten je Zustand). Solange kein Bereich dort etwas anmeldet, stehen hier
// die Karten-Messwerte (FSRS). Seit dem Fokus-Umbau keine Aktivitäts-Heatmap (Minuten sind keine Leistung).

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();

/** Karten-Messwerte (FSRS): Ersatz, bis P3 die Wortschatz-Statistik am Platz `stand` anmeldet. */
function FsrsMeasures() {
  const { t, num } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const paths = useMemo(() => Array.from({ length: 30 }, (_, k) => `log/${addDays(today, -k)}`), [today]);
  const logs = useDocsOnce(paths);
  const f = useMemo(() => fsrsMeasures(vocab, now, logs.status === 'ready' ? logs.value : undefined), [vocab, now, logs]);
  const pct = (x: number | null) => (x === null ? t('msNoData') : `${num(Math.round(x * 100))} %`);
  const rows: Array<[string, string]> = [
    [t('msState_new'), num(f.byState.new)],
    [t('msState_learning'), num(f.byState.learning)],
    [t('msState_review'), num(f.byState.review)],
    [t('msState_relearning'), num(f.byState.relearning)],
    [t('msRecall'), pct(f.meanR)],
    [t('msStability'), f.meanStability === null ? t('msNoData') : t('msStabilityDays', { n: Math.round(f.meanStability) })],
    [t('msLeeches'), num(f.leeches)],
    [t('msAccuracy'), logs.status === 'loading' ? '…' : f.accuracy30 ? `${pct(f.accuracy30.ok / f.accuracy30.n)} · ${num(f.accuracy30.n)}` : t('msNoData')],
  ];
  return (
    <Card data-testid="stats-fsrs">
      <table className="w-full text-left text-sm">
        <caption className="pb-2 text-left text-base font-semibold">{t('msFsrs')}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {k}
              </th>
              <td className="lx-tnum py-2 text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function StatsTab() {
  const hasStand = sectionsFor('stand').length > 0;
  return (
    <div className="flex flex-col gap-4" data-testid="stats">
      {hasStand ? <HubSections places={['stand']} /> : <FsrsMeasures />}
    </div>
  );
}
