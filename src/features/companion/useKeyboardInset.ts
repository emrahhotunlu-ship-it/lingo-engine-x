import { useEffect, useState } from 'react';

// Bildschirmtastatur am iPhone (Phase 5 §8.1, H5, A7.4): Safari verkleinert beim Tippen nur den
// sichtbaren Bereich (`visualViewport`), nicht das Layout. Das Vollbild-Blatt nimmt deshalb die
// Höhe von `visualViewport.height` an und folgt `offsetTop` – so bleibt die Eingabezeile über
// der Tastatur. Ohne `visualViewport` (ältere Browser) wird nichts gesetzt.

export type KeyboardBox = { height: number; top: number } | null;

export function useKeyboardInset(active: boolean): KeyboardBox {
  const [box, setBox] = useState<KeyboardBox>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      // Nur eingreifen, wenn die Tastatur wirklich Platz nimmt (sonst gilt 100dvh).
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
