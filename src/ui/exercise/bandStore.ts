import { create } from 'zustand';
import type { ShellMenuId } from './ExerciseShell';

// Zustand des Übungsrahmens mit Band (Relaunch Stufe 1, P3 S1-BAND, stufe1-plan §6.4): EIN Ort für das, was über
// der laufenden Übung offen sein kann – Mehr-Blatt, Menü „…“ und Tastenübersicht. Daraus liest die Esc-Reihenfolge der
// Übungsebene (`app/shell/Player.tsx`): Tastenübersicht → Mehr-Blatt → Menü → Kontextspalte, nie die Übung.
// Außerdem meldet das Gerüst hier seine Menüpunkte an (Menü „…“ oben in der Leiste zeigt sie), und die Leiste meldet,
// dass sie ein Menü zeigt (`hosts`): ohne Leiste bleibt das Menü im Band.

export type BandState = {
  /** Menüpunkte der laufenden Aufgabe (`ShellFeedback.menu`). */
  items: Partial<Record<ShellMenuId, () => void>>;
  /** „Warum diese Aufgabe?“ – öffnet die Zweckzeile unter dem Status; `null` = Aufgabe ohne Zweckangabe. */
  why: (() => void) | null;
  /** Zahl der eingehängten Menüs „…“ in Übungsleisten. */
  hosts: number;
  /** Zahl der eingehängten Übungsgerüste: nur dann gelten Esc-Schutz und Tastenübersicht der Übungsebene. */
  shells: number;
  menuOpen: boolean;
  moreOpen: boolean;
  keysOpen: boolean;
};

export const useBand = create<BandState>(() => ({ items: {}, why: null, hosts: 0, shells: 0, menuOpen: false, moreOpen: false, keysOpen: false }));

export const setBandMenuOpen = (open: boolean): void => useBand.setState({ menuOpen: open });
export const setBandMoreOpen = (open: boolean): void => useBand.setState({ moreOpen: open });
export const setBandKeysOpen = (open: boolean): void => useBand.setState({ keysOpen: open });

/** Esc in der Übungsebene: schließt das oberste eigene Element. `true`, wenn etwas geschlossen wurde. */
export function closeTopBandLayer(): boolean {
  const s = useBand.getState();
  if (s.keysOpen) {
    useBand.setState({ keysOpen: false });
    return true;
  }
  if (s.moreOpen) {
    useBand.setState({ moreOpen: false });
    return true;
  }
  if (s.menuOpen) {
    useBand.setState({ menuOpen: false });
    return true;
  }
  return false;
}

/** Fokus in einem Textfeld: dann greifen nur ⏎ und Esc, keine Buchstaben- oder Zeichenkürzel. */
export function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(type);
}
