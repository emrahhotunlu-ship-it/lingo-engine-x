import { getWriter } from '../../../data';
import { logError } from '../../../platform/diagnostics';

// Stift-Werkzeug: speichert eine Rückmeldung als `pen/<id>` (Schema `penSchema`, träge Sammlung). Claude Code liest sie dort.

export type PenKind = 'function' | 'design' | 'bug';

export type PenScreen = { tab: string | null; title: string | null; hash: string; vw: number; vh: number; dpr: number; ua: string; build: string };
export type PenTarget = { text: string | null; path: string | null; box: { x: number; y: number; w: number; h: number } };

const pad = (n: number) => String(n).padStart(2, '0');

/** Kennung `p-JJJJMMTT-HHMMSS-xxxx` (sortiert nach Zeit). */
export function penId(now = new Date(), rnd = Math.random()): string {
  const d = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `p-${d}-${Math.floor(rnd * 0xffff).toString(16).padStart(4, '0')}`;
}

/** Kurzer Pfad zum Element (Tag, Testkennung, Klasse), damit Claude Code die Stelle im Quelltext findet. */
export function elementPath(el: Element | null): string | null {
  const parts: string[] = [];
  let e: Element | null = el;
  while (e && e !== document.body && parts.length < 6) {
    const tid = e.getAttribute('data-testid');
    const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter((c) => c.startsWith('lx-'))[0] : undefined;
    parts.unshift(tid ? `${e.tagName.toLowerCase()}[data-testid=${tid}]` : cls ? `${e.tagName.toLowerCase()}.${cls}` : e.tagName.toLowerCase());
    if (tid) break;
    e = e.parentElement;
  }
  return parts.length ? parts.join(' > ') : null;
}

export function screenInfo(): PenScreen {
  const tab = document.querySelector('[aria-current="page"]')?.textContent?.trim() ?? null;
  const title = document.querySelector('[role="dialog"] h2, h1')?.textContent?.trim() ?? null;
  return {
    tab,
    title,
    hash: location.hash,
    vw: window.innerWidth,
    vh: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    ua: navigator.userAgent,
    build: typeof __LX_BUILD__ === 'string' ? __LX_BUILD__ : 'dev',
  };
}

export async function savePen(entry: { kind: PenKind; text: string; img: string; screen: PenScreen; target: PenTarget; tool: string }): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.set(`pen/${penId()}`, { t: Date.now(), ...entry, done: false });
    return true;
  } catch (err) {
    logError('pen:save', err);
    return false;
  }
}
