import { addDays, isoWeek } from '../../domain/date';
import { trendOf, type FocusPoint, type PatternsDoc, type Trend } from '../../domain/patterns/patterns';
import { useT, type MessageKey } from '../../i18n';

// Kleine gemeinsame Bausteine der Deutsch-Fallen (Liste, „Dein Stand“, Wochenbericht).

export const TREND_KEY: Record<Trend, MessageKey> = { fewer: 'ptTrend_fewer', same: 'ptTrend_same', more: 'ptTrend_more' };
export const TREND_TONE: Record<Trend, string> = { fewer: 'text-accent-text', same: 'text-muted', more: 'text-gold-text' };

/** Diese Woche gegen letzte Woche (nach dem Lerntag `today`). */
export function currentTrend(doc: PatternsDoc, id: string, today: string) {
  return trendOf(doc.history, id, isoWeek(addDays(today, -7)), isoWeek(today));
}

export function TrendLine({ doc, id, today, testId }: { doc: PatternsDoc; id: string; today: string; testId?: string }) {
  const { t } = useT();
  const tr = currentTrend(doc, id, today);
  return (
    <p className="lx-tnum text-sm text-muted" data-testid={testId} data-prev={tr.prev} data-cur={tr.cur} data-trend={tr.trend}>
      {t('ptTrend', { prev: tr.prev, cur: tr.cur })} · <span className={TREND_TONE[tr.trend]}>{t(TREND_KEY[tr.trend])}</span>
    </p>
  );
}

/** Wochenfokus als Liste in der Oberflächensprache. */
export function FocusList({ points, testId }: { points: readonly FocusPoint[]; testId?: string }) {
  const { lang } = useT();
  return (
    <ul className="flex flex-col gap-1.5" data-testid={testId}>
      {points.map((p) => (
        <li key={p.id} className="flex gap-2 lx-t-support" data-testid="focus-point" data-id={p.id}>
          <span className="mt-2.5 size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
          <span>{lang === 'en' ? p.en : p.de}</span>
        </li>
      ))}
    </ul>
  );
}
