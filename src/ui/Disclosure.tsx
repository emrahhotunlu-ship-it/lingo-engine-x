import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { DURATION, EASE_OUT } from './motion';

/** Eingeklappter Bereich, z. B. „Messwerte dahinter" (Kap. 5). */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted transition-colors hover:text-fg"
      >
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: DURATION.base }} className="inline-flex">
          <Icon name="chevronDown" size={18} />
        </motion.span>
        {label}
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
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
