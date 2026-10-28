import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { useMediaQuery } from '../../platform/input';
import { Sheet } from '../Sheet';
import type { ShellMenuId } from './ExerciseShell';
import { Slot } from '../../app/slots';
import { setBandMenuOpen, useBand } from './bandStore';

// Menü „…“ (§4.3; Relaunch Stufe 1 P3, stufe1-plan §6.4): am Handy ein Blatt von unten, ab 768 px ein kleines Menü.
// Seit dem Band steht es OBEN in der Übungsleiste (`TopMenu`): „Handy oben nur Schließen und Balken, alles andere hinter …“ –
// dort Claude, Übersetzer, „Warum diese Aufgabe?“, die Punkte der Aufgabe, Einstellungen, „Pause, später weiter“ und „Problem melden“.
// Ohne Übungsleiste (Einzelkarten) bleibt das alte Menü der Aufgabe rechts im Band (`ExerciseMenu`).
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

/** Ein Menüpunkt; `testId` bleibt die Kennung des früheren Knopfs (z. B. `open-companion`). */
export type MenuEntry = { id: string; label: string; onClick: () => void; testId: string };

function Dots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

/** Punkte der Aufgabe in fester Reihenfolge. */
export function taskEntries(items: Partial<Record<ShellMenuId, () => void>>, t: (k: MessageKey) => string, skip: readonly ShellMenuId[] = []): MenuEntry[] {
  return ORDER.flatMap((k) => {
    const fn = items[k];
    return fn && !skip.includes(k) ? [{ id: k, label: t(LABEL[k]), onClick: fn, testId: `menu-${k}` }] : [];
  });
}

/** Gemeinsame Darstellung: Knopf „…“, darunter Gruppen mit Trennlinie (Popover ab 768 px, sonst Blatt). */
function MenuView({ groups, open, setOpen, slot }: { groups: MenuEntry[][]; open: boolean; setOpen: (open: boolean) => void; slot: boolean }) {
  const { t } = useT();
  const wide = useMediaQuery('(min-width: 768px)');
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const shown = groups.filter((g) => g.length > 0);
  // Laptop-Menü: Esc und Klick daneben schließen. Esc schließt NUR das Menü (das oberste Element), nie die Runde dahinter:
  // `preventDefault` + `stopPropagation`, damit die Übungstasten (`useHotkeys`, hört auf `window`) es nicht mehr sehen.
  useEffect(() => {
    if (!open || !wide) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('[data-testid="exercise-menu"]')?.focus();
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
  }, [open, wide, setOpen]);
  // Beim Öffnen am Laptop: Fokus auf den ersten Punkt (Tastaturbedienung).
  useEffect(() => {
    if (!open || !wide) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open, wide]);
  if (!shown.length) return null;
  const list = (
    <ul className="lx-menu-list flex flex-col" role={wide ? 'menu' : undefined} id={id} data-testid="exercise-menu-list">
      {shown.map((g, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <li role="separator" className="lx-menu-sep" aria-hidden="true" />}
          {g.map((e) => (
            <li key={e.id} role={wide ? 'none' : undefined}>
              <button
                type="button"
                role={wide ? 'menuitem' : undefined}
                className="lx-t-body flex min-h-11 w-full items-center rounded-[var(--radius-inline)] px-3 text-left hover:bg-surface"
                data-testid={e.testId}
                data-menu={e.id}
                onClick={() => {
                  setOpen(false);
                  e.onClick();
                }}
              >
                {e.label}
              </button>
            </li>
          ))}
        </Fragment>
      ))}
      {slot && <Slot name="exercise.menu" />}
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
        onClick={() => setOpen(!open)}
        data-testid="exercise-menu"
      >
        <Dots />
      </button>
      {wide ? (
        open && <div className="lx-popover lx-menu-pop right-0 top-full z-40 mt-1 w-64 rounded-[var(--radius-control)] p-1" style={{ position: 'absolute' }}>{list}</div>
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title={t('exMenu')} closeLabel={t('exMenuClose')} fit>
          {list}
        </Sheet>
      )}
    </div>
  );
}

/** Menü der Aufgabe im Band – nur, wenn keine Übungsleiste ein Menü „…“ zeigt (Einzelkarten ohne Leiste). */
export function ExerciseMenu({ items, onOpenChange }: { items: Partial<Record<ShellMenuId, () => void>>; onOpenChange?: ((open: boolean) => void) | undefined }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    onOpenChange?.(true);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);
  return <MenuView groups={[taskEntries(items, t)]} open={open} setOpen={setOpen} slot />;
}

/**
 * Menü „…“ oben in der Übungsleiste. `lead`: Claude und Übersetzer (vom Aufrufer, weil sie an der KI hängen),
 * `tail`: Einstellungen; `onPause`: „Pause, später weiter“ = dasselbe wie ✕ (Fortsetz-Stand sichern, ruhig bestätigen).
 */
export function TopMenu({ lead, tail, onPause }: { lead: MenuEntry[]; tail: MenuEntry[]; onPause: () => void }) {
  const { t } = useT();
  const items = useBand((s) => s.items);
  const why = useBand((s) => s.why);
  const open = useBand((s) => s.menuOpen);
  useEffect(() => {
    useBand.setState((s) => ({ hosts: s.hosts + 1 }));
    return () => useBand.setState((s) => ({ hosts: Math.max(0, s.hosts - 1), menuOpen: false }));
  }, []);
  const task: MenuEntry[] = [...(why ? [{ id: 'whyTask', label: t('bandMenuWhy'), onClick: why, testId: 'menu-whyTask' }] : []), ...taskEntries(items, t, ['report'])];
  const report = items.report ? [{ id: 'report', label: t(LABEL.report), onClick: items.report, testId: 'menu-report' }] : [];
  const pause: MenuEntry = { id: 'pause', label: t('bandMenuPause'), onClick: onPause, testId: 'menu-pause' };
  return <MenuView groups={[lead, task, [...tail, pause], report]} open={open} setOpen={setBandMenuOpen} slot />;
}
