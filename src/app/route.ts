import { create } from 'zustand';

// Navigation des Trainers: wenige Bildschirme, kein Router nötig. Blätter (Übersetzer, Claude
// fragen, Einstellungen, Wort) liegen über dem aktuellen Bildschirm.

export type Route = { name: 'home' } | { name: 'plan' } | { name: 'input' } | { name: 'placement' } | { name: 'check' } | { name: 'blitz' } | { name: 'session'; extra?: boolean };
export type SheetName = 'settings' | 'translate' | 'ask' | null;

type RouteState = {
  route: Route;
  sheet: SheetName;
  /** Wort-Blatt (Kennung oder freier Text). */
  word: string | null;
  /** Bezug für „Claude fragen": was gerade auf dem Bildschirm steht. */
  context: string;
  askPreset: string;
};

export const useRoute = create<RouteState>(() => ({ route: { name: 'home' }, sheet: null, word: null, context: '', askPreset: '' }));

export function go(route: Route): void {
  useRoute.setState({ route });
  window.scrollTo({ top: 0 });
}

export function openSheet(sheet: Exclude<SheetName, null>, askPreset = ''): void {
  useRoute.setState({ sheet, askPreset });
}

export function closeSheet(): void {
  useRoute.setState({ sheet: null });
}

export function openWord(word: string | null): void {
  useRoute.setState({ word });
}

export function setAskContext(context: string): void {
  if (useRoute.getState().context !== context) useRoute.setState({ context });
}
