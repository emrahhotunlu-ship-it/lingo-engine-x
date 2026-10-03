import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { markWhatsNewSeen, whatsNewSeen } from './whatsNew';

// „Was ist neu" (M20): eine schmale, schließbare Zeile oben – kein Blatt, das beim Öffnen den
// Fokus nimmt und keine Karte, die mit dem Pflichtknopf konkurriert (Kap. 2.1). Einmal je Update.

const LINES: readonly MessageKey[] = ['wnCheck', 'wnWeek', 'wnSettings', 'wnTeacher'];

export function WhatsNew() {
  const { t } = useT();
  const [open, setOpen] = useState(() => !whatsNewSeen());
  const [more, setMore] = useState(false);
  const close = () => {
    markWhatsNewSeen();
    setOpen(false);
  };
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          aria-labelledby="whats-new-title"
          className="lx-glass mt-3 flex flex-col gap-2 rounded-[var(--radius-card)] px-4 py-2"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          data-testid="whats-new"
        >
          <div className="flex items-center gap-2">
            <span className="text-cyan-text">
              <Icon name="sparkle" size={18} />
            </span>
            <p id="whats-new-title" className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{t('wnTitle')}</span> <span className="text-muted">{t('wnLead')}</span>
            </p>
            <button type="button" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-cyan-text" aria-expanded={more} onClick={() => setMore((m) => !m)} data-testid="whats-new-more">
              {more ? t('wnLess') : t('wnMore')}
            </button>
            <IconButton icon="close" label={t('wnClose')} onClick={close} data-testid="whats-new-close" />
          </div>
          {more && (
            <ul className="flex list-disc flex-col gap-1 pb-2 pl-9 text-sm text-muted" data-testid="whats-new-list">
              {LINES.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
