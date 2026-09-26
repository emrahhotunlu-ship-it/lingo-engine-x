import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCapabilities } from '../../platform/capabilities';
import { useLateRescue, type RescueNote } from './lateRescue';

const NOTE_LABEL: Record<RescueNote['reason'], MessageKey> = {
  not_merged: 'skipNotMerged',
  partial: 'skipPartial',
  read_only: 'skipReadOnly',
  invalid: 'skipInvalid',
  db_invalid: 'skipDbInvalid',
  unknown_path: 'skipUnknown',
  missing_local: 'skipMissing',
};

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
