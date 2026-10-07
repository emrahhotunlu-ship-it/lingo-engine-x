import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect } from 'react';
import { useNav } from '../../app/nav';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT, type MessageKey } from '../../i18n';
import { stopSpeech } from '../../platform/speech';
import { SessionEnd } from '../../ui/SessionEnd';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { flush } from '../progress/persist';
import { RoundTop } from '../learn/ui';
import { useEndActions } from './endActions';
import { ClozeItemView, DictationItem, OrderItemView } from './DrillItems';
import { ensureDrill } from './resume';
import { skipDrill, commitDrill, itemsOf, leaveDrill, reportDrillDone, touchDrill, useDrill } from './session';
import { SprintView } from './SprintView';
import { StepBoundary } from '../../app/shell/Boundary';
import { useCompanionSee } from '../companion/seeing';

// Rahmen der vier Übungen: Kopf mit Schließen, Fortschritt und Pflicht-/Extra-Kennzeichen,
// eine Aufgabe zur Zeit, am Ende die Zusammenfassung mit „Weiter: nächster Pflichtschritt".

const EMPTY_KEY: Record<string, MessageKey> = { dictate: 'drDictateEmpty', cloze: 'drClozeEmpty', order: 'drOrderEmpty', sprint: 'drSprintEmpty' };
const DRILL_NAME: Record<string, MessageKey> = { dictate: 'drDictate', cloze: 'drCloze', order: 'drOrder', sprint: 'drSprint' };

export function DrillScreen() {
  const { t } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const s = useDrill();
  const items = itemsOf(s);
  useCompanionSee({ area: 'drills', label: t(DRILL_NAME[s.kind] ?? 'drDictate'), phase: 'idle' });

  const leave = () => {
    api.blur();
    stopSpeech();
    leaveDrill();
    void flush();
    back();
  };
  useHotkeys({ escape: leave }, api.isInput);

  useLayoutEffect(() => {
    const r = useNav.getState().route;
    if (!useDrill.getState().active && r.name === 'drill') ensureDrill(r);
  }, []);

  useEffect(() => {
    if (!useDrill.getState().active && useNav.getState().route.name === 'drill') back();
  }, [s.active, back]);

  useEffect(() => {
    const onAny = () => touchDrill();
    window.addEventListener('pointerdown', onAny, { passive: true });
    window.addEventListener('keydown', onAny);
    return () => {
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
      stopSpeech();
    };
  }, []);

  const running = s.status === 'running';
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="drill" data-kind={s.kind} data-ctx={s.ctx}>
      <RoundTop onClose={leave} progress={running && s.kind !== 'sprint' ? { n: s.pos + 1, total: items.length } : null} ctx={s.ctx} duty={`ch:${s.kind}`} />
      {s.kind === 'sprint' ? (
        <SprintView />
      ) : (
        <motion.div key={running ? `d-${s.step}` : 'summary'} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DURATION.fast, ease: EASE_OUT }}>
          <StepBoundary resetKey={`d-${s.step}`} scope="drill" onSkip={skipDrill}>
            {running && s.kind === 'dictate' && s.dictate[s.pos] && <DictationItem item={s.dictate[s.pos]!} ctx={s.ctx} day={s.day} profile={s.profile} onDone={commitDrill} />}
            {running && s.kind === 'cloze' && s.cloze[s.pos] && <ClozeItemView item={s.cloze[s.pos]!} ctx={s.ctx} day={s.day} profile={s.profile} onDone={commitDrill} />}
            {running && s.kind === 'order' && s.order[s.pos] && <OrderItemView item={s.order[s.pos]!} ctx={s.ctx} day={s.day} profile={s.profile} onDone={commitDrill} />}
          </StepBoundary>
          {!running && <DrillEnd />}
        </motion.div>
      )}
    </div>
  );
}

/** Rundenende im Übungsgerüst: Richtig · Zeit, die Sätze der Runde, genau ein Hauptknopf (`SessionEnd`). */
function DrillEnd() {
  const { t } = useT();
  const s = useDrill();
  const end = useEndActions({ onBack: leaveDrill, backTo: { name: 'apply' }, backLabel: t('lrBackToApply'), onDutyDone: s.block ? reportDrillDone : null });
  const right = s.results.filter((r) => r.ok).length;
  const list =
    s.results.length > 0 ? (
      <ul className="flex flex-col gap-1.5 lx-t-support" lang="en" data-testid="summary-list">
        {s.results.map((r, i) => (
          <li key={`${r.label}-${i}`} className={r.ok ? '' : 'text-wrong-text'}>
            {r.label}
          </li>
        ))}
      </ul>
    ) : undefined;
  return (
    <SessionEnd
      mode={s.results.length ? 'tiles' : 'growth'}
      title={s.results.length ? t('sumTitle') : t(EMPTY_KEY[s.kind] ?? 'sumEmpty')}
      right={right}
      total={s.results.length}
      ms={s.activeMs}
      {...(list ? { takeaways: list } : {})}
      next={end.main}
      {...(end.secondary ? { secondary: end.secondary } : {})}
    />
  );
}
