// lx:pen-shot – Kennung für scripts/check-platform.mjs: nur dieses nachgeladene Stück darf fetch() enthalten (die Bibliothek
// html-to-image liest damit Bilder und Schriften der Seite selbst, nur eigene Dateien; Schriften lassen wir aus).
// Stift-Werkzeug (Emrah 09.11.2026): Bild der markierten Stelle, im Browser gezeichnet, ohne Server.
import { toCanvas } from 'html-to-image';

export const PEN_SHOT_MARK = 'lx:pen-shot';

export type Box = { x: number; y: number; w: number; h: number };

const UI_SEL = '[data-lx-pen-ui]';
const MAX_W = 1000;
const MAX_CHARS = 170_000;
const PAD = 24;

const webkit = (): boolean => /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

/** Kleinster Vorfahr, der die Markierung umschließt und genug Umfeld zeigt (sonst sieht man nur ein Wort). */
function pickRoot(start: Element | null, box: Box): HTMLElement {
  let el: Element | null = start;
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    const contains = r.left <= box.x + 2 && r.top <= box.y + 2 && r.right >= box.x + box.w - 2 && r.bottom >= box.y + box.h - 2;
    if (contains && r.width >= Math.min(340, window.innerWidth * 0.8) && r.height >= 180) return el as HTMLElement;
    el = el.parentElement;
  }
  return document.body;
}

function bg(): string {
  const c = getComputedStyle(document.body).backgroundColor;
  return c && c !== 'rgba(0, 0, 0, 0)' ? c : getComputedStyle(document.documentElement).backgroundColor || '#141614';
}

/**
 * Zeichnet die Umgebung der Markierung `box` (Bildschirmkoordinaten) als JPEG (data-URL) mit rotem Rahmen um die Stelle.
 * `start` = angetipptes Element oder das Element in der Mitte des Rahmens.
 */
export async function shoot(start: Element | null, box: Box): Promise<string> {
  const root = pickRoot(start, box);
  const rb = root.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const opts = {
    pixelRatio: ratio,
    skipFonts: true,
    backgroundColor: bg(),
    filter: (n: Node) => !(n instanceof Element && n.closest(UI_SEL)),
  };
  // Safari zeichnet beim ersten Mal oft leer (bekannt bei html-to-image): einmal vorwärmen.
  if (webkit()) await toCanvas(root, opts);
  const full = await toCanvas(root, opts);
  // Ausschnitt: höchstens etwa eine Bildschirmhöhe rund um die Markierung, innerhalb des gezeichneten Elements.
  const vh = window.innerHeight;
  const cx0 = Math.max(rb.left, Math.min(box.x - PAD, rb.right));
  const cx1 = Math.min(rb.right, Math.max(box.x + box.w + PAD, cx0 + 1));
  let cy0 = Math.max(rb.top, box.y - PAD);
  let cy1 = Math.min(rb.bottom, box.y + box.h + PAD);
  const want = Math.min(rb.height, Math.max(cy1 - cy0, vh * 0.9));
  const grow = want - (cy1 - cy0);
  if (grow > 0) {
    cy0 = Math.max(rb.top, cy0 - grow / 2);
    cy1 = Math.min(rb.bottom, cy0 + want);
    cy0 = Math.max(rb.top, cy1 - want);
  }
  // Breite: ganze Breite des Elements (Zusammenhang), die Markierung bleibt durch den Rahmen erkennbar.
  const sx0 = Math.min(cx0, rb.left);
  const sx1 = Math.max(cx1, rb.right);
  const sw = sx1 - sx0;
  const sh = cy1 - cy0;
  const scale = Math.min(1, MAX_W / sw);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  const k = full.width / rb.width;
  ctx.drawImage(full, (sx0 - rb.left) * k, (cy0 - rb.top) * k, sw * k, sh * k, 0, 0, out.width, out.height);
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 3;
  ctx.strokeRect((box.x - sx0) * scale - 2, (box.y - cy0) * scale - 2, box.w * scale + 4, box.h * scale + 4);
  for (let q = 0.72; q >= 0.3; q -= 0.1) {
    const url = out.toDataURL('image/jpeg', q);
    if (url.length <= MAX_CHARS) return url;
  }
  // Immer noch zu groß: kleiner zeichnen.
  const half = document.createElement('canvas');
  half.width = Math.round(out.width / 2);
  half.height = Math.round(out.height / 2);
  half.getContext('2d')?.drawImage(out, 0, 0, half.width, half.height);
  return half.toDataURL('image/jpeg', 0.5);
}

/** Markiert das Stück für die Plattform-Prüfung (die Kennung muss im gebauten Stück stehen). */
export const penShotMark = (): string => PEN_SHOT_MARK;
