import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav, type UnitCtx } from '../../app/nav';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { paragraphs } from '../../domain/input/textStats';
import { shuffleOptions } from '../../domain/input/questions';
import type { ChoiceResult, ListeningItem } from '../../domain/input/types';
import { RATES } from '../../engine/AudioBar';
import { ladderFor, ladderRate } from '../../domain/input/ladder';
import { TempoPlayer } from './TempoPlayer';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { stopSpeech, useSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { useActiveClock } from '../input/activeClock';
import { ChunkList } from '../input/ChunkList';
import { completeListening } from '../input/complete';
import { listenRows, type ListenRow } from '../input/derive';
import { QuestionCard } from '../input/QuestionCard';
import { StatusLine } from '../input/StatusLine';
import { UnitShell } from '../input/UnitShell';
import { listenMachine } from './machine';
import { reportPos } from '../input/resume';
import { TranscriptView } from './TranscriptView';

// Eine Hör-Einheit (Plan §4.2): Wörter vorab → hören ohne Text → Fragen mit Beleg (abspielbar)
// → Abschluss → Transkript zum Mitsprechen. Ohne Stimme: Text als Lesetext, `help: true`.

type Props = {
  item: ListeningItem;
  ctx: UnitCtx;
  day: string;
  start: 'prep' | 'done';
  record: ListenRow | null;
  onAnother: (() => void) | null;
};

const nearestRate = (r: unknown): number => {
  const v = typeof r === 'number' && Number.isFinite(r) ? r : 1;
  return RATES.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), 1 as number);
};

