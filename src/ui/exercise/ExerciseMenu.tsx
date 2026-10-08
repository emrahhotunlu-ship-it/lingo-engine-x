import { useEffect, useId, useRef, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { useMediaQuery } from '../../platform/input';
import { Sheet } from '../Sheet';
import type { ShellMenuId } from './ExerciseShell';
import { Slot } from '../../app/slots';

// Menü ⋯ (§4.3) rechts in der Urteilszeile: am Handy ein Blatt von unten, ab 768 px ein kleines Menü.
// (`Icon` kennt kein ⋯; das Symbol ist hier als drei Punkte inline gezeichnet.)

const ORDER: readonly ShellMenuId[] = ['override', 'copyOnce', 'showMe', 'translate', 'moreInfo', 'askClaude', 'wholeTopic', 'report'];
const LABEL: Record<ShellMenuId, MessageKey> = {
  override: 'exMenuOverride',
  copyOnce: 'exMenuCopyOnce',
  showMe: 'eeFmShowMe',
  translate: 'exMenuTranslate',
  moreInfo: 'exMenuMoreInfo',
  askClaude: 'exMenuAskClaude',
  wholeTopic: 'exMenuWholeTopic',
  report: 'cxMenuReport',
};

function Dots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

export function ExerciseMenu({ items, onOpenChange }: { items: Partial<Record<ShellMenuId, () => void>>; onOpenChange?: ((open: boolean) => void) | undefined }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 768px)');
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const entries = ORDER.flatMap((k) => {
    const fn = items[k];
    return fn ? [{ id: k, fn }] : [];
  });
  useEffect(() => {
    if (!open) return;
    onOpenChange?.(true);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);
  // Laptop-Menü: Esc und Klick daneben schließen.
  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, wide]);
  if (!entries.length) return null;
  const list = (
    <ul className="flex flex-col" role={wide ? 'menu' : undefined} id={id}>
      {entries.map((e) => (
        <li key={e.id} role={wide ? 'none' : undefined}>
          <button
            type="button"
            role={wide ? 'menuitem' : undefined}
            className="lx-t-body flex min-h-11 w-full items-center rounded-[var(--radius-inline)] px-3 text-left hover:bg-surface"
            data-testid={`menu-${e.id}`}
            onClick={() => {
              setOpen(false);
              e.fn();
            }}
          >
            {t(LABEL[e.id])}
          </button>
        </li>
      ))}
      <Slot name="exercise.menu" />
    </ul>
  );
  return (
    <div ref={root} className="relative" data-slot="menu">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
        aria-label={t('exMenu')}
        aria-haspopup={wide ? 'menu' : 'dialog'}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        data-testid="exercise-menu"
      >
        <Dots />
      </button>
      {wide ? (
        open && <div className="lx-popover right-0 top-full z-20 mt-1 w-64 rounded-[var(--radius-control)] p-1" style={{ position: 'absolute' }}>{list}</div>
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title={t('exMenu')} closeLabel={t('exMenuClose')} fit>
          {list}
        </Sheet>
      )}
    </div>
  );
}
