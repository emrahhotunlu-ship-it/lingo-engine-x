import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useDocWatch } from '../../data/watch';
import { topicName } from '../../domain/progress/weekly';
import { radarView, type RadarRow } from '../../domain/progress/radar';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { actionRoute, startAction } from './actionRoute';

// Reiter „Fehler" (Plan §7.1): Fehler-Radar der letzten 30 Tage je Kategorie mit Veränderung zu
// den 30 Tagen davor, Quellen und zwei Beispielen. `app/radar` wird nur abonniert, solange der
// Reiter offen ist (Plan E19).

export function radarName(r: Pick<RadarRow, 'c' | 'kind'>, t: (k: MessageKey) => string, lang: 'de' | 'en'): string {
  if (r.kind === 'cat') return t(`rc_${r.c}` as MessageKey);
  if (r.kind === 'topic') return topicName(r.c, lang);
  return r.c;
}

export function ErrorsTab() {
  const { t, tn, lang, num } = useT();
  const api = useHiddenInput();
  const now = useClock((s) => s.now);
  const radar = useDocWatch('app/radar');
  const rows = useMemo(() => radarView(radar.data?.events, now), [radar.data, now]);

  if (radar.status === 'loading') {
    return (
      <div role="status" aria-label={t('radarLoading')} className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <section aria-labelledby="radar-title" className="flex flex-col gap-4" data-testid="radar">
      <h2 id="radar-title" className="text-lg font-semibold">
        {t('radarTitle')}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('radarEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.c}>
              <Card className="flex flex-col gap-3" data-testid="radar-row" data-c={r.c} data-trend={r.trend}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-base font-semibold">{radarName(r, t, lang)}</h3>
                    <p className="text-sm text-muted">{t(`radarTrend_${r.trend}`, { n: r.nPrev30 })}</p>
                    {r.sources.length > 0 && (
                      <p className="text-xs text-subtle">
                        {t('radarSources')}: {r.sources.map((s) => t(`src_${s}` as MessageKey)).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="lx-tnum shrink-0 text-right">
                    <span className="text-3xl font-semibold tracking-tight">{num(r.n30)}</span>
                    <span className="block text-xs text-muted">{tn('radarUnit', r.n30)}</span>
                  </p>
                </div>
                {r.examples.length > 0 && (
                  <ul className="flex flex-col gap-2 border-t border-line pt-3" aria-label={t('radarExamples')}>
                    {r.examples.map((e, i) => (
                      <li key={i} className="flex flex-col gap-0.5 text-sm">
                        {e.g && (
                          <span className="text-danger-text line-through decoration-1" lang="en">
                            {e.g}
                          </span>
                        )}
                        {e.a && <EnglishText text={e.a} area="lookup" source="radar" as="span" className="text-accent-text" />}
                      </li>
                    ))}
                  </ul>
                )}
                {actionRoute(r.action) && r.action && (
                  <div>
                    <Button icon="arrowRight" onClick={() => startAction(r.action ?? '', api)} data-testid="radar-practice">
                      {t('practice')}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
