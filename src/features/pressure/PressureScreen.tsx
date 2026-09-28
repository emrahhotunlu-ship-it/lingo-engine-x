import { useRef, useState } from 'react';
import type { ScreenProps } from '../../app/registry';
import { useSettings } from '../../app/settings';
import { objections } from '../../content/nb/load';
import type { Objection } from '../../content/nb/schemas';
import { ANSWER_MS, firstSentence, modelText, MOVES, movesScore, noMoves, PRESSURE_TEXT_MAX, THINK_MS, type PressureAnswer } from '../../domain/nbdrill/pressure';
import { EnglishText } from '../../engine/EnglishText';
import { SpeakButton } from '../../engine/SpeakButton';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { FeedbackPanel } from '../../ui/FeedbackPanel';
import type { Feedback } from '../../ui/feedback/types';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { AiRunPanel } from '../input/AiRunPanel';
import { saveLookupCard } from '../lookup/store';
import { finishUnit, GoalLine, Note, StepBoundary, TaskHead, TimeBar, TrainingBar, useCountdown } from '../nbdrill/shared';
import {
  beginAnswer,
  bestOf,
  endPressure,
  ensurePressure,
  markSaved,
  nextObjection,
  objectionOf,
  pressureMs,
  pressureResult,
  pressureRight,
  retryCheck,
  setDraft,
  skipObjection,
  submitAnswer,
  toggleMove,
  usePressure,
  type PressureSession,
} from './session';

// Einwand-Training (Plan N103, Lehrer I3): 5 Einwände, je 10 s Bedenkzeit und 30 s Antwort, das
// Muster anerkennen · nachfragen · antworten · absichern steht immer sichtbar da. Mit KI prüft
// Claude die vier Schritte nach; ohne KI Selbstcheck + Musterantwort. „Weiter“ wartet nie.

const MOVE_KEY: Record<(typeof MOVES)[number], MessageKey> = {
  acknowledge: 'nbTrainingMove_acknowledge',
  ask: 'nbTrainingMove_ask',
  answer: 'nbTrainingMove_answer',
  secure: 'nbTrainingMove_secure',
};

export function PressureScreen({ route }: ScreenProps<'pressure'>) {
  const { t } = useT();
  useState(() => ensurePressure(route, useSettings.getState().lang));
  const s = usePressure((x) => x.s);
  if (!s) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="pressure" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  if (s.done) return <PressureEnd s={s} route={route} />;
  const o = objectionOf(s);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pressure" data-pos={s.pos} data-phase={s.phase} data-state="open">
      <TrainingBar route={route} unit={s.unit} progress={{ n: s.pos + 1, total: s.ids.length }} />
      <StepBoundary resetKey={s.pos} scope="pressure" onSkip={skipObjection}>
        {o && <ObjectionStep key={o.id} s={s} o={o} />}
      </StepBoundary>
    </div>
  );
}

