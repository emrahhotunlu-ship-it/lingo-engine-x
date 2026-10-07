// Partikel-Engine der Erlebnis-Engine (EE §5.2 `FxLayer`, Design-Lead 07.10.2026): Canvas 2D, EIN requestAnimationFrame-Loop, der nur läuft,
// solange Teilchen leben; Objekt-Pool (höchstens MAX Teilchen, kein Müll je Bild); Pixeldichte auf 2 begrenzt; die Ebene wird 1 s nach dem
// letzten Teilchen entfernt. Nur `transform`-freie Malerei auf einer festen, durchklickbaren Ebene – keine Layoutarbeit, kein DOM je Teilchen.
// Wird per `import()` erst beim ersten Effekt geladen (Stufe „Voll“); ohne Canvas (Tests, alte Geräte) passiert nichts.

export type Shape = 'dot' | 'spark' | 'flake';

export type BurstOpts = {
  /** Anzahl (wird auf den freien Pool begrenzt). */
  n: number;
  colors: readonly string[];
  /** Startgeschwindigkeit in px/s (min, max). */
  speed: readonly [number, number];
  /** Winkelbereich in Grad (0 = rechts, −90 = oben). */
  angle?: readonly [number, number];
  /** Schwerkraft px/s². */
  gravity?: number;
  /** Lebensdauer ms (min, max). */
  life?: readonly [number, number];
  /** Größe px (min, max). */
  size?: readonly [number, number];
  shape?: Shape;
  /** Startverzögerung je Teilchen bis zu so vielen ms (gestaffelt). */
  stagger?: number;
};

type P = { alive: boolean; x: number; y: number; vx: number; vy: number; g: number; t: number; life: number; size: number; color: string; shape: Shape; rot: number; vr: number; delay: number };

export const MAX = 180;
const pool: P[] = Array.from({ length: MAX }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, life: 1, size: 2, color: '#fff', shape: 'dot', rot: 0, vr: 0, delay: 0 }));

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let dpr = 1;
/** Letzte Bildabstände (ms) für die Messung im Moment (EE §9.4). */
export const frames: number[] = [];

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function ensureCanvas(): boolean {
  if (typeof document === 'undefined') return false;
  if (canvas && ctx) return true;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (!g) return false;
  c.setAttribute('aria-hidden', 'true');
  c.dataset.testid = 'fx-layer';
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:70';
  document.body.appendChild(c);
  canvas = c;
  ctx = g;
  resize();
  return true;
}

function resize(): void {
  if (!canvas || !ctx) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function teardown(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  canvas?.remove();
  canvas = null;
  ctx = null;
}

function alive(): number {
  let n = 0;
  for (const p of pool) if (p.alive) n++;
  return n;
}

function step(now: number): void {
  const g = ctx;
  if (!g || !canvas) return;
  const dt = last ? Math.min(48, now - last) : 16;
  if (last) {
    frames.push(now - last);
    if (frames.length > 120) frames.shift();
  }
  last = now;
  g.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  let live = 0;
  for (const p of pool) {
    if (!p.alive) continue;
    if (p.delay > 0) {
      p.delay -= dt;
      live++;
      continue;
    }
    p.t += dt;
    if (p.t >= p.life) {
      p.alive = false;
      continue;
    }
    live++;
    const s = dt / 1000;
    p.vy += p.g * s;
    p.vx *= 0.985;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.rot += p.vr * s;
    const k = p.t / p.life;
    const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    g.globalAlpha = Math.max(0, a);
    g.fillStyle = p.color;
    if (p.shape === 'flake') {
      // Schmales Plättchen, das sich dreht (hochwertiges „Konfetti“: wenige, ruhige Teile, keine Bonbonfarben).
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
      g.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
      g.restore();
    } else if (p.shape === 'spark') {
      // Kurzer Lichtstrich in Flugrichtung.
      const len = Math.min(14, Math.hypot(p.vx, p.vy) * 0.03 + p.size);
      const ang = Math.atan2(p.vy, p.vx);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(ang);
      g.fillRect(-len, -p.size / 2, len, p.size);
      g.restore();
    } else {
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  if (live > 0) {
    raf = requestAnimationFrame(step);
    return;
  }
  raf = 0;
  last = 0;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (alive() === 0) teardown();
  }, 1000);
}

/** Teilchen ab Punkt (x, y) in Fensterkoordinaten. Liefert die tatsächlich gestartete Anzahl. */
export function burst(x: number, y: number, o: BurstOpts): number {
  if (!ensureCanvas()) return 0;
  if (idleTimer) clearTimeout(idleTimer);
  let started = 0;
  const [a0, a1] = o.angle ?? [-180, 180];
  for (const p of pool) {
    if (started >= o.n) break;
    if (p.alive) continue;
    const ang = (rnd(a0, a1) * Math.PI) / 180;
    const v = rnd(o.speed[0], o.speed[1]);
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(ang) * v;
    p.vy = Math.sin(ang) * v;
    p.g = o.gravity ?? 0;
    p.t = 0;
    p.life = rnd(...(o.life ?? [450, 700]));
    p.size = rnd(...(o.size ?? [1.5, 3]));
    p.color = o.colors[started % o.colors.length] ?? '#fff';
    p.shape = o.shape ?? 'dot';
    p.rot = rnd(0, Math.PI * 2);
    p.vr = rnd(-8, 8);
    p.delay = o.stagger ? rnd(0, o.stagger) : 0;
    started++;
  }
  if (!raf && started > 0) {
    last = 0;
    raf = requestAnimationFrame(step);
  }
  return started;
}

/** Mitte eines Elements in Fensterkoordinaten (oder null, wenn es nicht sichtbar ist). */
export function centerOf(el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Nur für Tests: alles anhalten und aufräumen. */
export function resetParticles(): void {
  for (const p of pool) p.alive = false;
  frames.length = 0;
  teardown();
}

export const liveCount = alive;
