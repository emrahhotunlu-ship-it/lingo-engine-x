import { useEffect, useState } from 'react';

// Bildschirmtastatur am iPhone (A7.4, H5): Safari verkleinert beim Tippen nur den sichtbaren
// Bereich (`visualViewport`), nicht das Layout. Gemeinsam für alle Gespräche:
// - `useKeyboardInset()`: Abstand der Tastatur zum unteren Rand (fest unten sitzende Eingabe, Rollenspiel);
// - `useKeyboardBox(active)`: Höhe und Lage des sichtbaren Bereichs (Vollbild-Blatt, Begleiter).
// Ohne `visualViewport` (ältere Browser) greift nichts ein.

/** Abstand der Bildschirmtastatur zum unteren Rand (0, wenn keine offen ist). */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export type KeyboardBox = { height: number; top: number } | null;

/** Sichtbarer Bereich, solange die Tastatur wirklich Platz nimmt (sonst `null`, es gilt 100dvh). */
export function useKeyboardBox(active: boolean): KeyboardBox {
  const [box, setBox] = useState<KeyboardBox>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height > 80;
      setBox(covered ? { height: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setBox(null);
    };
  }, [active]);
  return box;
}
