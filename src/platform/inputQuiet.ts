// Eingabe-Ruhe (Emrah 24.11.2026 am iPhone: „Eintippen, Tastatur aufklappen, zuklappen … alles echt laggy“): Hintergrundarbeit (Vorab-Rechnen
// der Stimme, Wörter-Pflege) wartet, solange Emrah antippt, tippt oder die Tastatur auf- bzw. zugeht. Eine Stelle für beide, damit die
// Ruhe-Regel nur einmal gilt. Gestartet wird im Leerlauf des Browsers (Safari ohne `requestIdleCallback`: kurzer Wecker).

/** So lange nach dem letzten Antippen, Tastendruck bzw. der letzten Tastatur-Bewegung wartet Hintergrundarbeit. */
export const INPUT_QUIET_MS = 1_200;
let inputAt = Number.NEGATIVE_INFINITY;
const clockMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Antippen, Tippen, Fokuswechsel eines Felds oder Tastatur-Bewegung (sichtbarer Bereich ändert die Größe). */
export function noteInputActivity(): void {
  inputAt = clockMs();
}

/** Millisekunden bis zur Eingabe-Ruhe (0 = ruhig). */
export const inputQuietLeft = (): number => Math.max(0, inputAt + INPUT_QUIET_MS - clockMs());

/** Nur für Tests: Ruhe-Zustand zurücksetzen. */
export function resetInputQuiet(): void {
  inputAt = Number.NEGATIVE_INFINITY;
}

type IdleWin = { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
export function whenIdle(fn: () => void): void {
  const w = typeof window !== 'undefined' ? (window as unknown as IdleWin) : null;
  if (w && typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 1_000 });
  else setTimeout(fn, 50);
}

/**
 * Kurze Pause für Hintergrundarbeit in Portionen: `ms` warten, danach bis zur Eingabe-Ruhe (ein Wecker je Tipp-Phase, kein Abfragen), dann
 * im Leerlauf des Browsers weiter.
 */
export function quietPause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const go = (wait: number): void => {
      setTimeout(() => {
        const left = inputQuietLeft();
        if (left > 0) go(left + 30);
        else whenIdle(resolve);
      }, wait);
    };
    go(ms);
  });
}

if (typeof document !== 'undefined') {
  const onInput = (ev: Event): void => {
    if (ev.type === 'focusin' || ev.type === 'focusout') {
      const el = ev.target as HTMLElement | null;
      if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    }
    noteInputActivity();
  };
  for (const type of ['pointerdown', 'keydown', 'beforeinput', 'compositionupdate', 'focusin', 'focusout']) document.addEventListener(type, onInput, { capture: true, passive: true });
  if (typeof window !== 'undefined') window.visualViewport?.addEventListener('resize', noteInputActivity, { passive: true });
}
