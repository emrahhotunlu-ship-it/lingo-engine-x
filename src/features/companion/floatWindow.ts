import { KEY_PREFIX, local } from '../../platform/storage';

// Schwebefenster des Begleiters (Rückmeldung Emrah: frei beweglich, Größe änderbar, Aufgabe dahinter
// bleibt bedienbar). Reine Geometrie ohne DOM – unit-getestet – plus Merken je Gerät über die
// Plattform-Schicht (nie localStorage direkt).

export type Rect = { x: number; y: number; w: number; h: number };
/** Sichtbarer Bereich (Fenster bzw. bei offener Tastatur der Teil darüber). */
export type Vp = { left: number; top: number; width: number; height: number };
export type WinMode = 'float' | 'full';
export type SavedWin = { rect: Rect; mode: WinMode };
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_W = 340;
export const MIN_H = 240;
/** Unter dieser Fensterbreite gilt „Handy“. */
export const MOBILE_MAX = 768;
/** Höhe der Pille, wenn nur die Kopfleiste bleibt. */
export const PILL_H = 56;
const PILL_MAX_W = 340;
const PILL_MIN_W = 220;
const GAP = 8;

export const WIN_KEY = `${KEY_PREFIX}companion-win`;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const isMobileWidth = (width: number): boolean => width < MOBILE_MAX;

/** Kürzeste Seite unter dieser Größe: Handy, auch im Querformat (844 × 390). */
export const PHONE_SHORT_SIDE = 500;

/** Handy: schmal (< 768) ODER kurze Seite < 500 (Querformat) ODER Touch-Gerät mit kurzer Seite < 768. */
export function isPhone(width: number, height: number, coarse = false): boolean {
  const short = Math.min(width, height);
  return width < MOBILE_MAX || short < PHONE_SHORT_SIDE || (coarse && short < MOBILE_MAX);
}

/** Bereich ohne die feste Aktionsleiste und die untere Reiterleiste (`reserve` = gemessene Höhe, 0 = nichts zu schonen). */
export function homeVp(vp: Vp, reserve: number): Vp {
  const r = Math.max(0, Math.min(Math.round(reserve), Math.max(0, vp.height - MIN_H)));
  return r ? { ...vp, height: vp.height - r } : vp;
}

/** Bei offener Tastatur oder niedriger Höhe: Kopf-Zeilen ausblenden, der Verlauf bekommt den Platz. */
export const LOW_H = 420;
export const isLow = (h: number, keyboard: boolean): boolean => keyboard || h < LOW_H;

/** Beim Tippen am Handy: das Fenster wächst bis zur vollen Höhe über der Tastatur. */
export function keyboardRect(r: Rect, vp: Vp): Rect {
  return clampRect({ x: r.x, y: vp.top + GAP / 2, w: r.w, h: vp.height - GAP }, vp);
}

/** Pille bewegen (Höhe fest, kein Mindestmaß des Fensters). */
export function movePill(start: Rect, dx: number, dy: number, vp: Vp): Rect {
  return {
    ...start,
    x: clamp(Math.round(start.x + dx), vp.left, vp.left + vp.width - start.w),
    y: clamp(Math.round(start.y + dy), vp.top, vp.top + vp.height - start.h),
  };
}

/** Handy: die Pille parkt oben rechts unter den Kopf-Symbolen der Seite (`top` = Unterkante dieser Symbole). */
export function parkedPill(vp: Vp, top: number): Rect {
  const w = Math.min(PILL_MAX_W, Math.max(Math.min(PILL_MIN_W, vp.width), vp.width - 2 * GAP));
  const h = Math.min(PILL_H, vp.height);
  return { x: vp.left + vp.width - w - GAP, y: clamp(top, vp.top, vp.top + vp.height - h), w, h };
}

/** Rechteck in den sichtbaren Bereich zwingen: Mindestgröße (soweit der Bereich es zulässt) bis Bereichsgröße, Lage komplett innen. */
export function clampRect(r: Rect, vp: Vp): Rect {
  const minW = Math.min(MIN_W, vp.width);
  const minH = Math.min(MIN_H, vp.height);
  const w = clamp(Math.round(Number.isFinite(r.w) ? r.w : MIN_W), minW, vp.width);
  const h = clamp(Math.round(Number.isFinite(r.h) ? r.h : MIN_H), minH, vp.height);
  const x = clamp(Math.round(Number.isFinite(r.x) ? r.x : vp.left), vp.left, vp.left + vp.width - w);
  const y = clamp(Math.round(Number.isFinite(r.y) ? r.y : vp.top), vp.top, vp.top + vp.height - h);
  return { x, y, w, h };
}

