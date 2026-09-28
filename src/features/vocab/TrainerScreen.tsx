import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { normalize } from '../../domain/answer/normalize';
import { ExerciseView } from './ExerciseView';
import { IntroCard } from './IntroCard';
import { Summary } from './Summary';
import { abortExamples } from './examples';
import { flush } from './persist';
import { answerRepair, currentRepair, leaveSession, nextRepair, pauseActivity, roundProgress, skipCurrent, touch, useSession } from './session';
import { FlipCard } from './anki/FlipCard';
import { StepBoundary } from '../../app/shell/Boundary';
import { usePlayerSkip } from '../../app/shell/Player';
import { cardShown } from './cardMark';
import { useShallow } from 'zustand/react/shallow';
import { RepairItem } from '../repair/RepairItem';
import { ExerciseTop } from '../learn/ui';

// Vokabeltrainer: eine Karte zur Zeit. Kartenwechsel ohne Warte-Animation (leistung.md §4 Nr. 4):
// die neue Karte ersetzt sofort und blendet nur ein (120 ms, nur Deckkraft – kein seitliches
// Verschieben, das am Handy kurz waagrecht überstand). Jede Karte in einer eigenen Fehlergrenze.
// Esc verlässt die Runde – alles Beantwortete ist gespeichert bzw. vorgemerkt.

export function TrainerScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const active = useSession((s) => s.active);
  const status = useSession((s) => s.status);
  const round = useSession((s) => s.round);
  const queue = useSession((s) => s.queue);
  const pos = useSession((s) => s.pos);
  const exercise = useSession((s) => s.exercise);
  const step = useSession((s) => s.step);
  const cards = useSession((s) => s.cards);
  const pool = useSession((s) => s.pool);
  const repair = useSession(currentRepair);

  const knownWords = useMemo(() => new Set(pool.map((c) => normalize(c.lemma))), [pool]);

  const leave = () => {
    api.blur();
    leaveSession();
    void flush();
    back();
  };

  useHotkeys({ escape: leave }, api.isInput);

  useEffect(() => {
    if (!active && useNav.getState().route.name === 'trainer') back();
  }, [active, back]);

  // Bildschirmwechsel: laufende KI-Anfragen für Beispielsätze abbrechen (A6.2).
  useEffect(() => () => abortExamples(), []);

  useEffect(() => {
    const onVis = () => pauseActivity(document.visibilityState === 'hidden');
    const onAny = () => touch();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
    };
  }, []);

  const item = queue[pos];
  const introCard = status === 'running' && item?.phase === 'intro' ? cards.get(item.key) : undefined;
  const progress = useSession(useShallow(roundProgress));
  const onDone = () => undefined;
  const skip = () => {
    if (skipCurrent() === 'typed') api.focusNow();
    else api.blur();
  };
  // Fehlergrenze der Übungsebene (G4): „Diese Aufgabe überspringen“ geht ohne Bewertung weiter.
  usePlayerSkip(status === 'running' ? skip : null);
  // Messmarke lx:card: neue Karte gezeichnet (nächster Frame nach dem Einhängen).
  useLayoutEffect(() => {
    cardShown();
  }, [step]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="trainer">
      <ExerciseTop
        onClose={leave}
        closeLabel={t('trClose')}
        closeTestId="trainer-close"
        progress={progress}
        progressTestId="trainer-progress"
        ctx={round === 'extra' ? 'extra' : 'duty'}
        duty="review"
      />
      <motion.div
        key={status === 'summary' ? 'summary' : `step-${step}`}
        data-step={status === 'summary' ? 'summary' : step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
      >
        {status === 'summary' ? (
          <Summary onBack={leave} />
        ) : (
          <StepBoundary resetKey={step} scope="trainer" detail={item?.key ?? 'repair'} onSkip={skip}>
            {repair ? (
              <RepairItem
                key={repair.id}
                item={repair}
                mode="review"
                area="trainer"
                source={null}
                onResult={({ ok, given, ms }) => answerRepair(ok, given, ms)}
                onNext={() => {
                  // Tastatur am iPhone: im selben Handler fokussieren bzw. schließen.
                  if (nextRepair() === 'typed') api.focusNow();
                  else api.blur();
                }}
              />
            ) : introCard ? (
              <IntroCard card={introCard} onDone={onDone} />
            ) : exercise?.ex === 'flip' ? (
              <FlipCard key={`${exercise.card.key}-${step}`} exercise={exercise} again={item?.reason === 'again'} onDone={onDone} />
            ) : exercise ? (
              <ExerciseView exercise={exercise} knownWords={knownWords} again={item?.reason === 'again'} onDone={onDone} />
            ) : null}
          </StepBoundary>
        )}
      </motion.div>
    </div>
  );
}
