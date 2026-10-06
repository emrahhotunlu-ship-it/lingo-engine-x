import { useSyncExternalStore } from 'react';
import { INPUT_KEY, TOUCH_QUERY, WIDE_QUERY, inputProfile, listeners, media, type InputProfile } from './inputCore';

// Hooks zum Eingabeprofil (Lernplattform 2.0 §4.1). Die Logik steht in `inputCore.ts` (ohne React).
export { getInputPref, setInputPref, inputProfile, needsInlineCheck, getKeyboardProbe, measureKeyboard, recordKeyboardProbe, INPUT_KEY } from './inputCore';
export type { InputProfile, InputPref, KeyboardProbe } from './inputCore';

function subscribeMedia(q: string): (cb: () => void) => () => void {
  return (cb) => {
    listeners.add(cb);
    const mq = media(q);
    mq?.addEventListener('change', cb);
    const onStorage = (e: StorageEvent): void => {
      if (e.key === INPUT_KEY || e.key === null) cb();
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(cb);
      mq?.removeEventListener('change', cb);
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  };
}

const subscribeProfile = subscribeMedia(TOUCH_QUERY);
const subscribeWide = subscribeMedia(WIDE_QUERY);

/** Reagiert auf eine Änderung der Einstellung und der Medienabfrage. Eine Runde liest es genau einmal beim Start. */
export function useInputProfile(): InputProfile {
  return useSyncExternalStore(subscribeProfile, inputProfile, () => 'keys');
}

const wide = (): boolean => !!media(WIDE_QUERY)?.matches;

/** Breite Fläche (≥ 1.024 px). */
export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, wide, () => false);
}

/** Geteilte Fläche: Übung links, Regel rechts (nur Tastatur und breit, §5.1). */
export function useSplitLayout(): boolean {
  const profile = useInputProfile();
  const w = useWide();
  return profile === 'keys' && w;
}

/** Wahr, solange die Medienabfrage passt (reagiert auf Größenänderung). Nur für Breiten, nie für den Zeiger. */
export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = media(q);
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    () => !!media(q)?.matches,
    () => false,
  );
}

