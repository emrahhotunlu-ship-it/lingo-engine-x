import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useNav } from '../../app/nav';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { normalize } from '../../domain/answer/normalize';
import { ExerciseView } from './ExerciseView';
import { IntroCard } from './IntroCard';
import { Summary } from './Summary';
import { abortExamples } from './examples';
import { flush } from './persist';
import { leaveSession, pauseActivity, touch, useSession } from './session';

// Vokabeltrainer: eine Karte zur Zeit, Kartenwechsel als kurze Seitwärts-Überblendung.
// Esc verlässt die Runde – alles Beantwortete ist gespeichert bzw. vorgemerkt.

export function TrainerScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const go = useNav((s) => s.go);
  const active = useSession((s) => s.active);
  const status = useSession((s) => s.status);
  const round = useSession((s) => s.round);
  const queue = useSession((s) => s.queue);
  const pos = useSession((s) => s.pos);
  const exercise = useSession((s) => s.exercise);
  const step = useSession((s) => s.step);
  const cards = useSession((s) => s.cards);
  const pool = useSession((s) => s.pool);
  const answered = useSession((s) => s.answered.length);
  const target = useSession((s) => s.target);
  const doneBefore = useSession((s) => s.doneBefore);

  const knownWords = useMemo(() => new Set(pool.map((c) => normalize(c.lemma))), [pool]);

  const leave = () => {
    api.blur();
    leaveSession();
    void flush();
    go({ name: 'today' });
  };

  useHotkeys({ escape: leave }, api.isInput);

  useEffect(() => {
    if (!active) go({ name: 'today' });
  }, [active, go]);

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
  const total = round === 'pflicht' ? doneBefore + target : target;
  const current = Math.min(total, (round === 'pflicht' ? doneBefore : 0) + answered + (status === 'running' ? 1 : 0));
  const onDone = () => undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="trainer">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconButton icon="close" label={t('trClose')} onClick={leave} data-testid="trainer-close" />
          {status === 'running' && total > 0 && (
            <p className="lx-tnum text-sm text-muted" data-testid="trainer-progress">
              {t('trProgress', { n: Math.max(1, current), total })}
            </p>
          )}
        </div>
        {round === 'extra' && <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">{t('trExtraBadge')}</span>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={status === 'summary' ? 'summary' : `step-${step}`}
          data-step={status === 'summary' ? 'summary' : step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
        >
          {status === 'summary' ? (
            <Summary onBack={leave} />
          ) : introCard ? (
            <IntroCard card={introCard} onDone={onDone} />
          ) : exercise ? (
            <ExerciseView exercise={exercise} knownWords={knownWords} onDone={onDone} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
