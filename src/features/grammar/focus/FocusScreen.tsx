import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect } from 'react';
import { useNav } from '../../../app/nav';
import { useHiddenInput } from '../../../engine/HiddenInput';
import { useHotkeys } from '../../../engine/useHotkeys';
import { useT } from '../../../i18n';
import { DURATION, EASE_OUT } from '../../../ui/motion';
import { SessionEnd } from '../../../ui/SessionEnd';
import { useCompanionSee } from '../../companion/seeing';
import { ExerciseTop } from '../../learn/ui';
import { flush } from '../../progress/persist';
import { GrammarItem } from '../GrammarItem';
import { FocusItem } from './FocusItem';
import { ensureFocus } from './resume';
import { commitFocus, leaveFocus, reportFocusDone, touchFocus, useFocus } from './session';

// Block 4 „Fokus“ der Tageseinheit (plan.md §1.5, N41): höchstens 3 Korrekturen plus Mini-Drill,
// aufgefüllt mit fälligen Fehlersätzen. Aufgabe zu Aufgabe ohne Warten (N45).

export function FocusScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const status = useFocus((s) => s.status);
  const tasks = useFocus((s) => s.tasks);
  const pos = useFocus((s) => s.pos);
  const step = useFocus((s) => s.step);
  const day = useFocus((s) => s.day);
  const block = useFocus((s) => s.block);
  const results = useFocus((s) => s.results);
  const activeMs = useFocus((s) => s.activeMs);
  const task = tasks[pos];
  useCompanionSee({ area: 'grammar', label: t('nbLernenFocusTitle'), phase: 'idle' });

  const leave = () => {
    api.blur();
    leaveFocus();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  // Ohne laufende Sitzung (Deep-Link, Neuladen): herstellen oder aus den Daten von heute bauen.
  useLayoutEffect(() => {
    if (!useFocus.getState().active) ensureFocus();
  }, []);

  useEffect(() => {
    const onAny = () => touchFocus();
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
    };
  }, []);

  const main = tasks.filter((x) => !(x.kind === 'trap' && x.drill)).length;
  const right = results.filter((r) => r.ok).length;
  const statusLine = t('nbLernenFocusCount', { n: Math.min(pos + 1, tasks.length), total: tasks.length });
  const focusNext = (kind: 'typed' | 'choice' | null) => (kind === 'typed' ? api.focusNow() : api.blur());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="unit-focus" data-block={block ?? ''} data-main={main}>
      <ExerciseTop onClose={leave} progress={status === 'running' ? { n: pos + 1, total: tasks.length } : null} ctx="duty" />
      <motion.div key={status === 'summary' ? 'summary' : `f-${step}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DURATION.fast, ease: EASE_OUT }}>
        {status === 'running' && task?.kind === 'grammar' && (
          <GrammarItem
            key={task.id}
            task={task.task}
            ctx="duty"
            day={day}
            badge={task.reason === 'due' ? t('grReviewBadge') : t('nbLernenFocusDaily')}
            onDone={(a) => focusNext(commitFocus({ id: task.id, kind: 'grammar', ok: !a.dontKnow && a.verdict !== 'wrong', verdict: a.verdict === 'correct' ? 'ok' : a.verdict === 'near' ? 'close' : 'wrong', right: task.task.answer }, { answer: a }))}
          />
        )}
        {status === 'running' && task && task.kind !== 'grammar' && <FocusItem key={task.id} task={task} status={statusLine} onDone={(row, missed) => focusNext(commitFocus(row, missed ? { missed } : undefined))} />}
        {status === 'summary' && (
          <div className="lx-glass rounded-[var(--radius-card)] p-5 sm:p-7">
            <SessionEnd
              right={right}
              total={results.length}
              ms={activeMs}
              takeaways={
                results.length ? (
                  <ul className="flex flex-col gap-1 text-sm" lang="en" data-testid="focus-takeaways">
                    {results
                      .filter((r) => r.kind !== 'grammar')
                      .slice(0, 4)
                      .map((r) => (
                        <li key={r.id}>{r.right}</li>
                      ))}
                  </ul>
                ) : undefined
              }
              next={{
                label: block ? t('nbShNext') : t('nbLernenDone'),
                run: () => {
                  if (block) {
                    reportFocusDone();
                    return;
                  }
                  leave();
                },
              }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
