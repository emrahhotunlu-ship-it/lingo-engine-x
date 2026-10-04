import { useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { useCoach } from '../coach/store';
import { topicById } from '../coach/grammar';
import { stumbleStats } from '../coach/stumble';
import { catKey } from './writeLabels';

// Fahrplan-Baustein (docs/neustart.md §6 „je Fehlerart“):
// „Deine häufigsten Stolpersteine“ (Top 5 der letzten 30 Tage mit Pfeil).

export function PlanStumble() {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const writing = useCoach((s) => s.writing);
  const repair = useCoach((s) => s.repair);
  const stats = stumbleStats(writing, repair, today);
  const label = (key: string): string => {
    if (key.startsWith('topic:')) {
      const topic = topicById(key.slice(6));
      return topic ? (lang === 'de' ? topic.name : topic.name_en) : key.slice(6);
    }
    return t(catKey(key));
  };
  return (
    <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="plan-stumble">
      <h2 className="text-sm font-semibold">{t('schStumbleTitle')}</h2>
      {stats.length === 0 ? (
        <p className="mt-2 text-sm text-muted" data-testid="stumble-none">
          {t('schStumbleNone')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">{t('schStumbleIntro')}</p>
          <ol className="mt-3 divide-y divide-line/60" data-testid="stumble-list">
            {stats.map((s) => (
              <li key={s.key} className="flex items-center gap-3 py-2.5 text-sm" data-testid="stumble-item" data-key={s.key} data-trend={s.trend}>
                <span className="min-w-0 flex-1 truncate">{label(s.key)}</span>
                <span className="lx-tnum font-semibold">{t('schStumbleCount', { n: s.n })}</span>
                {s.trend === 'same' ? (
                  <span className="w-5 text-center text-muted" role="img" aria-label={t('schTrendSame')}>
                    –
                  </span>
                ) : (
                  <span
                    role="img"
                    aria-label={s.trend === 'up' ? t('schTrendUp') : t('schTrendDown')}
                    className={`grid w-5 place-items-center ${s.trend === 'up' ? 'text-danger-text' : 'text-accent-text'}`}
                  >
                    <Icon name={s.trend === 'up' ? 'arrowUp' : 'arrowDown'} size={16} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
