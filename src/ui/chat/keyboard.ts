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

// ------------------------------------------------------------------ Lücke und Prüfen-Knopf (Kap. 4.1, H5)

export type Span = { top: number; bottom: number };

/** Nimmt die Tastatur so viel Platz, dass eingegriffen werden muss? (wie `useKeyboardBox`) */
export const keyboardCovers = (innerHeight: number, vvHeight: number): boolean => innerHeight - vvHeight > 80;

/**
 * Um wie viel muss die Seite rollen, damit alle Spannen (Lücke, Prüfen-Knopf) im sichtbaren Bereich
 * `view` liegen? Positiv = nach unten rollen. Passt nicht alles hinein, bleibt der Anfang (die Lücke)
 * sichtbar. Koordinaten wie `getBoundingClientRect` (Layout-Viewport), `view` aus `visualViewport`.
 */
export function keepVisibleDelta(spans: readonly Span[], view: { top: number; height: number }, margin = 12): number {
  if (!spans.length) return 0;
  const top = Math.min(...spans.map((s) => s.top));
  const bottom = Math.max(...spans.map((s) => s.bottom));
  const viewTop = view.top + margin;
  const viewBottom = view.top + view.height - margin;
  if (bottom - top > viewBottom - viewTop) return Math.round(top - viewTop);
  if (bottom > viewBottom) return Math.round(bottom - viewBottom);
  if (top < viewTop) return Math.round(top - viewTop);
  return 0;
}

/** Nächster Vorfahr der Lücke, der den Prüfen-Knopf enthält (Trainer, Grammatik, Übungen). */
export function checkButtonNear(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  for (let k = 0; k < 10 && cur; k++) {
    const btn = cur.querySelector<HTMLElement>('[data-testid="check"]');
    if (btn) return btn;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Bildschirmtastatur am iPhone: Solange das Eingabefeld der Lücke den Fokus hat und die Tastatur
 * den unteren Teil verdeckt, rollt die Seite so, dass Lücke und Prüfen-Knopf sichtbar bleiben
 * (dieselbe `visualViewport`-Grundlage wie `useKeyboardBox`). Ohne `visualViewport` greift nichts ein.
 */
export function useKeepGapVisible(getInput: () => HTMLElement | null, getGap: () => HTMLElement | null): void {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    let timer: number | null = null;
    const keep = () => {
      const input = getInput();
      const gap = getGap();
      if (!input || !gap || document.activeElement !== input) return;
      if (!keyboardCovers(window.innerHeight, vv.height)) return;
      const spans: Span[] = [gap.getBoundingClientRect()];
      // Steht die feste Aktionsleiste (sie folgt der Tastatur selbst), zählt nur der Bereich darüber; sonst der Prüfen-Knopf im Inhalt.
      const bar = document.querySelector<HTMLElement>('[data-testid="actionbar"]');
      const btn = bar ? null : checkButtonNear(gap);
      if (btn) spans.push(btn.getBoundingClientRect());
      const d = keepVisibleDelta(spans, { top: vv.offsetTop, height: vv.height - (bar ? bar.offsetHeight : 0) });
      if (Math.abs(d) > 1) window.scrollBy({ top: d });
    };
    const later = () => {
      if (timer !== null) window.clearTimeout(timer);
      // Safari meldet die endgültige Höhe erst nach der Tastatur-Animation.
      timer = window.setTimeout(keep, 120);
    };
    vv.addEventListener('resize', later);
    const input = getInput();
    input?.addEventListener('focus', later);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      vv.removeEventListener('resize', later);
      input?.removeEventListener('focus', later);
    };
  }, [getInput, getGap]);
}
