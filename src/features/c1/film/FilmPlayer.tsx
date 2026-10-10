import { useEffect, useMemo, useRef, useState } from 'react';
import type { Film } from '../../../domain/c1/anim';
import { SentenceMorph, type TapState } from '../../../engine/SentenceMorph';
import { DWELL_MS, MORPH_MS, SPEECH_GRACE_MS } from './timing';
import { Button } from '../../../ui/Button';
import { morphSteps, withoutHi } from '../../../engine/morphPlan';
import { useFxLevel } from '../../../engine/fx/level';
import { useT } from '../../../i18n';
import { speak, stopSpeech, unlockSpeech, useSpeech } from '../../../platform/speech';
import { local } from '../../../platform/storage';
import { Icon } from '../../../ui/Icon';

// Struktur-Film-Spieler (Lernplattform 3.0 P61, §6.4): Schritt 0 bietet eine Vorhersage an (Wort antippen oder eine von zwei Optionen),
// „Film abspielen“ geht aber jederzeit, auch ohne Raten (Emrahs Rückmeldung 4, 10.10.2026: der ausgegraute Knopf wirkte kaputt).
// Die Vorhersage wird nicht gebucht, nichts wird gespeichert (nur die Geräte-Vorlieben „langsamer“ und „Mitlesen“ in `localStorage`).
// Steuerung: ▶/❚❚, Schrittpunkte, „langsamer“ (0,75×), „Noch einmal“; bedienbar ohne Ton.
// Der Film läuft nach „Film abspielen“ immer von selbst (ausdrücklich gestartet). Effekt-Stufe „Aus“ (oder reduzierte Bewegung):
// die Wörter gleiten nicht, jeder Schritt steht als Standbild da. Die Sprachausgabe hält den Film nie fest: meldet die Stimme kein Ende
// (iPhone ohne Freigabe), geht es nach SPEECH_GRACE_MS trotzdem weiter.
// Zeitsteuerung nur mit `setTimeout` (läuft nur, solange der Film spielt); kein requestAnimationFrame.

type Phase = 'predict' | 'play' | 'end';

const SLOW_KEY = 'lx:film-slow';
const VOICE_KEY = 'lx:film-voice';

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  );
}

