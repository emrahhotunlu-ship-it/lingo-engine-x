import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { useCapabilities } from '../../platform/capabilities';
import { useLateRescue } from './lateRescue';

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
            <p className="mt-2 text-sm text-muted">{tn('lateBody', state.items.length)}</p>
            {state.phase === 'failed' && (
              <p role="alert" className="mt-2 text-sm text-danger-text">
                {t('lateFailed', { msg: state.message })}
              </p>
            )}
            <div className="mt-4">
              <Button
                variant="primary"
                icon="plus"
                onClick={() => void state.run()}
                busy={state.phase === 'running'}
                busyLabel={t('lateRunning')}
              >
                {t('lateRun')}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
