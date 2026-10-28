import { useEffect, useRef, type RefObject } from 'react';
import { closeCompanion, useCompanion } from '../../features/companion/store';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { CONTEXT_PORTAL_ID, closeContext, openContext, useContextColumn, useContextPresentation } from './contextColumn';

// Kontextspalte des Rahmens (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §6.2/§6.5, Kap. 15):
// - ab 1024 px eine Spalte rechts neben der Bühne (`aside#lx-context`); ab 1280 px immer reserviert, darunter nur, wenn etwas offen ist;
// - unter 1024 px öffnet derselbe Inhalt ein Blatt, das sich am Inhalt bemisst (der Satz bleibt darüber sichtbar).
// Claude dockt ab 1024 px in diese Spalte: das Begleiter-Fenster legt sich per CSS genau auf die Spalte
// (`html[data-lx-dock]`, Maße aus `--lx-dock-*`), so verdeckt es nie die Bühne. Der Chat selbst bleibt unverändert.

/** Begleiter ↔ Spalte: offenes Schwebefenster ab 1024 px belegt die Spalte als Inhalt `claude`. */
function useClaudeDock(column: boolean): boolean {
  const { t } = useT();
  const docked = useCompanion((s) => s.open && s.winMode === 'float' && !s.minimized) && column;
  const title = t('shClaude');
  useEffect(() => {
    const cur = useContextColumn.getState().current;
    if (docked) {
      if (cur?.kind !== 'claude') {
        openContext({
          kind: 'claude',
          node: null,
          title,
          onClose: () => {
            if (useCompanion.getState().open) closeCompanion();
          },
        });
      }
      return;
    }
    // Begleiter zu, verkleinert oder schmaler Bildschirm: Spalte freigeben, ohne den Begleiter zu schließen.
    if (cur?.kind === 'claude') useContextColumn.setState({ current: null });
  }, [docked, title]);
  return docked;
}

/** Maße der Spalte als CSS-Variablen am Wurzelelement (für das angedockte Begleiter-Fenster). */
function useDockMetrics(el: RefObject<HTMLElement | null>, docked: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    const node = el.current;
    if (!docked || !node) {
      root.removeAttribute('data-lx-dock');
      return;
    }
    const measure = () => {
      const r = node.getBoundingClientRect();
      root.style.setProperty('--lx-dock-left', `${Math.round(r.left)}px`);
      // Bis an den rechten Fensterrand (die Spalte selbst endet vor dem Seitenrand).
      root.style.setProperty('--lx-dock-w', `${Math.round(root.clientWidth - r.left)}px`);
    };
    measure();
    root.setAttribute('data-lx-dock', 'claude');
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      root.removeAttribute('data-lx-dock');
    };
  }, [el, docked]);
}

/** Die Spalte (immer im Rahmen; CSS blendet sie unter 1024 px aus). */
export function ContextColumn() {
  const { t } = useT();
  const ref = useRef<HTMLElement>(null);
  const presentation = useContextPresentation();
  const current = useContextColumn((s) => s.current);
  const docked = useClaudeDock(presentation === 'column');
  useDockMetrics(ref, docked);
  const show = presentation === 'column' && current !== null && current.kind !== 'claude';
  return (
    <aside ref={ref} id={CONTEXT_PORTAL_ID} className="lx-ctx" aria-label={t('shContext')} data-testid="context-column" data-kind={current?.kind}>
      {show ? (
        <div className="lx-ctx-body" data-testid={`context-${current.kind}`}>
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold">{current.title}</h2>
            <IconButton icon="close" label={t('close')} onClick={() => closeContext()} data-testid="context-close" />
          </div>
          {current.node}
        </div>
      ) : current === null ? (
        <p className="lx-ctx-empty text-sm text-subtle" data-testid="context-empty">
          {t('shContextEmpty')}
        </p>
      ) : null}
    </aside>
  );
}

/** Kleinste Höhe des Begleiter-Blatts, wenn es dem Aufgabensatz ausweicht (px). */
const MIN_SHEET_PX = 280;

/**
 * Unter 1024 px in einer Übung: das Begleiter-Blatt beginnt unter dem Aufgabensatz (Plan §6.2 „der Satz bleibt darüber sichtbar“, Kap. 15).
 * Das Fenster selbst bleibt unverändert; liegt seine eigene Lage über dem Satz, rückt es per CSS (`html[data-lx-sheet-guard]`,
 * `--lx-sheet-top/-h`) nach unten, die Unterkante bleibt. Mit offener Tastatur (`data-low`) gilt die Lage des Fensters.
 */
export function SentenceGuard(): null {
  const presentation = useContextPresentation();
  const active = useCompanion((s) => s.open && s.winMode === 'float' && !s.minimized) && presentation === 'sheet';
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.removeAttribute('data-lx-sheet-guard');
    if (!active) {
      clear();
      return;
    }
    let raf = 0;
    let watched: HTMLElement | null = null;
    // Das Fenster selbst: seine Lage folgt erst nach dem Messen der Leisten (CompanionOverlay) – jede Änderung neu messen.
    const own = new MutationObserver(() => schedule());
    const measure = () => {
      raf = 0;
      const win = document.querySelector<HTMLElement>('[data-testid="companion"]');
      if (win !== watched) {
        own.disconnect();
        watched = win;
        if (win) own.observe(win, { attributes: true, attributeFilter: ['style'] });
      }
      const anchor = document.querySelector<HTMLElement>('[data-testid="exercise"] [data-slot="prompt"]') ?? document.querySelector<HTMLElement>('[data-testid="task"]');
      if (!win || !anchor || win.hasAttribute('data-low') || win.hasAttribute('data-minimized') || win.getAttribute('data-mode') !== 'float') {
        clear();
        return;
      }
      const top = parseFloat(win.style.top);
      const left = parseFloat(win.style.left);
      const width = parseFloat(win.style.width);
      const height = parseFloat(win.style.height);
      const a = anchor.getBoundingClientRect();
      if (![top, left, width, height].every(Number.isFinite) || a.right <= left || a.left >= left + width) {
        clear();
        return;
      }
      const bottom = top + height;
      const want = Math.round(Math.min(a.bottom + 12, bottom - MIN_SHEET_PX));
      if (want <= top) {
        clear();
        return;
      }
      root.style.setProperty('--lx-sheet-top', `${want}px`);
      root.style.setProperty('--lx-sheet-h', `${Math.round(bottom - want)}px`);
      root.setAttribute('data-lx-sheet-guard', '');
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    schedule();
    // Neue Karte, Fenster bewegt/verkleinert, Tastatur: neu messen (höchstens einmal je Bild).
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-low', 'data-minimized', 'data-mode', 'data-card'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pointerup', schedule);
    return () => {
      mo.disconnect();
      own.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('pointerup', schedule);
      if (raf) cancelAnimationFrame(raf);
      clear();
    };
  }, [active]);
  return null;
}

/** Unter 1024 px: derselbe Inhalt als Blatt (Claude selbst bleibt das Begleiter-Blatt). */
export function ContextSheet() {
  const { t } = useT();
  const presentation = useContextPresentation();
  const current = useContextColumn((s) => s.current);
  const open = presentation === 'sheet' && current !== null && current.kind !== 'claude';
  return (
    <Sheet open={open} onClose={() => closeContext()} title={current?.title ?? ''} closeLabel={t('close')} fit>
      {current?.node}
    </Sheet>
  );
}
