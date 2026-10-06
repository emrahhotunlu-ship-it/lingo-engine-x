import { useSyncExternalStore } from 'react';
import { local } from './storage';

// Eingabeprofil (Lernplattform 2.0 §4.1): die EINE Stelle, die entscheidet, ob dieses Gerät mit dem
// Finger (`touch`) oder mit Tastatur und Maus (`keys`) bedient wird. Das Profil wählt nur die FORM einer
// Aufgabe beim Anzeigen und ist nie planwirksam: Tagesplan, Pflicht, Minuten und Serie hängen nicht davon
// ab (`removalAudit.test.ts`: `src/domain/**` und `features/today/store.ts` importieren diese Datei nie).
// Die Datei heißt bewusst nicht `device.ts` (bis W2 lag dort der alte Handy-Modus, der die Pflicht änderte).

export type InputProfile = 'touch' | 'keys';
export type InputPref = 'auto' | InputProfile;

declare global {
  interface Window {
    /** Testschalter: setzen nur E2E-Tests per `page.addInitScript` (`tests/e2e/input.ts`). */
    __LINGO_INPUT__?: InputProfile;
  }
}

/** Nur `localStorage` (Bequemlichkeit je Gerät), nie die Datenbank. */
export const INPUT_KEY = 'lx:input';

const TOUCH_QUERY = '(pointer: coarse) and (hover: none)';
const WIDE_QUERY = '(min-width: 1024px)';

const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((fn) => fn());

const media = (q: string): MediaQueryList | null => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null);

export function getInputPref(): InputPref {
  const v = local.get(INPUT_KEY);
  return v === 'touch' || v === 'keys' ? v : 'auto';
}

export function setInputPref(p: InputPref): void {
  if (p === 'auto') local.remove(INPUT_KEY);
  else local.set(INPUT_KEY, p);
  notify();
}

/** Reihenfolge: Einstellung `lx:input` > Testschalter `window.__LINGO_INPUT__` > Medienabfrage. */
export function inputProfile(): InputProfile {
  const pref = getInputPref();
  if (pref !== 'auto') return pref;
  const forced = typeof window === 'undefined' ? undefined : window.__LINGO_INPUT__;
  if (forced === 'touch' || forced === 'keys') return forced;
  return media(TOUCH_QUERY)?.matches ? 'touch' : 'keys';
}

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

// ---------------------------------------------------------------- Tastatur-Messung (§6, Diagnose)

export type KeyboardProbe = { iframe: boolean; innerHeight: number; viewportHeight: number | null; inset: number | null };

let probe: KeyboardProbe | null = null;

/** Ergebnis der einmaligen Messung beim ersten Fokus eines Textfelds (`null`, solange nichts gemessen wurde). */
export const getKeyboardProbe = (): KeyboardProbe | null => probe;

/**
 * Wahr, wenn die Messung zeigt, dass die Bildschirmtastatur den sichtbaren Bereich NICHT verkleinert
 * (Abstand 0 nach 400 ms, nur bei `touch`): Dann braucht die Übung einen Prüfen-Knopf direkt unter dem Feld.
 */
export function needsInlineCheck(): boolean {
  return inputProfile() === 'touch' && probe !== null && (probe.inset ?? 0) === 0;
}

export function recordKeyboardProbe(p: KeyboardProbe): void {
  probe = p;
  notify();
}

function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // Zugriff auf `top` verboten = eingebettet in einen fremden Rahmen
  }
}

/** Liest Rahmen und Sichtbereich; wird 400 ms nach dem ersten Fokus aufgerufen. */
export function measureKeyboard(): KeyboardProbe {
  const iframe = inFrame();
  const vv = window.visualViewport ?? null;
  return { iframe, innerHeight: window.innerHeight, viewportHeight: vv ? Math.round(vv.height) : null, inset: vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : null };
}
