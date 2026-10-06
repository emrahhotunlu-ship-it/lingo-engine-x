import { useEffect, useRef, useState } from 'react';
import { AUTO_NEXT_MS } from './autoAdvance';

/**
 * Zeitgeber für „automatisch weiter“. Ein Tippen oder eine Taste irgendwo (außer im Weiter-Knopf) hält an;
 * für dasselbe Ergebnis startet er nicht neu. `resetKey` wechselt je Ergebnis.
 * Liefert, ob der Balken läuft, und `fire` für den Knopf (feuert höchstens einmal je Ergebnis).
 */
export function useAutoAdvance({ active, onNext, nextTestId, resetKey }: { active: boolean; onNext: () => void; nextTestId: string; resetKey: unknown }): { running: boolean; fire: () => void } {
  const [stopped, setStopped] = useState<{ key: unknown } | null>(null);
  const fired = useRef<unknown>(undefined);
  const cb = useRef(onNext);
  useEffect(() => {
    cb.current = onNext;
  });
  const halted = stopped !== null && stopped.key === resetKey;
  const running = active && !halted;
  useEffect(() => {
    if (!running) return;
    const stop = (e: Event): void => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest(`[data-testid="${nextTestId}"]`)) return;
      setStopped({ key: resetKey });
    };
    const id = window.setTimeout(() => {
      if (fired.current === resetKey) return;
      fired.current = resetKey;
      cb.current();
    }, AUTO_NEXT_MS);
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', stop, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', stop, true);
    };
  }, [running, nextTestId, resetKey]);
  // Der Knopf feuert immer (ein zweites Tippen darf nie verschluckt werden); er sperrt nur den Zeitgeber.
  const fire = (): void => {
    fired.current = resetKey;
    cb.current();
  };
  return { running, fire };
}
