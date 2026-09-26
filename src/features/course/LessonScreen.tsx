import { useMachine } from '@xstate/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { isAiFailure } from '../../ai/types';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT, type MessageKey } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import { stopSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { flush } from '../progress/persist';
import { DutyBar, SummaryActions } from '../learn/ui';
import { makeLessonMachine } from './lessonMachine';
import { finishLesson, leaveLesson, openLesson, prepareLesson, saveStep, savedStep, startBaseLesson, touchLesson, useLessonRun, type Step } from './lessonRun';
import { DialogStep, GrammarStep, OutputStep, WordsStep } from './LessonSteps';

// Lektion (Kap. 6.2, phase2-plan §5.1): Ziel (Can-Do) am Anfang und am Ende, vier Schritte in
// etwa 12 Minuten. Wiedereinstieg im gespeicherten Schritt.

const STEP_KEYS: Record<Exclude<Step, 'intro' | 'summary'>, MessageKey> = { words: 'lsStepWords', dialog: 'lsStepDialog', grammar: 'lsStepGrammar', output: 'lsStepOutput' };
const ORDER: Step[] = ['words', 'dialog', 'grammar', 'output'];

export function LessonScreen({ id }: { id: string }) {
  const lid = useLessonRun((s) => s.lid);
  useEffect(() => {
    if (useLessonRun.getState().lid !== id) void openLesson(id);
  }, [id]);
  if (lid !== id) return <LessonSkeleton />;
  return <LessonRun key={id} id={id} />;
}

