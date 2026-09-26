import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EnglishText } from '../../engine/EnglishText';
import { useHotkeys } from '../../engine/useHotkeys';
import type { WordTapArea } from '../../engine/wordTap';
import { evidenceSentence } from '../../domain/input/evidence';
import type { ChoiceResult, Question } from '../../domain/input/types';
import { useT } from '../../i18n';
import { haptic } from '../../platform/haptics';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { Button, IconButton } from '../../ui/Button';
import { DURATION } from '../../ui/motion';
import { ActiveClock } from './activeClock';

// Eine Verständnisfrage (Plan §4.1 Nr. 3, F15): Tippen oder Ziffer 1–4, sofort bewertet, keine
// Selbstbewertung. Danach: gewählt rot bzw. grün, die richtige grün, „Im Text:" mit dem Beleg
// (antippbar, beim Hören abspielbar) und die Erklärung in der Oberflächensprache – auch bei
// richtiger Antwort. Vor der Wahl steht kein Lösungsattribut im DOM (DOM-Vertrag).

type Props = {
  question: Question;
  index: number;
  total: number;
  /** Text, in dem der Beleg gesucht wird. */
  source: string;
  area: WordTapArea;
  sourceRef: string;
  sourceTitle: string;
  onAnswered: (r: ChoiceResult) => void;
  onNext: () => void;
  nextLabel: string;
  /** Beleg zusätzlich abspielbar (Hören). */
  speakable?: boolean;
};

export function QuestionCard({ question, index, total, source, area, sourceRef, sourceTitle, onAnswered, onNext, nextLabel, speakable }: Props) {
  const { t, lang } = useT();
  const [chosen, setChosen] = useState<number | null>(null);
  const [clock] = useState(() => new ActiveClock());
  const speech = useSpeech((s) => s.status);
  const nextRef = useRef<HTMLButtonElement>(null);
  const done = chosen !== null;

  useEffect(() => {
    clock.start();
    return () => clock.pause();
  }, [clock]);

  const evidence = useMemo(() => (done ? evidenceSentence(source, question.options[question.answer] ?? '', question.q) : null), [done, source, question]);
  const explain = question.explain[lang] ?? null;

  const choose = (i: number) => {
    if (done || i < 0 || i >= question.options.length) return;
    const correct = i === question.answer;
    setChosen(i);
    haptic(correct ? 'success' : 'error');
    onAnswered({ key: question.key, chosen: i, correct, ms: clock.ms() });
  };

  useEffect(() => {
    if (done) nextRef.current?.focus({ preventScroll: true });
  }, [done]);

  useHotkeys(
    {
      digit: (n) => choose(n - 1),
      enter: () => {
        if (done) onNext();
      },
    },
    () => false,
  );

  const stateOf = (i: number): 'correct' | 'wrong' | 'solution' | undefined => {
    if (!done) return undefined;
    if (i === chosen) return i === question.answer ? 'correct' : 'wrong';
    if (i === question.answer) return 'solution';
    return undefined;
  };

  return (
    <motion.article
      key={question.key}
      className="lx-glass flex flex-col gap-4 rounded-[var(--radius-card)] p-5 sm:p-6"
      data-testid="question"
      data-type={question.type}
      data-index={index}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATION.base }}
    >
      <p className="lx-tnum text-xs font-medium text-muted" data-testid="question-status">
        {t('inQuestionOf', { i: index + 1, n: total, type: t(`qType_${question.type}`) })}
      </p>
      <h2 className="text-lg font-semibold tracking-tight" lang={question.qLang}>
        {question.q}
      </h2>
      <p className="sr-only">{t('inTaskChoose')}</p>
      <div role="group" aria-label={t('inTaskChoose')} className="grid gap-2">
        {question.options.map((o, i) => {
          const st = stateOf(i);
          return (
            <motion.button
              key={`${question.key}-${i}`}
              type="button"
              data-testid="option"
              data-state={st}
              disabled={done}
              aria-pressed={i === chosen}
              whileTap={done ? undefined : { scale: 0.98 }}
              transition={{ duration: DURATION.fast }}
              onClick={() => choose(i)}
              className={`lx-choice ${st === 'solution' ? 'border-accent bg-accent-soft' : ''} ${done && !st ? 'opacity-55' : ''}`}
            >
              <span className="lx-choice-key" aria-hidden="true">
                {i + 1}
              </span>
              <span lang={question.qLang} className="min-w-0 flex-1 text-left">
                {o}
              </span>
            </motion.button>
          );
        })}
      </div>
      {done && (
        <section className="flex flex-col gap-3 border-t border-line pt-4" aria-live="polite" data-testid="result">
          {evidence && (
            <div className="flex flex-col gap-1" data-testid="evidence">
              <div className="flex items-center justify-between gap-2">
                <p className="lx-eyebrow">{t('inEvidence')}</p>
                {speakable && speech === 'ready' && (
                  <IconButton
                    icon="speaker"
                    label={t('inSpeak')}
                    data-testid="evidence-speak"
                    onClick={() => {
                      unlockSpeech();
                      void speak(evidence.text);
                    }}
                  />
                )}
              </div>
              <EnglishText text={evidence.text} area={area} source={sourceRef} title={sourceTitle} className="text-base" />
            </div>
          )}
          {explain && (
            <p className="text-sm text-muted" lang={lang} data-testid="explain">
              {explain}
            </p>
          )}
          <div>
            <Button ref={nextRef} variant="primary" iconAfter="arrowRight" onClick={onNext} data-testid="next">
              {nextLabel}
            </Button>
          </div>
        </section>
      )}
    </motion.article>
  );
}
