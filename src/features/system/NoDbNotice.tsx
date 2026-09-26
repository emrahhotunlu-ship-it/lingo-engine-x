import { motion } from 'framer-motion';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';

// Klarer Hinweis statt Absturz, wenn `claude.use("db")` `null` liefert (Kap. 3.1, Kap. 12).

export function NoDbNotice() {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="mx-auto w-full max-w-xl py-10 sm:py-16"
    >
      <Card role="status" data-testid="no-db">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-surface text-cyan-text">
          <Icon name="database" size={22} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t('noDbTitle')}</h1>
        <p className="mt-2 text-base text-muted">{t('noDbBody')}</p>
        <p className="mt-4 text-sm text-subtle">{t('noDbSafe')}</p>
      </Card>
    </motion.div>
  );
}

/** Ein Datenbank-Abonnement ist endgültig abgebrochen: neutral melden, Neuladen anbieten. */
export function ConnectionLost() {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="mx-auto w-full max-w-xl py-10 sm:py-16"
    >
      <Card role="alert" data-testid="connection-lost">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-surface text-gold-text">
          <Icon name="alert" size={22} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t('offlineTitle')}</h1>
        <p className="mt-2 text-base text-muted">{t('offlineBody')}</p>
        <div className="mt-5">
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
            {t('offlineReload')}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