function LessonSkeleton() {
  const { t } = useT();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6" role="status" aria-label={t('lsLoading')}>
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function LessonRun({ id }: { id: string }) {
  const { t, tn, lang } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const run = useLessonRun();
  const machine = useMemo(() => makeLessonMachine(savedStep(id) ?? 'intro'), [id]);
  const [snap, send] = useMachine(machine);
  const step: Step = snap.value;
  const meta = run.meta;

  useEffect(() => {
    saveStep(id, step);
    if (step === 'summary') void finishLesson();
  }, [id, step]);

  useEffect(() => {
    const onAny = () => touchLesson();
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
      stopSpeech();
    };
  }, []);

  const leave = () => {
    api.blur();
    stopSpeech();
    leaveLesson();
    void flush();
    go({ name: 'course' });
  };
  useHotkeys({ escape: leave }, api.isInput);

  if (!meta) return null;
  const cando = lang === 'de' ? meta.cando_de : meta.cando_en;
  const title = lang === 'de' ? meta.de : meta.en;
  const next = () => {
    api.blur();
    window.scrollTo({ top: 0 });
    send({ type: 'NEXT' });
  };
  const idx = ORDER.indexOf(step);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="lesson" data-lesson={id} data-step={step} data-source={run.content?.source ?? ''}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton icon="close" label={t('lsClose')} onClick={leave} data-testid="round-close" />
          <p className="truncate text-sm text-muted">{title}</p>
        </div>
        <DutyBar ctx={run.ctx} />
      </div>
      {idx >= 0 && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label={t('lsSteps')}>
          {ORDER.map((s, i) => (
            <li key={s} className="flex flex-col gap-1" aria-current={i === idx ? 'step' : undefined}>
              <span className={`h-1.5 rounded-full ${i < idx ? 'bg-accent' : i === idx ? 'bg-accent-text' : 'bg-track'}`} />
              <span className={`text-2xs ${i === idx ? 'font-semibold text-fg' : 'text-subtle'}`}>{t(STEP_KEYS[s as keyof typeof STEP_KEYS])}</span>
            </li>
          ))}
        </ol>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
          {step === 'intro' && <LessonIntro cando={cando} onStart={next} />}
          {step !== 'intro' && step !== 'summary' && (run.status !== 'ready' || !run.content) && <LessonIntro cando={cando} onStart={() => undefined} resume />}
          {run.status === 'ready' && run.content && (
            <>
              {step === 'words' && <WordsStep meta={meta} content={run.content} onComplete={next} />}
              {step === 'dialog' && <DialogStep meta={meta} content={run.content} onComplete={next} />}
              {step === 'grammar' && <GrammarStep meta={meta} content={run.content} onComplete={next} />}
              {step === 'output' && <OutputStep meta={meta} content={run.content} onComplete={next} />}
            </>
          )}
          {step === 'summary' && (
            <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="summary">
              <header className="flex items-start gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                  <Icon name="check" size={22} />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold tracking-tight">{t('lsDone')}</h2>
                  <p className="text-base" lang={lang} data-testid="lesson-cando">
                    {t('lsGoal', { cando })}
                  </p>
                  {run.n > 0 && (
                    <p className="lx-tnum text-sm text-muted" data-testid="summary-stats">
                      {tn('lsAnswers', run.n, { pct: Math.round((run.ok / run.n) * 100) })}
                    </p>
                  )}
                </div>
              </header>
              <SummaryActions onBack={() => leaveLesson()} backTo={{ name: 'course' }} backLabel={t('lsBackToCourse')} />
            </article>
          )}
        </motion.div>
      </AnimatePresence>
      {idx > 0 && step !== 'summary' && (
        <div>
          <Button variant="ghost" icon="arrowLeft" onClick={() => send({ type: 'BACK' })} data-testid="lesson-back">
            {t('lsBackStep')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Ziel der Lektion und Start: gespeicherter Inhalt, „Lektion vorbereiten" (KI) oder Grundfassung. */
function LessonIntro({ cando, onStart, resume = false }: { cando: string; onStart: () => void; resume?: boolean }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const scope = useAiScope();
  const status = useLessonRun((s) => s.status);
  const source = useLessonRun((s) => s.content?.source);
  const [prep, setPrep] = useState<{ busy: boolean; ctl: AbortController | null; error: boolean }>({ busy: false, ctl: null, error: false });

  const prepare = async () => {
    const ctl = scope.controller();
    setPrep({ busy: true, ctl, error: false });
    try {
      await prepareLesson(ctl.signal);
      setPrep({ busy: false, ctl: null, error: false });
    } catch (err) {
      if (!isAiFailure(err) || err.kind !== 'cancelled') logWarn('course:prepare', err);
      setPrep({ busy: false, ctl: null, error: !ctl.signal.aborted });
    }
  };

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="lesson-intro">
      <header className="flex flex-col gap-2">
        <p className="lx-eyebrow">{t('lsGoalLabel')}</p>
        <h2 className="text-xl font-semibold tracking-tight" lang={lang}>
          {cando}
        </h2>
        <p className="text-sm text-muted">{t('lsDuration')}</p>
      </header>
      {status === 'loading' && <Skeleton className="h-11 w-48" />}
      {status === 'error' && (
        <p className="text-sm text-danger-text" role="alert">
          {t('lsError')}
        </p>
      )}
      {status === 'choose' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{ai ? t('lsChooseAi') : t('lsChooseBase')}</p>
          <div className="flex flex-wrap gap-2">
            {ai && (
              <Button variant="primary" icon="sparkle" onClick={() => (prep.busy ? prep.ctl?.abort() : void prepare())} data-testid="lesson-prepare" data-ai="">
                {prep.busy ? t('aiStop') : t('lsPrepare')}
              </Button>
            )}
            <Button variant={ai ? 'secondary' : 'primary'} onClick={startBaseLesson} disabled={prep.busy} data-testid="lesson-base">
              {t('lsBase')}
            </Button>
          </div>
          {prep.busy && (
            <p className="text-sm text-muted" role="status">
              {t('aiThinking')}
            </p>
          )}
          {prep.error && (
            <p className="text-sm text-danger-text" role="alert">
              {t('aiFailed')}
            </p>
          )}
        </div>
      )}
      {status === 'ready' && (
        <div className="flex flex-col items-start gap-2">
          {source === 'base' && <p className="text-xs text-subtle">{t('lsBaseNote')}</p>}
          {!resume && (
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onStart} data-testid="lesson-start">
              {t('lsStart')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
