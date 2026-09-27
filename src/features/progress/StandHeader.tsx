import { useMemo } from 'react';
import { dayKeyNoon } from '../../domain/date';
import { levelBar, SCALE } from '../../domain/assessment/levelBar';
import type { AssessData } from '../../domain/assessment/types';
import type { WeekDay, WeekDayState } from '../../domain/streak';
import { useT, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/Icon';

// Kopfzeile von „Dein Stand" (Funktionsabgleich M7): Wochenstreifen mit sieben Tagesringen Mo–So
// (Pflicht erledigt · Ruhetag · offen · kommt noch – dieselbe Regel wie die Serie) und die
// Niveau-Leiste B1 … C1+ mit Claudes Stufe als Punkt und der Belastbarkeit als hellem Band.
// Nie nur Farbe: jeder Ring hat Form, Zeichen und Beschriftung; die Leiste hat eine Textzeile.

const STATE_KEY: Record<WeekDayState, MessageKey> = { done: 'wkDone', rest: 'wkRest', open: 'wkOpen', future: 'wkFuture' };
const CONF_KEY = { thin: 'confThin', fair: 'confFair', good: 'confGood' } as const;

export function WeekStrip({ week }: { week: readonly WeekDay[] }) {
  const { t, tn, lang } = useT();
  const fmt = useMemo(() => {
    const short = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' });
    const long = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    return { short: (d: string) => short.format(dayKeyNoon(d)).replace(/\.$/, ''), long: (d: string) => long.format(dayKeyNoon(d)) };
  }, [lang]);
  const done = week.filter((d) => d.state === 'done').length;
  const rest = week.filter((d) => d.state === 'rest').length;
  return (
    <div className="flex flex-col gap-2" data-testid="week-strip">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="lx-eyebrow">{t('wkTitle')}</h2>
        <p className="lx-tnum text-xs text-muted" data-testid="week-summary">
          {tn('wkSummary', done)}
          {rest > 0 && ` · ${t('wkRestN')}`}
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={t('wkTitle')}>
        {week.map((d) => {
          const label = `${fmt.long(d.day)}: ${d.state === 'open' && !d.today ? t('wkMissed') : t(STATE_KEY[d.state])}`;
          return (
            <li key={d.day} className="flex flex-col items-center gap-1" data-testid="week-day" data-day={d.day} data-state={d.state} data-today={d.today ? '' : undefined} title={label}>
              <span className="sr-only">{label}</span>
              <span className="lx-ring" data-state={d.state} data-today={d.today ? '' : undefined} aria-hidden="true">
                {d.state === 'done' && <Icon name="check" size={16} />}
                {d.state === 'rest' && <span className="text-xs font-semibold">–</span>}
              </span>
              <span className={`text-2xs ${d.today ? 'font-semibold text-fg' : 'text-muted'}`} aria-hidden="true">
                {fmt.short(d.day)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LevelScale({ data }: { data: Pick<AssessData, 'cefr' | 'dims'> }) {
  const { t } = useT();
  const bar = levelBar(data);
  if (!bar || !data.cefr) return null;
  const step = 100 / SCALE.length;
  const center = (p: number) => (p + 0.5) * step;
  return (
    <div className="flex flex-col gap-2" data-testid="level-scale" data-pos={bar.pos} data-lo={bar.lo} data-hi={bar.hi}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="lx-eyebrow">{t('lvTitle')}</h2>
        <p className="text-xs text-muted" data-testid="level-caption">
          {t('lvCaption', { level: data.cefr, conf: t(CONF_KEY[bar.confidence]) })}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-track" aria-hidden="true">
        <span className="absolute inset-y-0 rounded-full bg-accent-soft" style={{ left: `${center(bar.lo) - step / 2}%`, width: `${center(bar.hi) - center(bar.lo) + step}%` }} data-testid="level-band" />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-[var(--lx-bg)]" style={{ left: `${bar.below ? 0 : center(bar.pos)}%` }} data-testid="level-dot" />
      </div>
      <ol className="grid text-center text-2xs text-muted" style={{ gridTemplateColumns: `repeat(${SCALE.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {SCALE.map((l, i) => (
          <li key={l} className={i === bar.pos ? 'font-semibold text-fg' : ''}>
            {l}
          </li>
        ))}
      </ol>
    </div>
  );
}
