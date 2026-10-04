import { useMemo } from 'react';
import { useClock } from '../../../app/clock';
import { useNav } from '../../../app/nav';
import { useDocWatch } from '../../../data/watch';
import { COMPARE_PATH, compareOffer, inLastWeek, readCompare, type CompareRun, type CompareSide, type CompareVerdict, type Metrics } from '../../../domain/compare/compare';
import { useT } from '../../../i18n';
import { Card } from '../../../ui/Card';
import { Icon } from '../../../ui/Icon';

// Anzeige der monatlichen Vergleichsaufgabe (Backlog B1): beide Fassungen nebeneinander (Handy:
// untereinander) mit den drei Messwerten; ruhige Zeile auf Heute in der letzten Monatswoche und
// die Karte in „Dein Stand“ › Verlauf.

export const COMPARE_DOC = COMPARE_PATH;

/** „2026-08“ → „August“ (bzw. „August 2025“, wenn nicht aus dem laufenden Jahr). */
export function monthName(month: string, lang: 'de' | 'en', today: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  const d = new Date(y, m - 1, 15);
  const withYear = month.slice(0, 4) !== today.slice(0, 4);
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }).format(d);
}

/** Claudes Worten zum Vergleich (compare@1): Zusammenfassung, bis zu 3 Fortschritte, nächster Schritt, Stufe als Satz. */
export function CompareVerdictText({ v }: { v: Pick<CompareVerdict, 'summary' | 'better' | 'next' | 'level'> }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3" data-testid="cmp-verdict">
      <p className="text-[0.9375rem] leading-relaxed">{v.summary}</p>
      {v.better.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {v.better.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {v.next && (
        <p className="text-sm">
          <span className="font-semibold">{t('nbProfilCmpNextStep')} </span>
          {v.next}
        </p>
      )}
      {v.level && <p className="text-sm text-muted">{v.level}</p>}
    </div>
  );
}

function MetricLine({ m, speak }: { m: Metrics; speak: boolean }) {
  const { t } = useT();
  return (
    <p className="lx-tnum flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" data-testid="cmp-metrics" data-wpm={m.wpm ?? ''} data-per100={m.per100} data-phrases={m.phrases.length}>
      {speak && m.wpm !== undefined && <span>{t('nbProfilCmpWpm', { n: m.wpm })}</span>}
      <span>{t('nbProfilCmpTraps', { n: m.per100 })}</span>
      <span>{t('nbProfilCmpPhrases', { n: m.phrases.length })}</span>
    </p>
  );
}

function Side({ label, side, speak, testId }: { label: string; side: CompareSide; speak: boolean; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-control)] border border-line p-3" data-testid={testId}>
      <p className="lx-eyebrow text-subtle">{label}</p>
      <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-line" lang="en">
        {side.text}
      </p>
      <MetricLine m={side.m} speak={speak} />
    </div>
  );
}

/** Beide Fassungen nebeneinander, je Sprechen und Schreiben. Ohne frühere Fassung nur die heutige. */
export function CompareSides({ run, base }: { run: CompareRun; base: CompareRun | null }) {
  const { t, lang } = useT();
  const today = useClock((s) => s.today);
  const pair = (kind: 'speak' | 'write') => (
    <div className="flex flex-col gap-2" data-testid={`cmp-pair-${kind}`}>
      <h2 className="text-base font-semibold">{kind === 'speak' ? t('nbProfilCmpSpeak') : t('nbProfilCmpWrite')}</h2>
      <div className={`grid gap-3 ${base ? 'sm:grid-cols-2' : ''}`}>
        {base && <Side label={t('nbProfilCmpBefore', { month: monthName(base.month, lang, today) })} side={base[kind]} speak={kind === 'speak'} testId="cmp-before" />}
        <Side label={t('nbProfilCmpNow', { month: monthName(run.month, lang, today) })} side={run[kind]} speak={kind === 'speak'} testId="cmp-now" />
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-5" data-testid="cmp-sides">
      {pair('speak')}
      {pair('write')}
    </div>
  );
}

/** Ruhige Zeile auf Heute (letzte Monatswoche, noch kein Lauf in diesem Monat). */
export function TodayCompareRow() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const last = inLastWeek(today);
  const w = useDocWatch(COMPARE_DOC, last);
  const offer = useMemo(() => compareOffer(today, readCompare(w.data)), [today, w.data]);
  if (!last || w.status !== 'ready' || !offer.due) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-subtle" data-testid="today-compare">
      <Icon name="chart" size={14} />
      <span>{offer.base ? t('nbProfilCmpToday', { month: monthName(offer.base.month, lang, today) }) : t('nbProfilCmpTodayFirst')}</span>
      <button type="button" className="inline-flex min-h-11 items-center font-medium text-cyan-text underline-offset-2 hover:underline" onClick={() => go({ name: 'compare' })} data-testid="today-compare-open">
        {t('nbProfilCmpStart')}
      </button>
    </p>
  );
}

/** Karte in „Dein Stand“ › Verlauf: der letzte Vergleich mit Claudes Worten. */
export function CompareCard() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const w = useDocWatch(COMPARE_DOC);
  const runs = useMemo(() => readCompare(w.data), [w.data]);
  if (w.status !== 'ready') return null;
  const last = runs[runs.length - 1] ?? null;
  const base = last?.base ? (runs.find((r) => r.month === last.base) ?? null) : null;
  const offer = compareOffer(today, runs);
  return (
    <Card className="flex flex-col gap-4" data-testid="compare-card" data-n={runs.length}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{t('nbProfilCmpTitle')}</h2>
        <p className="text-sm text-muted">{last ? t('nbProfilCmpCardLead', { month: monthName(last.month, lang, today) }) : t('nbProfilCmpCardEmpty')}</p>
      </div>
      {last && <CompareSides run={last} base={base} />}
      {last?.verdict && <CompareVerdictText v={last.verdict} />}
      {offer.due && (
        <div>
          <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-text hover:underline" onClick={() => go({ name: 'compare' })} data-testid="compare-card-start">
            {t('nbProfilCmpStart')}
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}
    </Card>
  );
}
