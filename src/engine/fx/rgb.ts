// Relaunch P1 S1-TOK: Die Tokens sind OKLCH. Chromium liefert sie in getComputedStyle und im Canvas-`fillStyle` als `oklch(…)`
// zurück, Code mit eigener Deckkraft (Hintergrundlicht, Wörterhimmel) braucht aber Zahlen. Ein 1×1-Canvas rechnet jede gültige
// CSS-Farbe in sRGB um. Ohne Canvas (z. B. jsdom) bleibt die Farbe unverändert.

let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  if (typeof document === 'undefined') return (ctx = null);
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  ctx = c.getContext('2d', { willReadFrequently: true });
  return ctx;
}

/** Beliebige CSS-Farbe → `rgb(r, g, b)` (deckend). Ohne Canvas oder bei leerer Eingabe: die Eingabe selbst. */
export function cssRgb(color: string): string {
  const c = context();
  if (!c || !color) return color;
  c.clearRect(0, 0, 1, 1);
  c.fillStyle = '#000000';
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return `rgb(${d[0] ?? 0}, ${d[1] ?? 0}, ${d[2] ?? 0})`;
}
