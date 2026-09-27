import { useEffect, useRef } from 'react';

// Tastatur: Enter prüft bzw. geht weiter, Ziffern wählen, Esc schließt (Architektur-Entwurf §6.6).
// Tasten im unsichtbaren Eingabefeld der Lücke behandelt die Lücke selbst (außer Esc).

export type HotkeyMap = { enter?(): void; digit?(n: number): void; escape?(): void };

export function useHotkeys(map: HotkeyMap, isOwnInput: (el: EventTarget | null) => boolean): void {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const m = ref.current;
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"]')) return;
        m.escape?.();
        return;
      }
      // Ein modaler Dialog (z. B. der Claude-Begleiter, Phase 5) liegt darüber: keine Übungstasten.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (isOwnInput(t)) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Enter' && m.enter) {
        if (t?.tagName === 'BUTTON' && !t.dataset.grade) return;
        e.preventDefault();
        m.enter();
        return;
      }
      if (/^[1-9]$/.test(e.key) && m.digit) {
        e.preventDefault();
        m.digit(Number(e.key));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOwnInput]);
}
