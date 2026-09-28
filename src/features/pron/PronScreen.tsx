import { usePlayerSkip } from '../../app/shell/Player';
import { useEffect, useRef, useState } from 'react';
import type { ScreenProps } from '../../app/registry';
import { shadowSteps, youMs } from '../../domain/nbdrill/shadow';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { speak, stopSpeech, unlockSpeech, useSpeech } from '../../platform/speech';
import { Button } from '../../ui/Button';
import { SessionEnd } from '../../ui/SessionEnd';
import { finishUnit, Note, StepBoundary, TaskHead, TimeBar, TrainingBar } from '../nbdrill/shared';
import { endShadow, ensurePron, finishShadow, nextShadowStep, usePron, type PronSession } from './session';

// Nachsprechen Satz für Satz (Plan N105, Lehrer P2): Satz hören → „Jetzt du“ (so lange wie der
// Satz) → nächster Satz; drei Durchgänge mit 0,9 · 1,0 · 1,1. Keine Wertung. Der Start braucht
// einen Tipp (iPhone gibt die Sprachausgabe erst nach einer Berührung frei).

type Phase = 'idle' | 'listen' | 'you';

export function PronScreen({ route }: ScreenProps<'pron'>) {
  const { t } = useT();
  useState(() => ensurePron(route));
  const s = usePron((x) => x.s);
  usePlayerSkip(finishShadow);
  if (!s) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="pron" data-state="empty">
        <TrainingBar route={route} unit={null} progress={null} />
        <p className="text-sm text-muted">{t('nbTrainingEmpty')}</p>
      </div>
    );
  }
  if (s.done) return <ShadowEnd s={s} route={route} />;
  const total = shadowSteps(s.sentences.length).length;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pron" data-kind="shadow" data-step={s.step} data-state="open">
      <TrainingBar
        route={route}
        unit={s.unit}
        progress={{ n: s.step + 1, total }}
        onClose={() => {
          // ✕ behält die Momentaufnahme (Fortsetzen); nur die Ausgabe stoppen und zurück.
          stopSpeech();
          finishUnit(null);
        }}
      />
      <StepBoundary resetKey={s.t0} scope="pron" onSkip={finishShadow}>
        <Shadow s={s} />
      </StepBoundary>
    </div>
  );
}

function Shadow({ s }: { s: PronSession }) {
  const { t, num } = useT();
  const status = useSpeech((x) => x.status);
  const tts = status === 'ready' || status === 'loading';
  const steps = shadowSteps(s.sentences.length);
  const cur = steps[s.step] ?? steps[0];
  const [phase, setPhase] = useState<Phase>('idle');
  const [you, setYou] = useState<{ ms: number; key: number } | null>(null);
  const [left, setLeft] = useState(0);
  const run = useRef(0);

  // Einen Schritt abspielen: sprechen, messen, dann „Jetzt du“ für dieselbe Dauer, dann weiter.
  const play = () => {
    if (!cur) return;
    const id = ++run.current;
    setPhase('listen');
    setYou(null);
    const text = s.sentences[cur.i] ?? '';
    const t0 = performance.now();
    void speak(text, { rate: cur.rate }).then((outcome) => {
      if (run.current !== id) return;
      const measured = outcome === 'done' ? performance.now() - t0 : null;
      setPhase('you');
      setYou({ ms: youMs(measured, text, cur.rate), key: id });
    });
  };

  useEffect(() => {
    if (phase !== 'you' || !you) return;
    // Takte zählen statt Uhr lesen: läuft auch bei angehaltener Testuhr gleich.
    let rest = you.ms;
    const iv = window.setInterval(() => {
      rest = Math.max(0, rest - 100);
      setLeft(rest);
      if (rest <= 0) {
        window.clearInterval(iv);
        setPhase('idle');
        nextShadowStep();
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [phase, you]);

  // Nach dem Weiterschalten automatisch den nächsten Satz (nur wenn schon einmal gestartet).
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started || phase !== 'idle') return;
    const h = window.setTimeout(() => play(), 250);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Schritts
  }, [s.step]);

  useEffect(() => () => stopSpeech(), []);

  const start = () => {
    unlockSpeech();
    setStarted(true);
    play();
  };

  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="shadow-item" data-phase={phase} data-pass={(cur?.pass ?? 0) + 1} data-rate={cur?.rate}>
      <TaskHead status={t('nbTrainingShadowPass', { n: (cur?.pass ?? 0) + 1, rate: num(cur?.rate ?? 1) })} task={t('nbTrainingShadowTask')} purpose={t('nbTrainingShadowPurpose')} />
      {!tts ? (
        <>
          <Note tone="info" testId="shadow-notts">
            {t('nbTrainingShadowNoTts')}
          </Note>
          <ol className="flex flex-col gap-2">
            {s.sentences.map((x, i) => (
              <li key={i}>
                <EnglishText text={x} area="listen" source={s.src || null} className="text-base leading-relaxed" />
              </li>
            ))}
          </ol>
          <div>
            <Button variant="primary" onClick={finishShadow} data-testid="shadow-done">
              {t('nbTrainingDone')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ol className="flex flex-col gap-3" data-testid="shadow-sentences">
            {s.sentences.map((x, i) => (
              <li key={i} className={`rounded-xl px-3 py-2 ${cur?.i === i ? 'bg-surface-strong' : 'opacity-60'}`} data-current={cur?.i === i ? 'true' : 'false'}>
                <EnglishText text={x} area="listen" source={s.src || null} className="text-base leading-relaxed" />
              </li>
            ))}
          </ol>
          <div className="min-h-12" aria-live="polite">
            {phase === 'listen' && (
              <p className="text-sm text-muted" data-testid="shadow-listen">
                {t('nbTrainingShadowListen')}
              </p>
            )}
            {phase === 'you' && you && <TimeBar left={left || you.ms} total={you.ms} label={t('nbTrainingShadowYou')} testId="shadow-you" />}
          </div>
          <div className="flex flex-wrap gap-3">
            {phase === 'idle' && !started && (
              <Button variant="primary" icon="play" onClick={start} data-testid="shadow-start">
                {t('nbTrainingShadowStart')}
              </Button>
            )}
            {started && (
              <Button variant="ghost" icon="refresh" onClick={() => play()} disabled={phase === 'listen'} data-testid="shadow-replay">
                {t('nbTrainingShadowReplay')}
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function ShadowEnd({ s, route }: { s: PronSession; route: ScreenProps<'pron'>['route'] }) {
  const { t } = useT();
  const finish = () => {
    const unit = s.unit;
    endShadow();
    finishUnit(unit);
  };
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-8" data-testid="pron" data-kind="shadow" data-state="done">
      <TrainingBar route={route} unit={s.unit} progress={null} onClose={finish} />
      <SessionEnd
        right={s.sentences.length}
        total={s.sentences.length}
        ms={s.ms ?? 0}
        takeaways={<p className="text-sm text-muted">{t('nbTrainingShadowEnd', { n: s.sentences.length })}</p>}
        next={{ label: s.unit ? t('nbTrainingNext') : t('nbTrainingDone'), run: finish }}
      />
    </div>
  );
}
