import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { VIconButton } from './VIconButton';

// D1 V-BAU: Blatt der Vorschau (`.scrim` + `.sheet`, Vorschau style.css:296–304; app.js:201–205): unten angedockt, Griff, Titel 22/28,
// Inhalt scrollt, Fuß mit Trennlinie. Kein schwebendes Fenster, kein Weichzeichner (stufe1c-plan.md §6).
// Bedienung: Antippen der abgedunkelten Fläche oder Esc schließt; der Fokus geht ins Blatt und danach zurück zum Auslöser.
// Für Tastatur und Screenreader gibt es einen Schließen-Knopf, der erst bei Tastaturfokus sichtbar wird (die Vorschau zeigt keinen).

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  foot?: ReactNode;
  'data-testid'?: string;
};

export function VSheet({ open, onClose, title, closeLabel, children, foot, ...rest }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Liegen mehrere Dialoge übereinander, reagiert nur der oberste.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.tabIndex >= 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="lx-v-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} className="lx-v-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-testid={rest['data-testid']}>
        <div className="lx-v-grab" aria-hidden="true" />
        <div className="lx-v-gx">
          <h2 id={titleId} className="lx-v-disp">
            {title}
          </h2>
        </div>
        <VIconButton icon="close" label={closeLabel} className="lx-v-sheet-x" onClick={onClose} />
        <div className="lx-v-sheet-body lx-v-gx">{children}</div>
        {foot && <div className="lx-v-sheet-foot lx-v-gx">{foot}</div>}
      </div>
    </>,
    document.body,
  );
}
