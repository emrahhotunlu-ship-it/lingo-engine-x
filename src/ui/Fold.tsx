import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { DURATION, EASE_OUT } from './motion';

// Zuklappbare Zeile (UX-Beratung Nr. 6 und 11): Titel und eine graue Nebenzeile, rechts der
// Pfeil. Mehrere Zeilen stehen in EINER Karte mit Trennlinien (`FoldGroup`), nie Karte in Karte.
// Der Inhalt wird erst beim Aufklappen eingehängt (Lesen/Abos erst dann, nichts geht verloren).

type Props = {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  toggleTestId?: string;
};

export function Fold({ title, meta, children, defaultOpen = false, testId, toggleTestId }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div data-testid={testId} data-open={open ? '' : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        data-testid={toggleTestId}
        className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-medium">{title}</span>
          {meta && <span className="lx-tnum text-sm text-muted">{meta}</span>}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: DURATION.base }} className="inline-flex flex-none text-muted">
          <Icon name="chevronDown" size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Eine Karte, darin Zeilen mit Trennlinien. */
export function FoldGroup({ children, className, testId, label }: { children: ReactNode; className?: string; testId?: string; label?: string }) {
  return (
    <section aria-label={label} data-testid={testId} className={`lx-glass flex flex-col divide-y divide-line rounded-[var(--radius-card)] px-4 sm:px-6 ${className ?? ''}`}>
      {children}
    </section>
  );
}
