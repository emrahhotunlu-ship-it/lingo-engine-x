import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect } from 'react';
import { useNav } from '../../app/nav';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { flush } from '../progress/persist';
import { RoundTop, SummaryActions } from '../learn/ui';
import { GrammarItem } from './GrammarItem';
import { StepBoundary } from '../../app/shell/Boundary';
import { topicName } from './GrammarScreen';
import { ensureGrammar } from './resume';
import { skipGrammar, inRepeat, commitGrammar, leaveGrammar, reportGrammarDone, touchGrammar, useGrammarSession } from './session';

// Grammatikrunde: eine Aufgabe zur Zeit, Wechsel als kurze Seitwärts-Überblendung. Esc verlässt
// die Runde – alles Beantwortete ist gespeichert bzw. vorgemerkt.

export function GrammarSessionScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const s = useGrammarSession();
  const task = s.tasks[s.pos];

  const leave = () => {
    api.blur();
    leaveGrammar();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  // Neuladen/Deep-Link (G3): erst aus dem Fortsetz-Speicher herstellen, sonst neu starten.
  useLayoutEffect(() => {
    const r = useNav.getState().route;
    if (!useGrammarSession.getState().active && r.name === 'grammarSession') ensureGrammar(r);
  }, []);

  useEffect(() => {
    if (!useGrammarSession.getState().active && useNav.getState().route.name === 'grammarSession') back();
  }, [s.active, back]);

  useEffect(() => {
    const onAny = () => touchGrammar();
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
    };
  }, []);

  const right = s.results.filter((r) => r.ok).length;
  const topics = [...new Set(s.results.map((r) => r.topic))];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="grammar-session" data-mode={s.mode} data-ctx={s.ctx}>
      <RoundTop onClose={leave} progress={s.status === 'running' ? { n: s.pos + 1, total: s.tasks.length } : null} ctx={s.ctx} duty="ch:gram" />
      {/* Leistung (N45): kein Warten auf das Ausblenden – die nächste Aufgabe steht sofort da
          und blendet nur kurz ein (≤ 150 ms, Deckkraft/Verschieben). */}
      <motion.div key={s.status === 'summary' ? 'summary' : `g-${s.step}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DURATION.fast, ease: EASE_OUT }}>
        {s.status === 'running' && task ? (
          <StepBoundary resetKey={`g-${s.step}`} scope="grammarSession" onSkip={skipGrammar}>
            <GrammarItem task={task} ctx={s.ctx} day={s.day} onDone={commitGrammar} badge={inRepeat(s) ? t('nbLernenRepeatBadge') : task.errorT !== null ? t('grReviewBadge') : null} />
          </StepBoundary>
        ) : (
          <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="summary">
            <header className="flex items-start gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                <Icon name="check" size={22} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold tracking-tight">{s.results.length ? t('sumTitle') : t('grNothing')}</h2>
                {s.results.length > 0 && (
                  <p className="lx-tnum text-base text-muted" data-testid="summary-stats">
                    {t('sumStats', { n: s.results.length, pct: Math.round((right / s.results.length) * 100) })}
                  </p>
                )}
              </div>
            </header>
            {topics.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {topics.map((tp) => (
                  <li key={tp} className="rounded-full border border-line px-3 py-1 text-sm">
                    {topicName(tp, lang)}
                  </li>
                ))}
              </ul>
            )}
            {s.block ? (
              <div>
                <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={reportGrammarDone} data-testid="summary-next">
                  {t('nbShNext')}
                </Button>
              </div>
            ) : (
              <SummaryActions onBack={leaveGrammar} />
            )}
          </article>
        )}
      </motion.div>
    </div>
  );
}