export function FilmPlayer({ film, onClose }: { film: Film; onClose?: (() => void) | undefined }) {
  const { t, lang } = useT();
  const level = useFxLevel();
  const still = level === 'off';
  const speech = useSpeech((s) => s.status);
  const canVoice = speech === 'ready';
  const steps = useMemo(() => morphSteps(film.steps), [film]);
  const sizers = useMemo(() => film.steps.map((s) => s.en), [film]);
  const [phase, setPhase] = useState<Phase>('predict');
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(() => local.get(SLOW_KEY) === '1');
  const [voice, setVoice] = useState(() => local.get(VOICE_KEY) !== '0');
  const [guess, setGuess] = useState<number | null>(null);
  const speed = slow ? 0.75 : 1;
  const last = steps.length - 1;
  const root = useRef<HTMLDivElement>(null);

  // Selbstlauf: Schritt zeigen, (optional) vorlesen, verweilen, weiter. Nur solange gespielt wird.
  // Weiter geht es, sobald die Verweildauer um ist UND die Stimme fertig ist (plus kurze Pause) – spätestens aber nach
  // Verweildauer + SPEECH_GRACE_MS, damit eine hängende Sprachausgabe den Film nie anhält.
  useEffect(() => {
    if (phase !== 'play' || paused) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const dwell = (step === 0 ? DWELL_MS.first : DWELL_MS.step + MORPH_MS) / speed;
    const talking = voice && canVoice;
    let dwelt = false;
    let voiced = !talking;
    const next = (): void => {
      if (!alive || !dwelt || !voiced) return;
      alive = false;
      if (step < last) setStep(step + 1);
      else setPhase('end');
    };
    timers.push(
      setTimeout(() => {
        dwelt = true;
        next();
      }, dwell),
    );
    if (talking) {
      void speak(film.steps[step]?.en ?? '', { rate: slow ? 0.8 : 1 }).then(() => {
        if (!alive) return;
        timers.push(
          setTimeout(() => {
            voiced = true;
            next();
          }, step === 0 ? 300 : 700),
        );
      });
      timers.push(
        setTimeout(() => {
          voiced = true;
          next();
        }, dwell + SPEECH_GRACE_MS),
      );
    }
    return () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [phase, paused, step, speed, voice, canVoice, last, film, slow]);

  // Beim Verlassen nie weitersprechen.
  useEffect(() => () => stopSpeech(), []);

  const start = (): void => {
    // Synchron im Tipp: schaltet die Sprachausgabe am iPhone frei (sonst bleibt `speak` später stumm).
    unlockSpeech();
    setStep(0);
    setPaused(false);
    setPhase('play');
  };
  const goTo = (i: number): void => {
    stopSpeech();
    setStep(i);
    setPaused(true);
    if (phase === 'end') setPhase('play');
  };
  const toggleSlow = (): void => {
    setSlow((v) => {
      local.set(SLOW_KEY, v ? '0' : '1');
      return !v;
    });
  };
  const toggleVoice = (): void => {
    setVoice((v) => {
      local.set(VOICE_KEY, v ? '0' : '1');
      if (v) stopSpeech();
      return !v;
    });
  };

  const p = film.predict;
  const answered = guess !== null;
  const right = answered && (p.kind === 'tap' ? p.ans.includes(guess) : p.ans === guess);
  const tapState = (i: number): TapState => {
    if (p.kind !== 'tap' || !answered) return 'idle';
    if (i === guess) return right ? 'right' : 'wrong';
    return p.ans.includes(i) ? 'answer' : 'dim';
  };
  const cur = film.steps[step];
  const atEnd = phase !== 'predict' && step === last;
  // Vor der Vorhersage leuchtet nichts (Signalwörter würden die Lösung verraten); erst nach der Antwort kommt die Hervorhebung von Schritt 0.
  const words = phase === 'predict' ? (answered ? steps[0]! : withoutHi(steps[0]!)) : (steps[step] ?? steps[0]!);

  return (
    <div ref={root} className="lx-fm flex flex-col gap-4" data-testid="film" data-film={film.id} data-phase={phase} data-step={step} data-still={still ? 'true' : undefined}>
      <header className="flex flex-col gap-1">
        <p className="lx-eyebrow">{phase === 'predict' ? t('eeFmPredictLabel') : t('eeFmEyebrow')}</p>
        <h3 className="lx-t-answer tracking-tight">{film.title[lang]}</h3>
      </header>

      {phase === 'predict' && (
        <p className="lx-t-support font-semibold" data-testid="film-question">
          {p.q[lang]}
        </p>
      )}

      <div className="lx-fm-screen" data-testid="film-screen">
        <p className="lx-eyebrow" data-testid="film-sentence-label" data-kind={atEnd ? 'to' : step === 0 ? 'from' : 'mid'}>
          {atEnd ? t('eeFmTo') : step === 0 ? t('eeFmFrom') : t('eeFmMid')}
        </p>
        <SentenceMorph
          words={words}
          sizers={sizers}
          animate={!still && phase !== 'predict'}
          speed={speed}
          onTap={phase === 'predict' && p.kind === 'tap' && !answered ? (i) => setGuess(i) : undefined}
          tapState={phase === 'predict' && p.kind === 'tap' ? tapState : undefined}
          tapLabel={(w) => t('eeFmTapWord', { word: w })}
        />
        {/* Die deutsche Bedeutung gehört zum Zielsatz: erst im letzten Schritt zeigen (sonst stand „haben … abgelegt“ unter einem
            Satz in Future Simple). */}
        {lang === 'de' && atEnd && (
          <p className="lx-fm-sub" lang="de" data-testid="film-meaning">
            {film.de}
          </p>
        )}
      </div>

      {phase === 'predict' && p.kind === 'pick' && (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={p.q[lang]}>
          {p.opts.map((o, i) => (
            <button
              key={o}
              type="button"
              className="lx-choice min-h-12 justify-start text-left"
              lang="en"
              disabled={answered}
              data-state={!answered ? 'idle' : i === p.ans ? 'correct' : i === guess ? 'wrong' : 'dim'}
              onClick={() => setGuess(i)}
              data-testid="film-option"
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {phase === 'predict' && (
        <div className="flex flex-col gap-3">
          {answered && (
            <p className="lx-t-support" role="status" data-testid="film-guess" data-right={right ? 'true' : 'false'}>
              {right ? t('eeFmRight') : t('eeFmWrong')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon="play" onClick={start} data-testid="film-play">
              {t('eeFmPlay')}
            </Button>
            {!answered && <span className="lx-t-support text-muted">{t('eeFmGuessOptional')}</span>}
          </div>
        </div>
      )}

      {phase !== 'predict' && cur && (
        <>
          <p className="lx-t-support" aria-live="polite" data-testid="film-note">
            <span className="lx-tnum mr-2 text-muted">{t('eeFmStep', { n: step + 1, total: steps.length })}</span>
            <span lang={lang}>{cur.note[lang]}</span>
            <span className="sr-only" lang="en">
              {' '}
              {cur.en}
            </span>
          </p>
          <div className="lx-fm-controls" data-testid="film-controls">
            <button
              type="button"
              className="lx-fm-round"
              onClick={() => (phase === 'end' ? start() : setPaused((v) => !v))}
              aria-label={phase === 'end' ? t('eeFmAgain') : paused ? t('eeFmResume') : t('eeFmPause')}
              data-testid="film-toggle"
              data-paused={paused || phase === 'end' ? 'true' : 'false'}
            >
              {phase === 'end' ? <Icon name="refresh" size={20} /> : paused ? <Icon name="play" size={20} /> : <PauseIcon />}
            </button>
            <ol className="lx-fm-dots" aria-label={t('eeFmStepsAria')}>
              {steps.map((_, i) => (
                <li key={i}>
                  <button type="button" className="lx-fm-dot" aria-label={t('eeFmStepAria', { n: i + 1 })} aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)} data-testid="film-dot" />
                </li>
              ))}
            </ol>
            <span className="flex-1" />
            <button type="button" className="lx-fm-chip" aria-pressed={slow} onClick={toggleSlow} data-testid="film-slow">
              0,75×
              <span className="sr-only"> {t('eeFmSlow')}</span>
            </button>
            {canVoice && (
              <button type="button" className="lx-fm-chip" aria-pressed={voice} onClick={toggleVoice} aria-label={t('eeFmVoice')} title={t('eeFmVoice')} data-testid="film-voice">
                <Icon name="speaker" size={18} />
              </button>
            )}
          </div>
        </>
      )}

      {phase === 'end' && (
        <div className="flex flex-wrap items-center gap-2" data-testid="film-end">
          <p className="lx-t-support w-full text-muted">{t('eeFmEnd')}</p>
          <Button icon="refresh" onClick={start} data-testid="film-again">
            {t('eeFmAgain')}
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} data-testid="film-done">
              {t('eeFmDone')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
