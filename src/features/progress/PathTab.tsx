import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { toggleCanDo, useOptimistic } from '../../app/actions';
import { invalidIdsOf, useLive } from '../../data/live';
import { useDocWatch } from '../../data/watch';
import { readAssess } from '../../domain/assessment/envelope';
import { lastVtest, listenSources, writingSources } from '../../domain/assessment/sources';
import { TOPICS } from '../../domain/content';
import { topicP } from '../../domain/grammar/bkt';
import { canDoEvidence, canDoStatus, canDoSummary, CANDO_DIMS, CANDO_ITEMS, type CanDoEnv, type CanDoItem, type CanDoStatus } from '../../domain/progress/cando';
import { radarTotals } from '../../domain/progress/radar';
import { buildTrainCards } from '../../domain/srs/cards';
import { vocabGoal } from '../../domain/vocab/goal';
import { useT, type MessageKey } from '../../i18n';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { Icon, type IconName } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { useCollectionsOnce } from './useOnce';

// Reiter „Weg nach C1" (Plan §7.2, E16): Can-Do-Liste mit Status je Punkt, dazu Claudes
// „was noch fehlt" (nur in der eigenen Sprache) und das Wortschatzziel 8.000. Kurz gehalten
// (UX-Beratung Nr. 6): je Stufe nur die ersten offenen Punkte, erreichte zugeklappt.
// N92: C1 zählt erst mit zwei Belegen (Zahl je Punkt sichtbar); „selbst eingeschätzt“ steht
// getrennt neben der Zahl und zählt nicht mit.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
/** Sichtbare offene Punkte je Stufe; der Rest liegt hinter „N weitere offen“. */
const SHOWN = 4;
const STATUS_ICON: Record<CanDoStatus, IconName> = { reached: 'check', self: 'flag', open: 'target', thin: 'info' };

export function PathTab() {
  const { t, tn, lang } = useT();
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
    const vtests = (Array.isArray(p.vtests) ? p.vtests : [])
      .map(obj)
      .filter((v) => typeof v.passive === 'number')
      .map((v) => ({ passive: v.passive as number, active: typeof v.active === 'number' ? v.active : 0 }));
    return {
      vtests,
      speakingConf: sp && sp.level && sp.confidence !== 'thin' ? sp.confidence : null,
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

  const goalText = !goal.measured || goal.now === null
    ? t('vgUnmeasured')
    : goal.reached
      ? t('vgReached', { now: goal.now })
      : goal.weeks !== null
        ? t('vgLine', { now: goal.now, weeks: goal.weeks })
        : t('vgLineNoPace', { now: goal.now });

  const itemRow = (i: CanDoItem) => {
    const st = statusOf(i);
    const dim = CANDO_DIMS.find((d) => d.id === i.dim);
    const marked = st === 'self';
    const evidence = i.level === 'C1' ? canDoEvidence(i, env) : 0;
    return (
      <li key={i.id} className="flex items-start gap-3 py-3" data-testid="cando" data-id={i.id} data-status={st}>
        <span className={`mt-0.5 inline-flex size-6 flex-none items-center justify-center rounded-full ${st === 'reached' ? 'text-accent-text' : 'text-muted'}`} aria-hidden="true">
          <Icon name={STATUS_ICON[st]} size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm">{lang === 'en' ? i.en : i.de}</span>
          <span className="text-xs text-subtle">
            {dim ? `${lang === 'en' ? dim.en : dim.de} · ` : ''}
            {t(`cdStatus_${st}` as MessageKey)}
          </span>
          {i.level === 'C1' && (st === 'reached' || evidence > 0) && (
            <span className="lx-tnum text-xs text-muted" data-testid="cando-evidence" data-n={evidence}>
              {tn('nbProfilEvidence', evidence)}
              {st !== 'reached' ? ` · ${t('nbProfilEvidenceNeed')}` : ''}
            </span>
          )}
          {st !== 'reached' && <span className="text-xs text-muted">{lang === 'en' ? i.tip_en : i.tip_de}</span>}
        </span>
        {st !== 'reached' && (
          <button type="button" className="lx-chip shrink-0" aria-pressed={marked} onClick={() => void toggleCanDo(i.id, !marked, today)} data-testid="cando-self">
            {t('canDoSelf')}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="path">
      {/* Das Wichtigste zuerst (UX-Beratung Nr. 6): Wortschatzziel und Claudes Lücke in einer Karte. */}
      <Card aria-labelledby="vg-title" className="flex flex-col gap-4">
        <div>
          <p id="vg-title" className="lx-eyebrow">
            {t('vgTitle')}
          </p>
          <p className="mt-2 text-base font-medium" data-testid="vocab-goal" data-now={goal.now ?? ''}>
            {goalText}
          </p>
          {goal.measured && !goal.reached && goal.perWeek >= 1 && <p className="lx-tnum mt-1 text-sm text-muted">{t('vgPace', { n: goal.perWeek })}</p>}
        </div>
        {gap.length > 0 && (
          <div className="border-t border-line pt-4">
            <h2 id="c1gap-title" className="text-sm font-semibold">
              {t('c1gapTitle')}
            </h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {gap.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Can-dos je Stufe: die ersten offenen Punkte sichtbar, weitere und erreichte zugeklappt. */}
      <section aria-labelledby="cando-title" className="flex flex-col gap-3">
        <h2 id="cando-title" className="text-lg font-semibold">
          {t('canDoTitle')}
        </h2>
        {once.status === 'loading' && <Skeleton className="h-6 w-48" />}
        {summary.map((s) => {
          const all = CANDO_ITEMS.filter((i) => i.level === s.level);
          const todo = all.filter((i) => statusOf(i) !== 'reached');
          const reached = all.filter((i) => statusOf(i) === 'reached');
          return (
            <Card key={s.level} as="div" className="flex flex-col py-3 sm:py-4" data-testid="cando-level" data-level={s.level}>
              <div className="flex items-baseline justify-between gap-3 py-2">
                <h3 className="text-base font-semibold">{s.level}</h3>
                <p className="lx-tnum text-right text-sm text-muted" data-testid="cando-count" data-level={s.level} data-done={s.done} data-self={s.self}>
                  {t('nbProfilCanDoCount', { level: s.level, done: s.done, total: s.total })}
                  {s.self > 0 && <span className="block text-xs text-subtle">{t('nbProfilCanDoSelf', { n: s.self })}</span>}
                </p>
              </div>
              {todo.length > 0 && <ul className="flex flex-col divide-y divide-line border-t border-line">{todo.slice(0, SHOWN).map(itemRow)}</ul>}
              {todo.length > SHOWN && (
                <div className="border-t border-line">
                  <Disclosure label={tn('canDoMore', todo.length - SHOWN)} testId="cando-more">
                    <ul className="flex flex-col divide-y divide-line">{todo.slice(SHOWN).map(itemRow)}</ul>
                  </Disclosure>
                </div>
              )}
              {reached.length > 0 && (
                <div className="border-t border-line">
                  <Disclosure label={tn('canDoReached', reached.length)} testId="cando-reached">
                    <ul className="flex flex-col divide-y divide-line">{reached.map(itemRow)}</ul>
                  </Disclosure>
                </div>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
