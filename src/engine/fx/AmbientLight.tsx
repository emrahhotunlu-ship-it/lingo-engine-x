import { useEffect, useRef } from 'react';
import { subscribe } from './events';
import { useFxLevel } from './level';

// Lichtfeld (Lernplattform 3.0 P57, Erlebnis-Engine §5.1): drei weiche Lichtflecken hinter allen Reitern – Bereichsfarbe oben (wie die freigegebene
// Vorschau: eine ruhige Lichtquelle oben mittig), Cyan rechts und ein dunkler Schattenfleck für Tiefe. Canvas 2D in 1/6 der Auflösung, per CSS gestreckt
// (das weiche Hochskalieren ist der Weichzeichner), 24 Bilder je Sekunde. Nach jedem Bildschirmwechsel oder Moment 12 s Bewegung auf Lissajous-Bahnen,
// danach Standbild ohne einen einzigen rAF-Aufruf. In Übungen gedimmt (50 %) und still; Stufe „Ruhig“/„Aus“, reduzierte Bewegung und verdeckter Tab:
// Standbild. Das Standbild ist deterministisch (Startphase aus dem Lerntag). Ersetzt den festen `body::before`-Verlauf (`html[data-ambient]`).

/** So lange bewegt sich das Licht nach einem Wechsel. */
export const ACTIVE_MS = 12_000;
export const FPS = 24;
export const SCALE = 6;

export type Blob = { x: number; y: number; r: number; a: number };

/** Kleine, stabile Zahl aus dem Lerntag (Startphase). */
export function phaseOf(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return ((h >>> 0) % 6283) / 1000;
}

/**
 * Lage der drei Flecken zur Zeit `t` (s) als Anteile von Breite/Höhe (rein, für Tests und das Standbild). Wege ≤ 12 % der Breite, Perioden 40–70 s.
 * `strength` = Deckkraft des Hauptflecks (dunkel 0,16 · gedämpft 0,12 · hell 0,10), `dim` = Faktor in Übungen.
 */
export function blobsAt(t: number, phase: number, strength: number, dim = 1): [Blob, Blob, Blob] {
  const w = (period: number, k = 0): number => Math.sin((2 * Math.PI * t) / period + phase + k);
  return [
    { x: 0.5 + 0.06 * w(52), y: -0.12 + 0.04 * w(41, 1.3), r: 0.95, a: strength * dim },
    { x: 0.86 + 0.05 * w(63, 2.1), y: 0.16 + 0.05 * w(47, 0.7), r: 0.6, a: strength * 0.45 * dim },
    { x: 0.18 + 0.05 * w(70, 4.2), y: 0.62 + 0.04 * w(44, 2.9), r: 0.7, a: 0.28 * dim },
  ];
}

type Colors = { field: string; cyan: string; shade: string; strength: number };

function readColors(probe: HTMLElement): Colors {
  const cs = (v: string): string => {
    probe.style.color = `var(${v})`;
    return getComputedStyle(probe).color;
  };
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--lx-field-strength').trim();
  const pct = Number.parseFloat(raw);
  return { field: cs('--lx-field'), cyan: cs('--lx-cyan'), shade: cs('--lx-bg'), strength: Number.isFinite(pct) ? pct / 100 : 0.12 };
}

/** `rgb(r, g, b)` → `rgba(r, g, b, a)`. */
const withAlpha = (rgb: string, a: number): string => {
  const m = /rgba?\(([^)]+)\)/.exec(rgb);
  if (!m || !m[1]) return `rgba(0,0,0,${a})`;
  const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
};

function mix(a: string, b: string, k: number): string {
  const p = (s: string): number[] => (/rgba?\(([^)]+)\)/.exec(s)?.[1] ?? '0,0,0').split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
  const x = p(a);
  const y = p(b);
  return `rgb(${[0, 1, 2].map((i) => Math.round((x[i] ?? 0) + ((y[i] ?? 0) - (x[i] ?? 0)) * k)).join(',')})`;
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, blobs: readonly Blob[], c: Colors, field: string): void {
  ctx.clearRect(0, 0, w, h);
  const cols = [field, c.cyan, c.shade];
  blobs.forEach((b, i) => {
    const x = b.x * w;
    const y = b.y * h;
    const r = Math.max(8, b.r * w);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = cols[i] ?? field;
    g.addColorStop(0, withAlpha(col, b.a));
    g.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

type Props = {
  /** Wechselt mit jedem Bildschirm (Reiter, Route, Übung): startet die 12 s Bewegung neu. */
  scene: string;
  /** In Übungen: gedimmt und still. */
  exercise: boolean;
  /** Lerntag für die Startphase. */
  day: string;
};

export function AmbientLight({ scene, exercise, day }: Props) {
  const level = useFxLevel();
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ambient = '';
    return () => {
      delete root.dataset.ambient;
    };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    const pr = probe.current;
    const ctx = cv?.getContext('2d') ?? null;
    if (!cv || !pr || !ctx) return;
    const phase = phaseOf(day);
    const moving = level === 'full' && !exercise;
    let colors = readColors(pr);
    let shownField = colors.field;
    let fromField = colors.field;
    let fieldAt = 0;
    let w = 0;
    let h = 0;
    let raf = 0;
    let started = 0;
    let lastDraw = 0;
    let t = 0;
    const size = (): void => {
      w = Math.max(1, Math.ceil(window.innerWidth / SCALE));
      h = Math.max(1, Math.ceil(window.innerHeight / SCALE));
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
    };
    const paint = (): void => {
      draw(ctx, w, h, blobsAt(t, phase, colors.strength, exercise ? 0.5 : 1), colors, shownField);
    };
    const frame = (now: number): void => {
      raf = 0;
      if (!started) started = now;
      const el = now - started;
      if (now - lastDraw >= 1000 / FPS - 2) {
        lastDraw = now;
        t += 1 / FPS;
        // Farbwechsel des Bereichs gleitet in 600 ms.
        const k = fieldAt ? Math.min(1, (now - fieldAt) / 600) : 1;
        shownField = k < 1 ? mix(fromField, colors.field, k) : colors.field;
        paint();
      }
      if (el < ACTIVE_MS && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = (): void => {
      if (!moving || document.hidden) {
        shownField = colors.field;
        paint();
        return;
      }
      started = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kick.current = start;
    size();
    paint();
    start();
    const onResize = (): void => {
      size();
      paint();
    };
    const obs = new MutationObserver(() => {
      const next = readColors(pr);
      if (next.field !== colors.field) {
        fromField = shownField;
        fieldAt = performance.now();
      }
      colors = next;
      if (!moving) shownField = colors.field;
      start();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-lx-tab', 'data-lx-area', 'class'] });
    const onVis = (): void => {
      if (!document.hidden) start();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    // Momente beleben das Licht ebenfalls für 12 s.
    const off = subscribe((e) => {
      if (e.k === 'moment') start();
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      obs.disconnect();
      off();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      kick.current = () => undefined;
    };
  }, [level, exercise, day]);

  useEffect(() => {
    kick.current();
  }, [scene]);

  return (
    <>
      <canvas ref={canvas} className="lx-ambient" aria-hidden="true" data-testid="ambient" data-exercise={exercise ? 'true' : undefined} />
      <span ref={probe} className="lx-ambient-probe" aria-hidden="true" />
    </>
  );
}
