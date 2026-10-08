import { create } from 'zustand';
import { markSeen, nextLevelUp, parseSeen, type LevelKind } from '../../domain/moments/detect';
import { KEY_PREFIX, local } from '../../platform/storage';

// Aufstieg (Lernplattform 3.0 P60, EE M8): höchstens eine Aufstiegskarte gleichzeitig. Echte Meilensteine erscheinen je Gerät genau einmal
// (`lx:moments-seen`, gemerkt schon beim Zeigen: ein Neuladen zeigt sie nicht noch einmal). Die Vorschau in den Einstellungen („Momente ansehen“)
// nutzt dieselbe Karte mit `demo`, merkt nichts und schreibt nichts.

export const SEEN_KEY = `${KEY_PREFIX}moments-seen`;

export type LevelShow = { id: string; level: LevelKind; value?: number; demo?: boolean };

type State = { current: LevelShow | null; show: (s: LevelShow) => void; close: () => void };

export const useLevelUp = create<State>((set) => ({
  current: null,
  show: (s) => set({ current: s }),
  close: () => set({ current: null }),
}));

/** Gemerkte Aufstiege dieses Geräts. */
export const seenLevelUps = (): string[] => parseSeen(local.get(SEEN_KEY));

/** Zeigt den ersten noch nicht gesehenen Aufstieg aus `ids` (echte Meilensteine) und merkt ihn sofort. `true`, wenn einer gezeigt wird. */
export function offerLevelUp(ids: readonly string[], value?: number): boolean {
  if (useLevelUp.getState().current) return false;
  const next = nextLevelUp(ids, seenLevelUps());
  if (!next) return false;
  local.set(SEEN_KEY, JSON.stringify(markSeen(seenLevelUps(), next.id)));
  useLevelUp.getState().show({ id: next.id, level: next.level, ...(value !== undefined ? { value } : {}) });
  return true;
}
