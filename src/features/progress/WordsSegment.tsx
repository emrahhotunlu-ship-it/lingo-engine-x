import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { invalidIdsOf, useLive } from '../../data/live';
import { FEST_GOAL, checkMean, expectedKnown, festCount, festForecast, festGrowth28, retention28, vtestView } from '../../domain/metrics';
import { buildTrainCards } from '../../domain/srs/cards';
import { useT } from '../../i18n';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
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
  const fest = useMemo(() => festCount(cards), [cards]);
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
        </div>
      </div>
    </Card>
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
          <TestsMeasures />
          <StatsTab />
          <PathTab part="cando" />
        </div>
      </Disclosure>
    </div>
  );
}