/** Standardlage: Handy = unteres Drittel mit ~60 % Höhe; Desktop = unten rechts. Die Aufgabe oben bleibt sichtbar. */
export function defaultRect(vp: Vp, mobile: boolean = isMobileWidth(vp.width)): Rect {
  if (mobile && vp.width > vp.height) {
    // Handy im Querformat: schmales Fenster rechts über die ganze Höhe, die Aufgabe links bleibt sichtbar.
    const w = Math.min(440, Math.round(vp.width * 0.5));
    return clampRect({ x: vp.left + vp.width - w - GAP, y: vp.top + GAP, w, h: vp.height - 2 * GAP }, vp);
  }
  if (mobile) {
    const h = Math.round(vp.height * 0.68);
    return clampRect({ x: vp.left + GAP, y: vp.top + vp.height - h - GAP, w: vp.width - 2 * GAP, h }, vp);
  }
  const w = Math.min(440, vp.width - 32);
  const h = Math.min(620, Math.round(vp.height * 0.72));
  return clampRect({ x: vp.left + vp.width - w - 20, y: vp.top + vp.height - h - 20, w, h }, vp);
}

/** Vollbild: Handy ganze Fläche, Desktop zentriert wie das frühere große Fenster. */
export function fullRect(vp: Vp, mobile: boolean = isMobileWidth(vp.width)): Rect {
  if (mobile) return { x: vp.left, y: vp.top, w: vp.width, h: vp.height };
  const w = Math.min(896, Math.round(vp.width * 0.92));
  const h = Math.min(960, Math.round(vp.height * 0.88));
  return { x: vp.left + Math.round((vp.width - w) / 2), y: vp.top + Math.round((vp.height - h) / 2), w, h };
}

/** Nur die Kopfleiste bleibt: eine Pille, die am unteren Rand des Fensters sitzt. */
export function pillRect(r: Rect, vp: Vp): Rect {
  const w = clamp(Math.min(r.w, PILL_MAX_W), Math.min(PILL_MIN_W, vp.width), vp.width);
  const h = Math.min(PILL_H, vp.height);
  const x = clamp(r.x, vp.left, vp.left + vp.width - w);
  const y = clamp(r.y + r.h - h, vp.top, vp.top + vp.height - h);
  return { x, y, w, h };
}

export function moveRect(start: Rect, dx: number, dy: number, vp: Vp): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, vp);
}

/** Größe ändern: bewegte Kanten folgen dem Finger, bleiben im Bereich und lassen die Mindestgröße stehen. */
export function resizeRect(handle: Handle, start: Rect, dx: number, dy: number, vp: Vp): Rect {
  const minW = Math.min(MIN_W, vp.width);
  const minH = Math.min(MIN_H, vp.height);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle.includes('w')) left = clamp(left + dx, vp.left, right - minW);
  if (handle.includes('e')) right = clamp(right + dx, left + minW, vp.left + vp.width);
  if (handle.includes('n')) top = clamp(top + dy, vp.top, bottom - minH);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + minH, vp.top + vp.height);
  return clampRect({ x: left, y: top, w: right - left, h: bottom - top }, vp);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Gemerkte Lage prüfen (kaputte oder fremde Daten → `null`). */
export function parseSaved(raw: unknown): SavedWin | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const r = o.rect as Record<string, unknown> | undefined;
  if (!r || !num(r.x) || !num(r.y) || !num(r.w) || !num(r.h)) return null;
  if (r.w <= 0 || r.h <= 0) return null;
  return { rect: { x: r.x, y: r.y, w: r.w, h: r.h }, mode: o.mode === 'full' ? 'full' : 'float' };
}

export function loadWin(): SavedWin | null {
  return parseSaved(local.getJson<unknown>(WIN_KEY));
}

export function saveWin(w: SavedWin): void {
  local.set(WIN_KEY, JSON.stringify({ rect: w.rect, mode: w.mode }));
}