function Pattern({ answer }: { answer?: PressureAnswer | null }) {
  const { t } = useT();
  const m = answer?.moves ?? null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="pressure-pattern">
      <p className="lx-eyebrow">{t('nbTrainingPattern')}</p>
      <ol className="flex flex-wrap gap-2">
        {MOVES.map((k, i) => (
          <li key={k} className="lx-chip inline-flex items-center gap-1" data-move={k} data-on={m ? String(m[k]) : 'open'}>
            {m?.[k] ? <Icon name="check" size={14} /> : <span className="lx-tnum text-subtle">{i + 1}</span>}
            {t(MOVE_KEY[k])}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ObjectionStep({ s, o }: { s: PressureSession; o: Objection }) {
  const { t, lang } = useT();
  const field = useRef<HTMLTextAreaElement>(null);
  const [de, setDe] = useState(false);
  const thinkLeft = useCountdown(THINK_MS, s.phase === 'think', beginAnswer, `t${s.pos}`);
  const answerLeft = useCountdown(ANSWER_MS, s.phase === 'answer', submitAnswer, `a${s.pos}`);
  const answer = s.answers.find((a) => a.id === o.id) ?? null;
  const start = () => {
    beginAnswer();
    field.current?.focus();
  };
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="objection-item" data-id={o.id}>
      <TaskHead status={t('nbTrainingObjectionOf', { n: s.pos + 1, total: s.ids.length })} task={t('nbTrainingPressureTask')} purpose={t('nbTrainingPressurePurpose')} />
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <EnglishText text={o.line} area="business" source={`objection/${o.id}`} className="flex-1 text-lg font-medium leading-relaxed" testId="objection-line" />
          <SpeakButton text={o.line} testId="objection-speak" />
        </div>
        <button type="button" className="self-start text-sm text-muted underline-offset-2 hover:underline" onClick={() => setDe((v) => !v)} aria-expanded={de} data-testid="objection-de-toggle">
          {t('nbTrainingInGerman')}
        </button>
        {de && <p className="text-sm text-muted">{o.de}</p>}
      </div>
      <Pattern answer={s.phase === 'review' ? answer : null} />
      {s.phase !== 'review' && (
        <div className="flex flex-col gap-3">
          {s.phase === 'think' ? (
            <TimeBar left={thinkLeft} total={THINK_MS} label={t('nbTrainingThink')} testId="pressure-think" />
          ) : (
            <TimeBar left={answerLeft} total={ANSWER_MS} label={t('nbTrainingAnswerTime')} testId="pressure-answer" />
          )}
          <p className="text-xs text-muted">{t('nbTrainingSpeakHint')}</p>
          <textarea
            ref={field}
            className="lx-field min-h-28 text-base"
            lang="en"
            rows={4}
            maxLength={PRESSURE_TEXT_MAX}
            value={s.draft}
            readOnly={s.phase !== 'answer'}
            onFocus={() => s.phase === 'think' && beginAnswer()}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t('nbTrainingAnswerLabel')}
            placeholder={t('nbTrainingAnswerLabel')}
            autoCapitalize="sentences"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="pressure-input"
          />
          <GoalLine text={s.draft} targets={s.unit?.targets} />
          <div className="flex flex-wrap gap-3">
            {s.phase === 'think' ? (
              <Button variant="primary" onClick={start} data-testid="pressure-start">
                {t('nbTrainingStartAnswer')}
              </Button>
            ) : (
              <Button variant="primary" onClick={submitAnswer} data-testid="pressure-check">
                {t('nbTrainingCheck')}
              </Button>
            )}
          </div>
        </div>
      )}
      {s.phase === 'review' && <Review s={s} o={o} answer={answer} lang={lang} />}
    </article>
  );
}

function Review({ s, o, answer, lang }: { s: PressureSession; o: Objection; answer: PressureAnswer | null; lang: 'de' | 'en' }) {
  const { t } = useT();
  const slot = s.ai[o.id];
  const busy = !!slot && ['queued', 'thinking', 'streaming', 'slow'].includes(slot.phase);
  const aiDone = slot?.phase === 'done' && answer?.by === 'ai';
  const self = !aiDone && !busy;
  const score = movesScore(answer?.moves);
  const text = answer?.text ?? '';
  const timeUp = !!answer && answer.ms >= ANSWER_MS - 200;
  const fb: Feedback = aiDone
    ? {
        verdict: score >= 4 ? 'ok' : score >= 2 ? 'close' : 'wrong',
        effect: `${t('nbTrainingMovesOf', { n: score })} · ${slot.effect}`,
        ...(text ? { mine: text } : {}),
        ...(answer?.better ? { solution: answer.better } : {}),
        fixes: slot.fixes.map((f) => ({ kind: 'form' as const, mine: f.mine, right: f.right, why: f.why })),
        why: { question: `${o.line} → ${text}` },
      }
    : {
        verdict: 'unchecked',
        ...(text ? { mine: text } : { mine: t('nbTrainingNoAnswer') }),
        solution: modelText(o),
        fixes: [{ kind: 'goal', mine: '', right: MOVES.map((k) => t(MOVE_KEY[k])).join(' · '), why: o.tip[lang] }],
      };
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4" data-testid="pressure-review" data-mode={aiDone ? 'ai' : busy ? 'busy' : 'self'}>
      {timeUp && <Note tone="info">{t('nbTrainingTimeUp')}</Note>}
      {busy && <AiRunPanel phase={slot.phase === 'idle' ? 'queued' : slot.phase} error={null} skeleton={false} />}
      {slot?.phase === 'error' && slot.error && <AiRunPanel phase="error" error={slot.error} onRetry={() => retryCheck(o.id)} skeleton={false} />}
      {self && (
        <fieldset className="flex flex-col gap-2" data-testid="pressure-selfcheck">
          <legend className="mb-1 text-sm font-medium">{t('nbTrainingSelfCheck')}</legend>
          {MOVES.map((k) => {
            const on = (answer?.moves ?? noMoves())[k];
            return (
              <label key={k} className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--color-accent)]" checked={on} onChange={() => toggleMove(o.id, k)} data-testid={`selfcheck-${k}`} />
                <span className="flex flex-col">
                  <span className="font-medium">{t(MOVE_KEY[k])}</span>
                  <span className="text-muted" lang="en">
                    {o.model[k]}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      <FeedbackPanel fb={fb} onNext={nextObjection} />
      {self && (
        <div className="flex flex-col gap-1" data-testid="pressure-model">
          <p className="lx-eyebrow">{t('nbTrainingModel')}</p>
          <EnglishText text={modelText(o)} area="business" source={`objection/${o.id}`} className="text-sm leading-relaxed" />
        </div>
      )}
    </div>
  );
}

function PressureEnd({ s, route }: { s: PressureSession; route: ScreenProps<'pressure'>['route'] }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>(s.saved ? 'saved' : 'idle');
  const best = bestOf(s);
  const o = best ? (objections().find((x) => x.id === best.id) ?? null) : null;
  // Karten nur aus geprüftem Text (Prüfbefund M4c): KI-Fassung, sonst die Musterantwort.
  const keep = best?.better ?? (o ? modelText(o) : '');
  const finish = () => {
    const unit = s.unit;
    const result = pressureResult(s);
    endPressure();
    finishUnit(unit, unit ? result : undefined);
  };
  const save = async () => {
    if (!o || !keep || state === 'busy' || state === 'saved') return;
    setState('busy');
    const phrase = firstSentence(keep);
    const r = await saveLookupCard({
      word: phrase,
      de: t('nbTrainingSaveDe', { line: o.de }),
      pos: 'phrase',
      ex: keep,
      surface: phrase,
      src: 'coach',
      origin: { v: 1, kind: 'business', ref: `objection/${o.id}`, title: o.line, t: Date.now() },
      today: s.day,
    });
    if (r === 'saved' || r === 'added' || r === 'exists') {
      markSaved();
      setState('saved');
    } else setState('failed');
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pressure" data-state="done">
      <TrainingBar route={route} unit={s.unit} progress={null} onClose={finish} />
      <SessionEnd
        right={pressureRight(s)}
        total={s.answers.length}
        ms={pressureMs(s)}
        takeaways={
          keep ? (
            <div className="flex flex-col gap-2" data-testid="pressure-best">
              <p className="text-sm text-muted">{t('nbTrainingBest')}</p>
              <EnglishText text={keep} area="business" source={o ? `objection/${o.id}` : null} className="text-base leading-relaxed" />
              <div className="flex items-center gap-3">
                <Button variant="secondary" icon={state === 'saved' ? 'check' : 'bookmarkPlus'} disabled={state === 'saved' || state === 'busy'} onClick={() => void save()} data-testid="pressure-save" data-state={state}>
                  {state === 'saved' ? t('nbTrainingSaved') : t('nbTrainingSave')}
                </Button>
                {state === 'failed' && <span className="text-sm text-danger-text">{t('nbTrainingSaveFailed')}</span>}
              </div>
            </div>
          ) : undefined
        }
        next={{ label: s.unit ? t('nbTrainingNext') : t('nbTrainingDone'), run: finish }}
      />
    </div>
  );
}
