import { useMachine } from '@xstate/react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNav, type UnitCtx } from '../../app/nav';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { stepsFor, stepState, type DiscStep } from '../../domain/discover/steps';
import { shuffleOptions } from '../../domain/input/questions';
import type { ChoiceResult, FeedItem } from '../../domain/input/types';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { Stepper, type StepItem } from '../../ui/Stepper';
import { toast } from '../../ui/Toast';
import { useActiveClock } from '../input/activeClock';
import { completeDiscover, markDiscStep, recordDiscoverAnswers } from '../input/complete';
import { QuestionCard } from '../input/QuestionCard';
import { StatusLine } from '../input/StatusLine';
import { UnitShell } from '../input/UnitShell';
import { useFeedItems, useFeedSubscription } from './feedStore';
import { discoverMachine } from './machine';
import { PrepStep, TakeStep, UseStep, DoneStep, loadSent, saveSent } from './steps';

// Ein Beitrag als Lektion (Kap. 6.9, Plan §4.4 Nr. 2–6): Schritte nach `stepsFor`, Wiedereinstieg
// im ersten offenen Schritt; jeder abgeschlossene Schritt ist Zustand (Häkchen), kein Knopf.

export function ItemScreen({ feedId, itemId, ctx }: { feedId: string; itemId: string; ctx: UnitCtx }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  useFeedSubscription();
  const { status, items } = useFeedItems();
  const item = useMemo(() => items.find((i) => i.itemId === itemId && i.feedId === feedId) ?? items.find((i) => i.itemId === itemId) ?? null, [items, itemId, feedId]);
  const disc = useLive((s) => s.docs['app/profile']?.disc);

  if (!item) {
    return (
      <UnitShell kind="discover" ctx={ctx} state={status === 'ready' ? 'missing' : 'loading'} title={t('dcTitle')} onClose={() => go({ name: 'discover' })}>
        {status === 'ready' || status === 'error' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">{status === 'error' ? t('inLoadFailed') : t('dcNone')}</p>
            <Button onClick={() => go({ name: 'discover' })}>{t('dcBackToList')}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3" role="status" aria-label={t('inSkeleton')}>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </UnitShell>
    );
  }
  const steps = stepsFor(item.kind, item.questions.length > 0);
  const st = stepState(disc, item.itemId, steps);
  return <ItemUnit key={`${item.feedId}|${item.itemId}`} item={item} ctx={ctx} steps={steps} startAt={st.current ?? 'done'} savedDone={st.done} />;
}

function ItemUnit({ item, ctx, steps, startAt, savedDone }: { item: FeedItem; ctx: UnitCtx; steps: DiscStep[]; startAt: DiscStep | 'done'; savedDone: ReadonlySet<DiscStep> }) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const day = useClock((s) => s.today);
  const clock = useActiveClock();
  const questions = useMemo(() => item.questions.map((q) => shuffleOptions(q, `${item.itemId}`)), [item]);
  const live = useRef({ item, day, questions, ctx });
  useEffect(() => {
    live.current = { item, day, questions, ctx };
  }, [item, day, questions, ctx]);
  const ref = `feed/${item.feedId}#${item.itemId}`;

  const mark = useCallback((step: DiscStep, results: readonly ChoiceResult[]) => {
    const l = live.current;
    if (step === 'check' && results.length) recordDiscoverAnswers({ day: l.day, ref: `feed/${l.item.feedId}#${l.item.itemId}`, questions: l.questions, results, lang: useSettings.getState().lang, ctx: l.ctx });
    markDiscStep(l.item.itemId, step, l.day).catch(() => toast(t('inSaveFailed'), 'error'));
  }, [t]);
  const finish = useCallback(
    async (text: string, results: readonly ChoiceResult[]) => {
      const l = live.current;
      saveSent(l.item.itemId, text);
      await completeDiscover({ day: l.day, itemId: l.item.itemId, domain: l.item.domain, activeMs: clock.ms(), results });
    },
    [clock],
  );

  const [state, send] = useMachine(discoverMachine, { input: { steps, startAt, total: questions.length, mark, finish } });
  const stateName = typeof state.value === 'string' ? state.value : (Object.keys(state.value)[0] ?? 'prep');
  // Der abgegebene Text liegt nur in diesem Browser (gelesen, sobald der Beitrag fertig ist).
  const sent = useMemo(() => (stateName === 'done' ? loadSent(item.itemId) : ''), [stateName, item.itemId]);

  const order: Array<DiscStep | 'done'> = [...steps, 'done'];
  const pos = order.indexOf(stateName === 'finishing' || stateName === 'failed' ? 'use' : (stateName as DiscStep | 'done'));
  const stepItems: StepItem[] = steps.map((s, i) => ({
    id: s,
    label: t(`dcStep_${s}`),
    state: savedDone.has(s) || i < pos || stateName === 'done' ? 'done' : i === pos ? 'current' : 'todo',
  }));
  const why = item.why[lang] ?? null;
  const status = <StatusLine channel="discover" level={item.level ?? null} domain={item.domain} minutes={item.mins ?? null} />;

  let body: ReactNode;
  let task: string | undefined;
  if (stateName === 'prep') {
    task = t('dcPrepTask');
    body = <PrepStep item={item} sourceRef={ref} onNext={() => send({ type: 'NEXT' })} />;
  } else if (stateName === 'take') {
    task = t('dcTakeTask');
    body = <TakeStep item={item} sourceRef={ref} onNext={() => send({ type: 'NEXT' })} />;
  } else if (stateName === 'check') {
    task = t('dcCheckTask');
    const q = questions[state.context.i];
    body = q ? (
      <QuestionCard
        key={q.key}
        question={q}
        index={state.context.i}
        total={questions.length}
        source={item.gist}
        area="discover"
        sourceRef={ref}
        sourceTitle={item.title}
        onAnswered={(result) => send({ type: 'ANSWER', result })}
        onNext={() => send({ type: 'NEXT' })}
        nextLabel={t('inNext')}
      />
    ) : null;
  } else if (stateName === 'use' || stateName === 'finishing' || stateName === 'failed') {
    task = t('dcUseTask');
    body = <UseStep item={item} busy={stateName === 'finishing'} failed={stateName === 'failed'} onSubmit={(text) => send({ type: 'SUBMIT', text })} onRetry={() => send({ type: 'RETRY' })} />;
  } else {
    body = <DoneStep item={item} sourceRef={ref} sent={sent} ctx={ctx} />;
  }

  return (
    <UnitShell
      kind="discover"
      ctx={ctx}
      state={stateName}
      title={t('dcTitle')}
      seeDetail={item.title}
      onClose={() => go({ name: 'discover' })}
      progress={<Stepper steps={stepItems} label={t('inSteps')} />}
      status={
        <div className="flex flex-col gap-1">
          <motion.h2 layoutId={`disc-${item.itemId}`} className="text-xl font-semibold tracking-tight" lang="en">
            {item.title}
          </motion.h2>
          {status}
        </div>
      }
      task={task}
      purpose={why ?? t('dcPurpose')}
    >
      <div className="flex max-w-3xl flex-col gap-5">{body}</div>
    </UnitShell>
  );
}
