import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId } from 'react';
import { create } from 'zustand';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCapabilities } from '../../platform/capabilities';
import { useLateRescue, type RescueNote } from './lateRescue';
import { useNav } from '../../app/nav';

const NOTE_LABEL: Record<RescueNote['reason'], MessageKey> = {
  not_merged: 'skipNotMerged',
  partial: 'skipPartial',
  read_only: 'skipReadOnly',
  invalid: 'skipInvalid',
  db_invalid: 'skipDbInvalid',
  unknown_path: 'skipUnknown',
  missing_local: 'skipMissing',
};

/**
 * W5 (A7): unauffälliger Hinweis auf „Heute", wenn dieser Browser noch Kopien der alten App hat.
 * Eine Textzeile unten, keine Karte und kein Primärknopf – die rote Linie bleibt der Pflichtknopf
 * (Kap. 2.1). Das Nachtragen selbst geschieht auf „Dein Stand".
 */
// Genau EINE Zeile je Bildschirm (Kap. 15 „nichts doppelt“): Die Zeile hängt als Abschnitt am
// Platz `today` (P6); solange „Heute“ sie zusätzlich selbst zeichnet, gewinnt die zuerst
// eingehängte Stelle, die andere bleibt leer.
const useHintOwners = create<{ ids: readonly string[] }>(() => ({ ids: [] }));

function useSingleHint(): boolean {
  const id = useId();
  useEffect(() => {
    useHintOwners.setState((s) => ({ ids: [...s.ids, id] }));
    return () => useHintOwners.setState((s) => ({ ids: s.ids.filter((x) => x !== id) }));
  }, [id]);
  return useHintOwners((s) => s.ids[0] === id);
}

export function LateRescueHint() {
  const { tn, t } = useT();
  const db = useCapabilities((s) => s.db);
  const go = useNav((s) => s.go);
  const state = useLateRescue();
  const owner = useSingleHint();
  const { check } = state;
  useEffect(() => {
    if (db === 'ready') void check();
  }, [db, check]);
  if (!owner || (state.phase !== 'pending' && state.phase !== 'failed')) return null;
  const n = state.items.length + state.notes.length;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-subtle" data-testid="late-rescue-hint">
      <Icon name="download" size={14} />
      <span>{tn('lateTodayHint', n)}</span>
      <button type="button" className="inline-flex min-h-11 items-center font-medium text-cyan-text underline-offset-2 hover:underline" onClick={() => go({ name: 'overview' })} data-testid="late-rescue-open">
        {t('lateTodayOpen')}
      </button>
    </p>
  );
}

/** Hinweis oben auf „Dein Stand", wenn dieser Browser noch Kopien der alten App hat. */
export function LateRescueCard() {
  const { t, tn } = useT();
  const db = useCapabilities((s) => s.db);
  const state = useLateRescue();
  const { check } = state;

  useEffect(() => {
    if (db === 'ready') void check();
  }, [db, check]);

  const visible = state.phase === 'pending' || state.phase === 'running' || state.phase === 'failed';
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
        >
          <Card channel="discover" aria-labelledby="late-title" data-testid="late-rescue">
            <h2 id="late-title" className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-cyan-text">
                <Icon name="download" />
              </span>
              {t('lateTitle')}
            </h2>
            {state.items.length > 0 && <p className="mt-2 text-sm text-muted">{tn('lateBody', state.items.length)}</p>}
            {state.notes.length > 0 && (
              <div className="mt-3" data-testid="late-notes">
                <p className="text-sm text-fg">{t('lateNotesTitle')}</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm text-muted">
                  {state.notes.map((n) => (
                    <li key={n.path} className="break-all">
                      <span className="text-fg">{n.path}</span> – {t(NOTE_LABEL[n.reason])}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-subtle">{t('lateNotesHint')}</p>
              </div>
            )}
            {state.phase === 'failed' && (
              <p role="alert" className="mt-2 text-sm text-danger-text">
                {t('lateFailed', { msg: state.message ?? '' })}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {state.items.length > 0 && (
                <Button variant="primary" icon="plus" onClick={() => void state.run()} busy={state.phase === 'running'} busyLabel={t('lateRunning')}>
                  {t('lateRun')}
                </Button>
              )}
              {state.items.length === 0 && state.notes.length > 0 && (
                <Button variant="primary" icon="check" onClick={state.acknowledge}>
                  {t('lateAck')}
                </Button>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
