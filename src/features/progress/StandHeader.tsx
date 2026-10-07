import { useMemo } from 'react';
import { dayKeyNoon } from '../../domain/date';
import { levelBar, SCALE } from '../../domain/assessment/levelBar';
import { levelRank, type AssessData, type AssessDim, type Level } from '../../domain/assessment/types';
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

/** Position einer Stufe auf der kleinen Skala B1 … C1+ (0–1); die C1-Marke steht fest bei `C1_POS`. */
const scalePos = (level: Level): number => Math.min(1, Math.max(0, (levelRank(level) - 1) / (SCALE.length - 1)));
const C1_POS = SCALE.indexOf('C1') / (SCALE.length - 1);

/**
 * Kopfzeile von „Fortschritt“ (Lernplattform 2.0 §2.7): „Wörter B2+ · Grammatik B2“, je Bereich mit kleiner Skala und der Marke C1,
 * darunter die Begründung in Worten. Es gibt keine Gesamtstufe; `data-cefr` trägt die Gesamtstufe der Einschätzung nur als Datum für Tests.
 */
export function StandLevels({ dims, cefr, sameLang }: { dims: readonly AssessDim[]; cefr: Level | null; sameLang: boolean }) {
  const { t } = useT();
  const get = (id: 'vocabulary' | 'grammar'): AssessDim => dims.find((d) => d.id === id) ?? { id, level: null, confidence: 'thin', why: null };
  const rows = [get('vocabulary'), get('grammar')];
  const label = (d: AssessDim) => t(d.id === 'vocabulary' ? 'hxStandWords' : 'hxStandGrammar');
  return (
    <div className="flex flex-col gap-4" data-testid="stand-levels" data-cefr={cefr ?? ''}>
      <p className="lx-tnum text-lg font-semibold tracking-tight" data-testid="stand-line">
        {rows.map((d) => `${label(d)} ${d.level ?? '–'}`).join(' · ')}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-col gap-1.5" data-testid="dim" data-id={d.id} data-level={d.level ?? ''} data-confidence={d.confidence}>
            <span className="text-sm font-medium">{label(d)}</span>
            {d.level ? (
              <>
                <div className="relative h-2 rounded-full bg-track" role="img" aria-label={t('hxStandScale', { dim: label(d), level: d.level })}>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(4, scalePos(d.level) * 100)}%` }} />
                  <span className="absolute -top-1 h-4 w-0.5 bg-fg" style={{ left: `${C1_POS * 100}%` }} aria-hidden="true" data-testid="c1-mark" />
                </div>
                <span className="text-xs text-subtle">{t('hxStandC1')}</span>
                {sameLang && d.why && (
                  <span className="text-sm text-muted" data-testid="dim-why">
                    {d.why}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-muted">{t('dimNoEvidence')}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