export function ListenUnit({ item, ctx, day, start, record, onAnother }: Props) {
  const { t, tn, lang } = useT();
  const back = useNav((s) => s.back);
  const clock = useActiveClock();
  const speech = useSpeech((s) => s.status);
  const profileRate = useLive((s) => s.docs['app/profile']?.rate);
  const [rate, setRate] = useState(() => nearestRate(profileRate));
  const listenProfile = useLive((s) => s.docs['app/profile']);
  const ladder = useMemo(() => ladderFor(listenRows(listenProfile)), [listenProfile]);
  const [passes, setPasses] = useState(0);
  const questions = useMemo(() => item.questions.map((q) => shuffleOptions(q, `${day}|${item.id}`)), [item, day]);
  const live = useRef({ item, questions, day, ctx, rate });
  useEffect(() => {
    live.current = { item, questions, day, ctx, rate };
  }, [item, questions, day, ctx, rate]);
  const run = useCallback(
    (r: { results: readonly ChoiceResult[]; plays: number; help: boolean }) => {
      const l = live.current;
      return completeListening({
        day: l.day,
        item: { id: l.item.id, ref: l.item.ref, level: l.item.level, domain: l.item.domain },
        questions: l.questions,
        results: r.results,
        plays: r.plays,
        rate: l.rate,
        help: r.help,
        activeMs: clock.ms(),
        lang: useSettings.getState().lang,
        ctx: l.ctx,
      });
    },
    [clock],
  );
  const [state, send] = useMachine(listenMachine, { input: { total: questions.length, start, run } });
  const stateName = typeof state.value === 'string' ? state.value : (Object.keys(state.value)[0] ?? 'prep');
  const noAudio = speech === 'unsupported' || speech === 'novoice';
  useEffect(() => {
    reportPos('listen', stateName === 'done' ? null : { route: { name: 'listen', ctx: 'extra', id: item.id }, title: item.title, step: stateName });
  }, [stateName, item.id, item.title]);

  useEffect(() => () => stopSpeech(), []);
  // Ohne Stimme: Hinweis und Text als Lesetext – die Einheit bleibt abschließbar (F14).
  useEffect(() => {
    if (noAudio && stateName === 'listening' && !state.context.textShown) send({ type: 'NO_AUDIO' });
  }, [noAudio, stateName, state.context.textShown, send]);

  const close = () => {
    stopSpeech();
    back();
  };
  const status = <StatusLine channel="listen" level={item.level} domain={item.domain} extra={state.context.plays > 0 ? tn('lsPlays', state.context.plays) : null} />;
  const vocab = item.vocab.slice(0, 5).map((v) => ({ en: v.w, de: v.de, note: lang === 'en' ? v.def : undefined }));
  const results = state.context.results;

  let body: ReactNode;
  let aside: ReactNode = null;
  let task: string | undefined = t('lsTask');

  if (stateName === 'prep') {
    body = (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight" lang="en">
          {item.title}
        </h2>
        {vocab.length > 0 && (
          <section className="flex flex-col gap-2" data-testid="listen-prep">
            <p className="lx-eyebrow">{t('lsPrepTitle')}</p>
            <ChunkList rows={vocab} sourceText={item.text} area="listen" sourceRef={item.ref} title={item.title} />
          </section>
        )}
        <div>
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => send({ type: noAudio ? 'NO_AUDIO' : 'START' })} data-testid="listen-start">
            {t('lsPlay')}
          </Button>
        </div>
      </div>
    );
  } else if (stateName === 'listening') {
    body = (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight" lang="en">
          {item.title}
        </h2>
        {noAudio ? (
          <p className="text-sm text-muted" role="status" data-testid="audio-off">
            {t('lsAudioOff')}
          </p>
        ) : (
          // Tempo-Leiter (N54): 1. Hören langsam, 2. Hören schneller; Satz ▶/↺, Pause je Satz.
          <TempoPlayer
            text={item.text}
            ladder={ladder}
            passes={passes}
            onPass={(n) => {
              setPasses(n);
              setRate(ladderRate(ladder, n));
              send({ type: 'PLAYED' });
              send({ type: 'HEARD' });
            }}
          />
        )}
        {state.context.textShown && (
          <div className="flex max-w-[68ch] flex-col gap-3" data-testid="listen-text" lang="en">
            {paragraphs(item.text).map((p, i) => (
              <EnglishText key={i} text={p} area="listen" source={item.ref} title={item.title} className="text-base leading-relaxed" />
            ))}
          </div>
        )}
        <p className="text-sm text-muted" data-testid="listen-hint">
          {state.context.heard ? t('lsHeard') : t('lsListenFirst')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" iconAfter="arrowRight" disabled={!state.context.heard && !state.context.help} onClick={() => send({ type: 'TO_QUESTIONS' })} data-testid="to-questions">
            {t('lsToQuestions')}
          </Button>
          {!state.context.textShown && (
            <Button variant="ghost" onClick={() => send({ type: 'SHOW_TEXT' })} data-testid="show-transcript">
              {t('lsShowTranscript')}
            </Button>
          )}
          {!state.context.heard && !state.context.help && (
            <Button variant="ghost" onClick={() => send({ type: 'SKIP' })} data-testid="skip-listen">
              {t('lsSkipListen')}
            </Button>
          )}
        </div>
      </div>
    );
  } else if (stateName === 'questions') {
    const q = questions[state.context.i];
    task = t('inTaskChoose');
    body = (
      <h2 className="text-xl font-semibold tracking-tight" lang="en">
        {item.title}
      </h2>
    );
    aside = q ? (
      <QuestionCard
        key={q.key}
        question={q}
        index={state.context.i}
        total={questions.length}
        source={item.text}
        area="listen"
        sourceRef={item.ref}
        sourceTitle={item.title}
        speakable
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
        <Button icon="refresh" onClick={() => send({ type: 'RETRY' })}>
          {t('aiRetry')}
        </Button>
      </div>
    );
  } else {
    task = undefined;
    const n = record ? record.n : results.length;
    const ok = record ? record.ok : results.filter((r) => r.correct).length;
    body = (
      <div className="flex flex-col gap-6" data-testid="listen-result">
        <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
          <p className="lx-eyebrow text-accent-text">{t('inDoneToday')}</p>
          <p className="text-lg font-semibold" lang="en">
            {item.title}
          </p>
          {n > 0 && <p className="lx-tnum text-sm text-muted">{t('rdQuiz', { ok, n })}</p>}
        </div>
        <TranscriptView item={item} rate={rate} />
        <div className="flex flex-wrap gap-2">
          {onAnother && (
            <Button onClick={onAnother} icon="plus" data-testid="listen-another">
              {t('inAnother')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <UnitShell kind="listen" ctx={ctx} state={stateName} title={t('ch_listen')} seeDetail={item.title} onClose={close} status={status} task={task} purpose={t('lsPurpose')} aside={aside}>
      {body}
    </UnitShell>
  );
}
