import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { toggleCanDo, useOptimistic } from '../../app/actions';
import { invalidIdsOf, useLive } from '../../data/live';
import { useDocWatch } from '../../data/watch';
import { readAssess } from '../../domain/assessment/envelope';
import { lastVtest, listenSources, writingSources } from '../../domain/assessment/sources';
import { TOPICS } from '../../domain/content';
import { topicP } from '../../domain/grammar/bkt';
import { canDoStatus, canDoSummary, CANDO_DIMS, CANDO_ITEMS, type CanDoEnv, type CanDoItem, type CanDoStatus } from '../../domain/progress/cando';
import { radarTotals } from '../../domain/progress/radar';
import { buildTrainCards } from '../../domain/srs/cards';
import { vocabGoal } from '../../domain/vocab/goal';
import { useT, type MessageKey } from '../../i18n';
import { Card } from '../../ui/Card';
import { Icon, type IconName } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { useCollectionsOnce } from './useOnce';

// Reiter „Weg nach C1" (Plan §7.2, E16): Can-Do-Liste mit Status je Punkt, dazu Claudes
// „was noch fehlt" (nur in der eigenen Sprache) und das Wortschatzziel 8.000.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const STATUS_ICON: Record<CanDoStatus, IconName> = { reached: 'check', self: 'flag', open: 'target', thin: 'info' };

export function PathTab() {
  const { t, lang } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const profile = useLive((s) => s.docs['app/profile']);
  const assessDoc = useLive((s) => s.docs['app/assess']);
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const invalid = useLive((s) => s.invalid);
  const optimistic = useOptimistic((s) => s.canDo);
  const radar = useDocWatch('app/radar');
  const once = useCollectionsOnce(['writing']);
  const assess = useMemo(() => readAssess(assessDoc), [assessDoc]);

  const env: CanDoEnv = useMemo(() => {
    const p = obj(profile);
    const ema = obj(p.ema);
    const n = obj(p.n);
    const vt = lastVtest(p);
    const sp = assess?.data.dims.find((d) => d.id === 'speaking');
    return {
      grammar: new Map(TOPICS.map((tp) => [tp.id, { p: topicP(tp.id, grammar.get(tp.id), now), n: typeof grammar.get(tp.id)?.n === 'number' ? (grammar.get(tp.id)?.n as number) : 0 }])),
      vtest: vt ? { passive: vt.passive, active: vt.active } : null,
      colloc: { ema: typeof ema.colloc === 'number' ? ema.colloc : null, n: typeof n.colloc === 'number' ? n.colloc : 0 },
      radar: radarTotals(radar.data?.events, now),
      writing: writingSources(once.value.writing ?? EMPTY).map((w) => ({ cefr: w.cefr, register: typeof w.scores.register === 'number' ? w.scores.register : null })),
      listening: listenSources(p),
      speaking: sp && sp.level && sp.confidence !== 'thin' ? sp.level : null,
      self: { ...obj(p.canDo), ...(optimistic ?? {}) },
    };
  }, [profile, grammar, now, radar.data, once.value, assess, optimistic]);

  const statusOf = (i: CanDoItem) => canDoStatus(i, env);
  const summary = canDoSummary(CANDO_ITEMS, statusOf);
  const goal = useMemo(() => vocabGoal({ profile, cards: buildTrainCards(vocab, now, invalidIdsOf(invalid, 'vocab')), today }), [profile, vocab, now, invalid, today]);
  const gap = assess && assess.lang === lang ? assess.data.c1gap : [];
  const levels = summary.map((s) => s.level);

  const goalText = !goal.measured || goal.now === null
    ? t('vgUnmeasured')
    : goal.reached
      ? t('vgReached', { now: goal.now })
      : goal.weeks !== null
        ? t('vgLine', { now: goal.now, weeks: goal.weeks })
        : t('vgLineNoPace', { now: goal.now });

  return (
    <div className="flex flex-col gap-4" data-testid="path">
      <Card aria-labelledby="vg-title" channel="cards">
        <p id="vg-title" className="lx-eyebrow">
          {t('vgTitle')}
        </p>
        <p className="mt-2 text-base font-medium" data-testid="vocab-goal" data-now={goal.now ?? ''}>
          {goalText}
        </p>
        {goal.measured && !goal.reached && goal.perWeek >= 1 && <p className="lx-tnum mt-1 text-sm text-muted">{t('vgPace', { n: goal.perWeek })}</p>}
      </Card>

      {gap.length > 0 && (
        <Card aria-labelledby="c1gap-title">
          <h2 id="c1gap-title" className="lx-eyebrow">
            {t('c1gapTitle')}
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
            {gap.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="cando-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cando-title" className="text-lg font-semibold">
            {t('canDoTitle')}
          </h2>
          <p className="lx-tnum flex gap-3 text-sm text-muted">
            {summary.map((s) => (
              <span key={s.level} data-testid="cando-count" data-level={s.level}>
                {t('canDoCount', { level: s.level, done: s.done, total: s.total })}
              </span>
            ))}
          </p>
        </div>
        {once.status === 'loading' && <Skeleton className="h-6 w-48" />}
        {levels.map((level) => (
          <div key={level} className="flex flex-col gap-2">
            <h3 className="lx-eyebrow">{level}</h3>
            <ul className="flex flex-col gap-2">
              {CANDO_ITEMS.filter((i) => i.level === level).map((i) => {
                const st = statusOf(i);
                const dim = CANDO_DIMS.find((d) => d.id === i.dim);
                const marked = st === 'self';
                return (
                  <li key={i.id} className="lx-glass flex items-start gap-3 rounded-[var(--radius-card)] p-4" data-testid="cando" data-id={i.id} data-status={st}>
                    <span className={`mt-0.5 inline-flex size-6 flex-none items-center justify-center rounded-full ${st === 'reached' ? 'text-accent-text' : 'text-muted'}`} aria-hidden="true">
                      <Icon name={STATUS_ICON[st]} size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm">{lang === 'en' ? i.en : i.de}</span>
                      <span className="text-xs text-subtle">
                        {dim ? `${lang === 'en' ? dim.en : dim.de} · ` : ''}
                        {t(`cdStatus_${st}` as MessageKey)}
                      </span>
                      {st !== 'reached' && <span className="text-xs text-muted">{lang === 'en' ? i.tip_en : i.tip_de}</span>}
                    </span>
                    {st !== 'reached' && (
                      <button
                        type="button"
                        className="lx-chip shrink-0"
                        aria-pressed={marked}
                        onClick={() => void toggleCanDo(i.id, !marked, today)}
                        data-testid="cando-self"
                      >
                        {t('canDoSelf')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
