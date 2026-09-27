import { useMachine } from '@xstate/react';
import { useEffect, useRef, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { askJson } from '../../ai/gate';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { isAiFailure, type PromptTemplate } from '../../ai/types';
import { bizId, PITCH_TEXT_MAX } from '../../domain/business/bizDoc';
import { coverageCount } from '../../domain/business/coverage';
import type { Audience } from '../../domain/business/types';
import { monthOf } from '../../domain/speak/talkDoc';
import { EnglishText } from '../../engine/EnglishText';
import { MicButton } from '../../engine/MicButton';
import { SpeakButton } from '../../engine/SpeakButton';
import { logWarn } from '../../platform/diagnostics';
import { speak, stopSpeech } from '../../platform/speech';
import { KEY_PREFIX, local } from '../../platform/storage';
import { pitchFeedback, PF_ATTEMPT_MAX } from '../../prompts/pitchFeedback';
import { pitchScript, PS_SLIDE_MAX } from '../../prompts/pitchScript';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { Skeleton } from '../../ui/Skeleton';
import { AnalysisCard } from '../speak/AnalysisCard';
import { TakeChunkButton } from '../speak/TakeChunkButton';
import { saveBizItem } from './persist';
import { pitchMachine } from './pitchMachine';
import { useCompanionSee } from '../companion/seeing';

// Präsentations-Coach (Plan §5.5): Folie → Sprechfassung (Sätze mit 🔊, Überleitungen markiert,
// Nachsprechen) → eigener Versuch (Tippen oder Mikrofon) → Abdeckung der Punkte + drei Schichten.

const DRAFT_KEY = `${KEY_PREFIX}draft:pitch`;

export function PitchCoach() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const ai = useAiAvailable();
  const scope = useAiScope();
  const [snap, send] = useMachine(pitchMachine);
  useCompanionSee({ area: 'business', label: `${t('bizTitle')} · ${t('bizPitch')}`, phase: 'idle' });
  const [slide, setSlide] = useState(() => local.get(DRAFT_KEY) ?? '');
  const [audience, setAudience] = useState<Audience>('clients');
  const [minutes, setMinutes] = useState(2);
  const [attempt, setAttempt] = useState('');
  const [shadow, setShadow] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const started = useRef(0);
  const c = snap.context;
  const state = snap.value;

  useEffect(() => () => stopSpeech(), []);

  const audiences: ReadonlyArray<{ value: Audience; label: string }> = [
    { value: 'clients', label: t('pitchAudClients') },
    { value: 'executives', label: t('pitchAudExecs') },
    { value: 'team', label: t('pitchAudTeam') },
    { value: 'partners', label: t('pitchAudPartners') },
  ];

  async function run<V, O>(template: PromptTemplate<V, O>, vars: V): Promise<O | null> {
    const x = scope.controller();
    ctl.current = x;
    try {
      const r = await askJson({ template, vars, signal: x.signal, onPhase: (p) => p === 'slow' && send({ type: 'SLOW' }) });
      return r.data;
    } catch (err) {
      if (isAiFailure(err) && err.kind === 'cancelled') send({ type: 'CANCEL' });
      else {
        if (!isAiFailure(err)) logWarn('biz:pitch', err);
        send({ type: 'FAIL', error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed' });
      }
      return null;
    }
  }

  const makeScript = async () => {
    if (!slide.trim()) return;
    started.current = Date.now();
    send({ type: 'SCRIPT' });
    const s = await run(pitchScript, { slide, audience, minutes, uiLang: lang });
    if (s) send({ type: 'SCRIPT_DONE', script: s });
  };

  const getFeedback = async () => {
    const script = c.script;
    if (!script || !attempt.trim()) return;
    stopSpeech();
    send({ type: 'FEEDBACK', attempt });
    const f = await run(pitchFeedback, { points: script.points, model: script.script.map((l) => l.en).join(' '), attempt, uiLang: lang });
    if (!f) return;
    send({ type: 'FEEDBACK_DONE', feedback: f });
    local.remove(DRAFT_KEY);
    const cov = coverageCount(script.points, f.coverage);
    const t0 = Date.now();
    const ok = await saveBizItem(
      { id: bizId('pitch', t0), t: t0, day: useClock.getState().today, kind: 'pitch', points: script.points, attempt: attempt.slice(0, PITCH_TEXT_MAX), verdict: f.verdict, covered: cov.covered, total: cov.total, lang, summary: f.lands },
      { lang, title: t('bizPitch'), n: 1, right: f.verdict === 'clean' ? 1 : 0, activeMs: t0 - (started.current || t0), errors: f.errors.map((e) => ({ cat: e.cat, wrong: e.wrong, right: e.right, sentence: attempt.slice(0, 160) })) },
    );
    setSaveFailed(!ok);
  };

  const shadowStep = async (i: number) => {
    const line = c.script?.script[i];
    if (!line) {
      setShadow(null);
      return;
    }
    setShadow(i);
    await speak(line.en);
  };

  const busy = state === 'scripting' || state === 'feedbacking';

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="pitch-coach" data-state={state}>
      <header className="flex items-start gap-2">
        <IconButton icon="arrowLeft" label={t('spBack')} onClick={() => go({ name: 'business' })} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('bizPitch')}</h1>
          <p className="text-sm text-muted">{state === 'input' || state === 'scripting' ? t('pitchLead') : t('pitchTask', { min: minutes })}</p>
        </div>
      </header>

      {(state === 'input' || state === 'scripting') && (
        <Card channel="business" className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('pitchSlide')}</span>
            <textarea
              data-testid="pitch-input"
              value={slide}
              maxLength={PS_SLIDE_MAX}
              rows={6}
              disabled={busy}
              onChange={(e) => {
                setSlide(e.target.value);
                local.set(DRAFT_KEY, e.target.value);
              }}
              className="resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
            />
          </label>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('pitchAudience')}</p>
            <Segmented label={t('pitchAudience')} value={audience} options={audiences} onChange={setAudience} />
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('pitchMinutes', { min: minutes })}</span>
            <input type="range" min={1} max={5} step={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} data-testid="pitch-minutes" className="h-11 accent-[var(--lx-accent)]" />
          </label>
          {!ai && <p className="text-sm text-muted">{t('bizNoAi')}</p>}
          {c.error && state === 'input' && (
            <p role="alert" className="text-sm text-danger-text">
              {t(c.error)}
            </p>
          )}
          {state === 'scripting' ? (
            <Thinking slow={c.slow} onStop={() => ctl.current?.abort()} />
          ) : (
            ai && (
              <div>
                <Button variant="primary" size="lg" icon="sparkle" disabled={!slide.trim()} onClick={() => void makeScript()} data-testid="pitch-make" data-ai="">
                  {c.error ? t('aiRetry') : t('pitchMake')}
                </Button>
              </div>
            )
          )}
        </Card>
      )}

      {(state === 'rehearse' || state === 'feedbacking') && c.script && (
        <>
          <Card channel="business" data-testid="pitch-script" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="lx-eyebrow">{t('pitchScript', { sec: c.script.seconds })}</p>
              <Button variant="ghost" icon="speaker" onClick={() => void shadowStep(0)} data-testid="pitch-shadow">
                {t('pitchShadow')}
              </Button>
            </div>
            <ol className="flex flex-col gap-2">
              {c.script.script.map((l, i) => (
                <li key={i} data-testid="pitch-line" data-signpost={l.signpost || undefined} className={`flex items-start gap-1 rounded-xl px-2 py-1 ${shadow === i ? 'bg-accent-soft' : ''}`}>
                  <EnglishText text={l.en} area="business" className={`min-w-0 flex-1 text-base ${l.signpost ? 'font-semibold text-accent-text' : ''}`} />
                  <SpeakButton text={l.en} />
                </li>
              ))}
            </ol>
            {shadow !== null && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm" role="status">
                <span>{t('pitchYourTurn')}</span>
                <Button onClick={() => void shadowStep(shadow + 1)} iconAfter="arrowRight">
                  {t('sitNext')}
                </Button>
                <Button variant="ghost" onClick={() => setShadow(null)}>
                  {t('close')}
                </Button>
              </div>
            )}
            {c.script.keyPhrases.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="lx-eyebrow">{t('bizPhrases')}</p>
                {c.script.keyPhrases.map((k) => (
                  <div key={k.en} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <EnglishText as="span" text={k.en} area="business" className="font-medium" />
                      <span className="block text-xs text-muted">{lang === 'de' ? k.de : k.def}</span>
                    </span>
                    <TakeChunkButton
                      input={{ en: k.en, de: k.de, def: k.def, kind: 'phrase', register: 'neutral', why: '', whyLang: lang, level: 'C1', src: { kind: 'pitch', ref: `biz/${monthOf(useClock.getState().today)}`, title: t('bizPitch'), utterance: '', upgraded: k.ex } }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card as="div" className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">{t('pitchAttempt')}</span>
              <textarea
                lang="en"
                data-testid="pitch-attempt"
                value={attempt}
                maxLength={PF_ATTEMPT_MAX}
                rows={6}
                disabled={busy}
                onChange={(e) => setAttempt(e.target.value)}
                className="resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-[var(--lx-accent)]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <MicButton disabled={busy} onText={(heard) => setAttempt((cur) => `${cur.trim() ? `${cur.trim()} ` : ''}${heard}`.slice(0, PF_ATTEMPT_MAX))} />
              {state === 'feedbacking' ? (
                <Thinking slow={c.slow} onStop={() => ctl.current?.abort()} />
              ) : (
                ai && (
                  <Button variant="primary" icon="sparkle" disabled={!attempt.trim()} onClick={() => void getFeedback()} data-testid="pitch-submit" data-ai="">
                    {c.error ? t('aiRetry') : t('pitchFeedbackBtn')}
                  </Button>
                )
              )}
            </div>
            {c.error && state === 'rehearse' && (
              <p role="alert" className="text-sm text-danger-text">
                {t(c.error)}
              </p>
            )}
          </Card>
        </>
      )}

      {state === 'result' && c.script && c.feedback && (
        <div className="flex flex-col gap-4" data-testid="pitch-feedback">
          <PitchCoverage points={c.script.points} feedback={c.feedback} />
          <Card as="div">
            <AnalysisCard
              idx={0}
              slot={{ state: 'done', data: c.feedback, lang }}
              sentence={c.attempt}
              area="business"
              takeInput={(ch, upgraded) => ({ en: ch.en, de: ch.de, def: ch.def, kind: ch.kind, register: ch.register, why: ch.why, whyLang: lang, level: 'C1', src: { kind: 'pitch', ref: `biz/${monthOf(useClock.getState().today)}`, title: t('bizPitch'), utterance: c.attempt.slice(0, 200), upgraded } })}
            />
          </Card>
          {saveFailed && (
            <p role="alert" className="text-sm text-danger-text">
              {t('repNotSaved')}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon="refresh" onClick={() => send({ type: 'AGAIN' })} data-testid="pitch-again">
              {t('pitchAgain')}
            </Button>
            <Button
              onClick={() => {
                setAttempt('');
                send({ type: 'RESET' });
              }}
            >
              {t('pitchNew')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PitchCoverage({ points, feedback }: { points: readonly string[]; feedback: { coverage: Array<{ point: string; covered: boolean; note: string }> } }) {
  const { t } = useT();
  const cov = coverageCount(points, feedback.coverage);
  return (
    <Card channel="business" data-testid="pitch-coverage" data-covered={cov.covered} data-total={cov.total}>
      <p className="text-base font-semibold">{t('pitchCoverage', { covered: cov.covered, total: cov.total })}</p>
      {cov.missing.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-2">
          {cov.missing.map((m) => (
            <span key={m} lang="en" className="rounded-full bg-gold-soft px-2.5 py-1 text-xs text-gold-text">
              {m}
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}

function Thinking({ slow, onStop }: { slow: boolean; onStop: () => void }) {
  const { t } = useT();
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="text-sm text-muted">{slow ? t('aiSlow') : t('aiThinking')}</p>
      <Skeleton className="h-12 w-full" />
      <div>
        <Button icon="stop" onClick={onStop}>
          {t('aiStop')}
        </Button>
      </div>
    </div>
  );
}
