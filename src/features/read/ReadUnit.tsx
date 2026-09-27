import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav, type UnitCtx } from '../../app/nav';
import { useSettings } from '../../app/settings';
import { articleQuestions } from '../../domain/input/items';
import { shuffleOptions } from '../../domain/input/questions';
import { readingMinutes } from '../../domain/input/textStats';
import type { ArticleItem, ChoiceResult } from '../../domain/input/types';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Disclosure } from '../../ui/Disclosure';
import { Skeleton } from '../../ui/Skeleton';
import { useActiveClock } from '../input/activeClock';
import { ChunkList } from '../input/ChunkList';
import { completeReading } from '../input/complete';
import { QuestionCard } from '../input/QuestionCard';
import { StatusLine } from '../input/StatusLine';
import { UnitShell } from '../input/UnitShell';
import { ArticleView } from './ArticleView';
import { readMachine } from './machine';
import { SummaryStep } from './SummaryStep';

// Eine Lese-Einheit (Plan §4.1): lesen → Fragen mit Beleg → Abschluss → Zusammenfassung.

type Props = {
  item: ArticleItem;
  pool: readonly ArticleItem[];
  ctx: UnitCtx;
  day: string;
  start: 'reading' | 'summary' | 'done';
  readingId: string | null;
  quiz: { n: number; ok: number } | null;
  badge: string | null;
  /** Unter dem Text: z. B. „Mit Fragen aufbereiten" für eigene Texte. */
  extra?: ReactNode;
  onAnother: (() => void) | null;
};

export function ReadUnit({ item, pool, ctx, day, start, readingId, quiz, badge, extra, onAnother }: Props) {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const clock = useActiveClock();
  const questions = useMemo(() => articleQuestions(item, pool).map((q) => shuffleOptions(q, `${day}|${item.id}`)), [item, pool, day]);
  const live = useRef({ item, questions, day, ctx });
  useEffect(() => {
    live.current = { item, questions, day, ctx };
  }, [item, questions, day, ctx]);
  const run = useCallback((results: readonly ChoiceResult[]) => {
    const l = live.current;
    return completeReading({ day: l.day, item: l.item, questions: l.questions, results, activeMs: clock.ms(), lang: useSettings.getState().lang, ctx: l.ctx });
  }, [clock]);
  const [state, send] = useMachine(readMachine, { input: { total: questions.length, start, readingId, run } });
  const [showText, setShowText] = useState(false);
  const stateName = typeof state.value === 'string' ? state.value : Object.keys(state.value)[0] ?? 'reading';
  const results = state.context.results;
  const ok = quiz ? quiz.ok : results.filter((r) => r.correct).length;
  const n = quiz ? quiz.n : results.length;
  const route = { name: 'read' as const, ctx };

  const close = () => go({ name: 'today' });
  const status = <StatusLine channel="read" level={item.level} domain={item.domain} minutes={readingMinutes(item.text)} />;
  const glossary = item.glossary.slice(0, 6).map((g) => ({ en: g.w, de: g.de, note: lang === 'en' ? g.def : undefined }));

  let body: ReactNode;
  let aside: ReactNode = null;
  let task: string | undefined = t('rdTask');

  if (stateName === 'reading') {
    body = (
      <div className="flex flex-col gap-6">
        {glossary.length > 0 && (
          <div data-testid="glossary">
            <Disclosure label={t('rdGlossary')}>
              <ChunkList rows={glossary} sourceText={item.text} area="read" sourceRef={item.ref} title={item.title} saveAll />
            </Disclosure>
          </div>
        )}
        <ArticleView item={item} badge={badge} />
        {extra}
        <div>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => send({ type: 'DONE_READING' })} data-testid="read-done">
            {t('rdDone')}
          </Button>
        </div>
      </div>
    );
  } else if (stateName === 'questions') {
    const q = questions[state.context.i];
    task = t('inTaskChoose');
    body = (
      <div className="flex flex-col gap-3">
        <div>
          <Button variant="ghost" onClick={() => setShowText((v) => !v)} aria-expanded={showText} data-testid="show-text">
            {showText ? t('rdHideText') : t('rdShowText')}
          </Button>
        </div>
        {showText && <ArticleView item={item} />}
      </div>
    );
    aside = q ? (
      <QuestionCard
        key={q.key}
        question={q}
        index={state.context.i}
        total={questions.length}
        source={item.text}
        area="read"
        sourceRef={item.ref}
        sourceTitle={item.title}
        onAnswered={(result) => send({ type: 'ANSWER', result })}
        onNext={() => send({ type: 'NEXT' })}
        nextLabel={state.context.i + 1 < questions.length ? t('inNext') : t('inFinish')}
      />
    ) : null;
  } else if (stateName === 'completing') {
    task = undefined;
    body = (
      <div className="flex flex-col gap-2" role="status" aria-label={t('inSkeleton')}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  } else if (stateName === 'failed') {
    task = undefined;
    body = (
      <div className="flex flex-wrap items-center gap-3" role="alert">
        <p className="text-sm text-danger-text">{t('inSaveFailed')}</p>
        <Button icon="refresh" onClick={() => send({ type: 'RETRY' })} data-testid="retry-complete">
          {t('aiRetry')}
        </Button>
      </div>
    );
  } else {
    task = undefined;
    const id = state.context.readingId;
    body = (
      <div className="flex flex-col gap-6" data-testid="read-result">
        <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
          <p className="lx-eyebrow text-accent-text">{t('inDoneToday')}</p>
          <p className="text-lg font-semibold">{item.title}</p>
          {n > 0 && <p className="lx-tnum text-sm text-muted">{t('rdQuiz', { ok, n })}</p>}
        </div>
        {id && <SummaryStep readingId={id} item={item} route={route} onSkip={stateName === 'summary' ? () => send({ type: 'SKIP' }) : undefined} onSaved={() => send({ type: 'SUMMARY_DONE' })} />}
        <div className="flex flex-wrap gap-2">
          {onAnother && (
            <Button onClick={onAnother} icon="plus" data-testid="read-another">
              {t('inAnother')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => go({ name: 'history', kind: 'read' })} data-testid="open-history">
            {t('inHistory')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <UnitShell kind="read" ctx={ctx} state={stateName} title={t('ch_read')} seeDetail={item.title} onClose={close} status={status} task={task} purpose={t('rdPurpose')} aside={aside}>
      {body}
    </UnitShell>
  );
}
