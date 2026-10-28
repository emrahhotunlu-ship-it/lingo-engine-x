import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

// Kontextspalte (Relaunch Stufe 1, P2 S1-SHELL, docs/relaunch/stufe1-plan.md §3.2/§6.2/§6.3; Konzept 13.2/13.3).
// EINE Stelle für Claude, Wort-Details, Erklärungen und „Mehr“ neben der Bühne:
// - ab 1024 px als Spalte rechts neben der Bühne (Portal-Ziel `#lx-context`, gerendert vom Rahmen),
// - am Handy und unter 1024 px öffnet DERSELBE Store ein Blatt (der Satz bleibt darüber sichtbar).
// Kap. 15: Der Chat ist nie eine schmale Seitenleiste ohne Kontext und verdeckt nie die Bühne.
//
// Diese Datei ist nach dem ersten Zusammenführen EINGEFROREN (P3 und P7 bauen dagegen, Befund W8).
// Änderungen nur über die Hauptsitzung.

/** Art des Inhalts: bestimmt Symbol und Test-ID, nicht die Darstellung. */
export type ContextKind = 'claude' | 'word' | 'explain' | 'more';

/** Ein Inhalt der Kontextspalte (bzw. des Blatts unter 1024 px). */
export type ContextContent = {
  readonly kind: ContextKind;
  /** Inhalt; der Rahmen rendert ihn in Spalte oder Blatt. */
  readonly node: ReactNode;
  /** Überschrift (schon übersetzt). */
  readonly title: string;
  /** Wird genau einmal gerufen, wenn dieser Inhalt geschlossen oder durch einen anderen ersetzt wird. */
  readonly onClose?: () => void;
};

/** Id des Portal-Ziels der Spalte (der Rahmen legt das Element an). */
export const CONTEXT_PORTAL_ID = 'lx-context';

/** Ab dieser Breite (px) ist der Kontext eine Spalte neben der Bühne, darunter ein Blatt (Tabelle 6.2). */
export const CONTEXT_COLUMN_MIN_PX = 1024;

/** Darstellung des Kontexts bei einer Breite. */
export type ContextPresentation = 'column' | 'sheet';

export function contextPresentation(width: number): ContextPresentation {
  return width >= CONTEXT_COLUMN_MIN_PX ? 'column' : 'sheet';
}

type ContextState = { readonly current: ContextContent | null };

/** Store der Kontextspalte: genau ein Inhalt oder keiner. */
export const useContextColumn = create<ContextState>(() => ({ current: null }));

/** Öffnet einen Inhalt; ein offener anderer Inhalt wird ersetzt (sein `onClose` läuft). */
export function openContext(content: ContextContent): void {
  const prev = useContextColumn.getState().current;
  useContextColumn.setState({ current: content });
  if (prev && prev !== content) prev.onClose?.();
}

/**
 * Schließt den offenen Inhalt. Mit `kind` nur, wenn gerade ein Inhalt dieser Art offen ist.
 * @returns `true`, wenn etwas geschlossen wurde (für Esc-Reihenfolgen).
 */
export function closeContext(kind?: ContextKind): boolean {
  const prev = useContextColumn.getState().current;
  if (!prev) return false;
  if (kind !== undefined && prev.kind !== kind) return false;
  useContextColumn.setState({ current: null });
  prev.onClose?.();
  return true;
}

/** Der offene Inhalt (außerhalb von React). */
export function currentContext(): ContextContent | null {
  return useContextColumn.getState().current;
}

/** Das Portal-Ziel der Spalte, falls der Rahmen es gerade zeigt. */
export function contextPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(CONTEXT_PORTAL_ID);
}

const QUERY = `(min-width: ${CONTEXT_COLUMN_MIN_PX}px)`;

function subscribeWidth(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Aktuelle Darstellung (außerhalb von React); ohne Fenster „sheet“. */
export function currentPresentation(): ContextPresentation {
  if (typeof window === 'undefined') return 'sheet';
  if (typeof window.matchMedia === 'function') return window.matchMedia(QUERY).matches ? 'column' : 'sheet';
  return contextPresentation(window.innerWidth);
}

/** Darstellung als Hook: folgt der Fensterbreite (eine Medienabfrage, kein Resize-Lauschen). */
export function useContextPresentation(): ContextPresentation {
  return useSyncExternalStore(subscribeWidth, currentPresentation, () => 'sheet');
}
