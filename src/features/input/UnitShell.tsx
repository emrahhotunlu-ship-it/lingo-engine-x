import { motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { useHotkeys } from '../../engine/useHotkeys';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import type { Channel } from '../../ui/Card';

// Rahmen einer Einheit (Plan §6.1): Kopfleiste mit ✕ (44 px), Titel und Schritt bzw. Frage,
// darunter die Statuszeile. Aufgabe in einer Zeile, „Wozu?" nur hinter dem Info-Symbol (A7).

type Props = {
  kind: 'read' | 'listen' | 'write' | 'discover';
  ctx: 'duty' | 'extra';
  state: string;
  title: string;
  onClose: () => void;
  /** Stepper oder „Frage i von n" rechts bzw. unter dem Titel. */
  progress?: ReactNode;
  status?: ReactNode;
  task?: ReactNode;
  purpose?: ReactNode;
  children: ReactNode;
  /** Ab `lg` zweispaltig: links der Text, rechts Fragen/Rückmeldung (sticky). */
  aside?: ReactNode;
};

export function UnitShell({ kind, ctx, state, title, onClose, progress, status, task, purpose, children, aside }: Props) {
  const { t } = useT();
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const channel: Channel = kind;
  // Esc verlässt die Einheit (Entwürfe bleiben lokal gesichert); bei offenem Nachschlagen
  // schließt Esc zuerst das Fenster (useHotkeys lässt Dialoge in Ruhe).
  useHotkeys({ escape: onClose }, () => false);
  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="unit"
      data-kind={kind}
      data-ctx={ctx}
      data-state={state}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon="close" label={t('inLeave')} onClick={onClose} data-testid="unit-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: `var(--lx-ch-${channel})` }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        {progress}
        {status}
        {task && (
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium" data-testid="task">
              {task}
            </p>
            {purpose && (
              <button
                type="button"
                className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
                aria-label={t('inInfo')}
                aria-expanded={info}
                aria-controls={`${infoId}-purpose`}
                onClick={() => setInfo((v) => !v)}
                data-testid="purpose-info"
              >
                <Icon name="info" size={18} />
              </button>
            )}
          </div>
        )}
        {info && purpose && (
          <p id={`${infoId}-purpose`} className="text-sm text-muted" data-testid="purpose">
            {purpose}
          </p>
        )}
      </header>
      {aside ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">{children}</div>
          <div className="min-w-0 lg:sticky lg:top-4">{aside}</div>
        </div>
      ) : (
        children
      )}
    </motion.section>
  );
}
