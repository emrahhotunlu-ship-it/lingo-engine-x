import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { TOPICS } from '../../domain/content';
import { TOPIC_STAGES, errorSentenceStats, grammarDistribution, type TopicStage } from '../../domain/metrics/grammar';
import { useT, type MessageKey } from '../../i18n';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { PatternsStandCard } from '../patterns/StandCard';
import { ErrorRadar } from './ErrorsTab';

// Segment „Grammatik“ (Gesamtkonzept 3.5): höchstens drei Karten – Grammatik-Pfad („sicher z von 39“ mit
// Verteilung Neu · Lernt · Sicher · Fest), Fehlersätze (offen · fest · wiederkehrend) und Fehler-Radar.
// Deutsch-Fallen stehen unter „Messwerte dahinter“.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const TOPIC_IDS = TOPICS.map((tp) => tp.id);
const STAGE_FILL: Record<TopicStage, string> = { new: 'bg-track', learning: 'bg-accent-soft', safe: 'bg-accent opacity-60', firm: 'bg-accent' };

function PathCard() {
  const { t, num } = useT();
  const now = useClock((s) => s.now);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const d = useMemo(() => grammarDistribution(TOPIC_IDS, grammar, now), [grammar, now]);
  return (
    <Card aria-labelledby="gp-title" className="flex flex-col gap-3" data-testid="grammar-path" data-safe={d.safe} data-total={d.total}>
      <p id="gp-title" className="lx-eyebrow">
        {t('nbProfilGramTitle')}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="lx-tnum text-3xl font-semibold tracking-tight" data-testid="grammar-safe">
          {t('nbProfilGramBig', { n: num(d.safe), total: num(d.total) })}
        </span>
        <span className="text-sm text-muted">{t('nbProfilGramUnit')}</span>
      </p>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={t('nbProfilGramBar', { new: d.counts.new, learning: d.counts.learning, safe: d.counts.safe, firm: d.counts.firm })}
        data-testid="grammar-bar"
      >
        {TOPIC_STAGES.map((s) => (d.counts[s] > 0 ? <span key={s} className={`h-full rounded-sm ${STAGE_FILL[s]}`} style={{ width: `${(d.counts[s] / d.total) * 100}%` }} /> : null))}
      </div>
      <dl className="lx-tnum grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4" data-testid="grammar-legend">
        {TOPIC_STAGES.map((s) => (
          <div key={s} className="flex items-baseline gap-1.5" data-stage={s}>
            <span className={`inline-block size-2.5 shrink-0 self-center rounded-sm ${STAGE_FILL[s]}`} aria-hidden="true" />
            <dt className="text-muted">{t(`nbProfilStage_${s}` as MessageKey)}</dt>
            <dd className="font-medium text-fg">{num(d.counts[s])}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-subtle">{t('nbProfilGramNote')}</p>
    </Card>
  );
}

function ErrorSentencesCard() {
  const { t, num } = useT();
  const now = useClock((s) => s.now);
  const repair = useLive((s) => s.docs['app/repair']);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const e = useMemo(() => errorSentenceStats(repair as Doc | undefined, grammar, now), [repair, grammar, now]);
  const cells: Array<[MessageKey, number, string]> = [
    ['nbProfilErrOpen', e.open, 'open'],
    ['nbProfilErrFirm', e.firm, 'firm'],
    ['nbProfilErrRecurring', e.recurring, 'recurring'],
  ];
  return (
    <Card aria-labelledby="es-title" className="flex flex-col gap-3" data-testid="error-sentences" data-open={e.open} data-firm={e.firm} data-recurring={e.recurring} data-due={e.due}>
      <h2 id="es-title" className="text-lg font-semibold">
        {t('nbProfilErrTitle')}
      </h2>
      {e.open + e.firm === 0 ? (
        <p className="text-sm text-muted">{t('nbProfilErrEmpty')}</p>
      ) : (
        <>
          <dl className="lx-tnum grid grid-cols-3 gap-3">
            {cells.map(([k, n, id]) => (
              <div key={id} className="flex flex-col-reverse gap-0.5" data-testid={`errsent-${id}`}>
                <dt className="text-xs text-muted">{t(k)}</dt>
                <dd className="text-2xl font-semibold tracking-tight">{num(n)}</dd>
              </div>
            ))}
          </dl>
          {e.due > 0 && <p className="lx-tnum text-xs text-subtle">{`${num(e.due)} ${t('nbProfilErrDue')}`}</p>}
          <p className="text-xs text-subtle">{t('nbProfilErrLead')}</p>
        </>
      )}
    </Card>
  );
}

export function GrammarSegment() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4" data-testid="seg-grammar">
      <PathCard />
      <ErrorSentencesCard />
      <ErrorRadar />
      <Disclosure label={t('nbProfilMeasures')} testId="measures-grammar">
        <PatternsStandCard />
      </Disclosure>
    </div>
  );
}
