import { create } from 'zustand';

// Globale Blätter (docs/neubau/architektur.md §2.6): ein Stapel (höchstens zwei, z. B.
// profile → settings). Der Rahmen setzt den Hintergrund `inert`, sobald irgendein Blatt offen ist.
// Die Altschnittstelle (`useSettingsSheet`, `openSettings`, `closeSettings`) bleibt.

export type SheetId = 'claude' | 'profile' | 'settings' | 'word' | 'add' | `x:${string}`;

export type SheetEntry = { id: SheetId; params?: unknown };

const SHEET_MAX = 2;

export const useSheets = create<{ stack: readonly SheetEntry[] }>(() => ({ stack: [] }));

/** Legt ein Blatt auf den Stapel. Ist es schon offen, wandert es nach oben (neue Parameter). */
export function openSheet(id: SheetId, params?: unknown): void {
  useSheets.setState((s) => {
    const rest = s.stack.filter((e) => e.id !== id);
    return { stack: [...rest, { id, params }].slice(-SHEET_MAX) };
  });
}

/** Schließt das oberste Blatt (oder gezielt `id`). */
export function closeSheet(id?: SheetId): void {
  useSheets.setState((s) => {
    if (!s.stack.length) return s;
    if (id === undefined) return { stack: s.stack.slice(0, -1) };
    if (!s.stack.some((e) => e.id === id)) return s;
    return { stack: s.stack.filter((e) => e.id !== id) };
  });
}

export const isSheetOpen = (stack: readonly SheetEntry[], id: SheetId): boolean => stack.some((e) => e.id === id);

// Altschnittstelle: das Zahnrad öffnet die Einstellungen (UX-Beratung Nr. 2/11).
export function useSettingsSheet<T>(select: (s: { open: boolean }) => T): T {
  return useSheets((s) => select({ open: isSheetOpen(s.stack, 'settings') }));
}

export const openSettings = (): void => openSheet('settings');
export const closeSettings = (): void => closeSheet('settings');
