import { useEffect, useId, useState, type ReactNode } from 'react';

// Kleiner Aufklappbereich „Mehr ▸“ innerhalb der Ergebnisfläche (keine eigene Karte, kein Rahmen).
// Meldet seinen Zustand nach außen, damit das Gerüst „automatisch weiter“ anhalten kann.

export function FoldToggle({ label, children, onOpenChange, testId }: { label: string; children: ReactNode; onOpenChange?: ((open: boolean) => void) | undefined; testId: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    // Nur offene Phasen melden sich an und beim Schließen wieder ab (so zählt der Aufrufer sauber mit).
    if (!open) return;
    onOpenChange?.(true);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="lx-t-support -mx-1 flex min-h-11 items-center justify-between gap-2 self-stretch rounded-[var(--radius-inline)] px-1 font-semibold text-muted hover:text-fg"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        data-testid={testId}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="inline-block transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
          ▸
        </span>
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-2">
        {open ? children : null}
      </div>
    </div>
  );
}
