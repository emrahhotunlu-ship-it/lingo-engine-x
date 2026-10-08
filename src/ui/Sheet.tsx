import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { DURATION, EASE_OUT } from './motion';
import { SheetGrip, useSheetDrag } from './sheetDrag';
import { SHARED_TRANSITION } from '../engine/shared';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /** Kap. 4.4: gemeinsames Element – der Titel gleitet vom auslösenden Element (z. B. Wortzeile) herein. */
  titleLayoutId?: string;
  /** UX-Prüfung W5: Blatt bemisst sich am Inhalt (kurze Menüs): unten angedockt, höchstens bis unter den oberen Rand. */
  fit?: boolean;
  /** Laptop: breites Paneel für zwei Spalten (z. B. „Weg zu C1“, Lernplattform 3.0 P45). Handy unverändert. */
  wide?: boolean;
};

/**
 * Blatt über dem Inhalt: am Handy von unten als Vollbild-Blatt, ab Tablet als Paneel rechts.
 * Esc schließt, der Fokus kehrt zum auslösenden Element zurück (Kap. 4.5).
 */
export function Sheet({ open, onClose, title, closeLabel, children, titleLayoutId, fit = false, wide = false }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Am Handy: am Griff/an der Kopfzeile nach unten wischen schließt (Kap. 4.5).
  const drag = useSheetDrag(onClose);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      // Liegen mehrere Blätter übereinander (z. B. Kapitelprüfung über dem Kapitelblatt), reagiert nur das oberste auf Esc und Tab.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      const top = dialogs[dialogs.length - 1];
      if (top && panel.current && top !== panel.current) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      // Fokus bleibt im Dialog (aria-modal): am Ende wieder vorn beginnen und umgekehrt.
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => panel.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onClose]);

  // UX-Prüfung B1: das Blatt hängt direkt an <body>. Ein Vorfahr mit `backdrop-filter`/`transform` (z. B. `.lx-glass`) würde sonst zum
  // Bezugsrahmen für `position: fixed`, und das Blatt säße in der Karte fest. Theme-Variablen hängen an <html> und gelten weiter.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'var(--lx-scrim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            // Am Handy gleitet das Blatt beim Schließen nach unten weg (auch nach dem Wischen).
            exit={{ opacity: 0, y: drag.mobile ? '60%' : 20 }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            {...drag.panel}
            data-fit={fit || undefined}
            className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[1.5rem] border border-line bg-surface-solid shadow-2xl outline-none md:right-3 md:left-auto md:w-[26rem] md:rounded-[1.5rem] ${wide ? 'lg:w-[min(56rem,calc(100%-1.5rem))] ' : ''}${
              fit ? 'max-h-[calc(100%-max(env(safe-area-inset-top),1.5rem))] md:bottom-3 md:max-h-[calc(100%-1.5rem)]' : 'top-[max(env(safe-area-inset-top),1.5rem)] md:inset-y-3 md:top-3'
            }`}
          >
            <div {...drag.handle} className="flex flex-none flex-col">
              <SheetGrip />
              <header className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 sm:px-6 md:pt-4">
                <motion.h2 id={titleId} layoutId={titleLayoutId} transition={SHARED_TRANSITION} className="text-lg font-semibold tracking-tight">
                  {title}
                </motion.h2>
                <IconButton icon="close" label={closeLabel} onClick={onClose} />
              </header>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:px-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
