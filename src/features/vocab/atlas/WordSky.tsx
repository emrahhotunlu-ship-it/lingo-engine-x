import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AtlasEntry } from '../../../domain/atlas/atlas';
import { SKY_RING_RANK, VTEST_BAND, rankRadius, skyCounts, skyGrid, skyHit, skyLayout, type SkyTone, type SkyVeil } from '../../../domain/atlas/sky';
import type { UnitState } from '../../../domain/metrics/definitions';
import { useFxLevel } from '../../../engine/fx/level';
import { formatDate, useT, type MessageKey } from '../../../i18n';
import { Button } from '../../../ui/Button';

// Wort-Himmel (Lernplattform 3.0 §6.3, P59; Erlebnis-Engine §5.5) im Atlas: alle Atlas-Wörter als Punkte auf einer Sonnenblumen-Spirale,
// Radius nach Häufigkeitsrang. Zwei ehrliche Ebenen: der Schleier „geschätzt bekannt“ aus dem letzten Wortschatztest (≤ 90 Tage) und helle
// Sterne nur für Wörter mit Karte (Fest · Sicher · Lernt · Neu). Sternzahl = Atlas-Wörter mit Karte = dieselbe Zahl wie die Atlas-Zeilen.
//
// Technik: ein Canvas 2D, Pixeldichte ≤ 2, Punkte nach Farbe gebündelt (je Farbe ein `fill()`), gezeichnet nur bei Zustandswechsel
// (Größe, Zoom, Auswahl, Modus, Daten). Zoom (Doppeltipp ×3) zeichnet mit `setTransform` neu, die Puffergröße bleibt. Beim Öffnen wächst
// der Himmel in 600 ms von innen nach außen (nur Stufe Voll/Ruhig), danach läuft keine Schleife mehr. Antippen: Raster-Suche in 16-px-Zellen.

export type WordSkyProps = {
  entries: readonly AtlasEntry[];
  /** Ton je Eintrag (gleiche Reihenfolge wie `entries`). */
  tones: readonly SkyTone[];
  veil: SkyVeil | null;
  onAdd: (e: AtlasEntry) => void;
};

const STATE_KEY: Record<UnitState, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', safe: 'exStateSafe', firm: 'exStateFirm' };
const INTRO_MS = 600;
const ZOOM = 3;
const DOUBLE_MS = 320;

type Palette = { dot: string; dotA: number; violet: string; ok: string; ring: string; veil: string; fg: string; light: boolean };

function readPalette(el: Element, ctx: CanvasRenderingContext2D): Palette {
  const cs = getComputedStyle(el);
  const norm = (name: string, fallback: string): string => {
    const v = cs.getPropertyValue(name).trim();
    ctx.fillStyle = fallback;
    if (v) ctx.fillStyle = v;
    return String(ctx.fillStyle);
  };
  const light = document.documentElement.dataset.theme === 'light';
  return {
    dot: norm('--lx-fg', '#f1f3f8'),
    dotA: light ? 0.26 : 0.2,
    violet: norm('--lx-ch-cards', '#a78bfa'),
    ok: norm('--lx-ok', '#10b981'),
    ring: norm('--lx-gold-text', '#f4c56a'),
    veil: norm('--lx-ch-read', '#38bdf8'),
    fg: norm('--lx-fg', '#f1f3f8'),
    light,
  };
}

/** `#rrggbb` oder `rgba(…)` (vom Canvas normiert) mit neuer Deckkraft. */
function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (m) return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
  const r = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(color);
  return r ? `rgba(${r[1]!.trim()}, ${r[2]!.trim()}, ${r[3]!.trim()}, ${a})` : color;
}

type View = { z: number; fx: number; fy: number };

export function WordSky({ entries, tones, veil, onAdd }: WordSkyProps) {
  const { t, lang, num } = useT();
  const level = useFxLevel();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [view, setView] = useState<View>({ z: 1, fx: 0, fy: 0 });
  const [sel, setSel] = useState<number | null>(null);
  const [theme, setTheme] = useState(0);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const introDone = useRef(level === 'off');

  const layout = useMemo(() => skyLayout(entries), [entries]);
  const counts = useMemo(() => skyCounts(entries, tones), [entries, tones]);

  // Größe: quadratisch, so breit wie der Platz (höchstens 480 px).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = (): void => setSize(Math.round(Math.min(480, el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Moduswechsel (Dunkel/Gedämpft/Hell, Farbthema): neu zeichnen.
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
    return () => mo.disconnect();
  }, []);

  // Bildschirmlage der Punkte beim aktuellen Zoom (für die Antipp-Suche).
  const R = size / 2 - 6;
  const screen = useMemo(() => {
    const n = entries.length;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const fx = view.z === 1 ? size / 2 : view.fx;
    const fy = view.z === 1 ? size / 2 : view.fy;
    for (let i = 0; i < n; i++) {
      px[i] = (size / 2 + layout.xs[i]! * R - fx) * view.z + size / 2;
      py[i] = (size / 2 + layout.ys[i]! * R - fy) * view.z + size / 2;
    }
    return { px, py, grid: skyGrid(px, py) };
  }, [entries.length, layout, size, view, R]);

  // Zeichnen: bei jedem Zustandswechsel genau einmal (beim ersten Öffnen 600 ms Einlauf, danach nichts mehr).
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || size <= 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1, 2);
    const W = Math.round(size * dpr);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== W) cv.height = W;
    const pal = readPalette(cv, ctx);
    const S = size;
    const fx = view.z === 1 ? S / 2 : view.fx;
    const fy = view.z === 1 ? S / 2 : view.fy;
    const z = view.z;

    const draw = (p: number): void => {
      const t0 = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (S / 2 - fx * z), dpr * (S / 2 - fy * z));
      const cx = S / 2;
      const cy = S / 2;
      const ease = 1 - Math.pow(1 - p, 3);
      const reach = ease * 1.0001;

      // Schleier: weicher Verlauf, je Band (1.000 Ränge) so dicht wie der Anteil erkannter Wörter.
      if (veil) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        const A = pal.light ? 0.2 : 0.26;
        g.addColorStop(0, withAlpha(pal.veil, (veil.bands[0] ?? 0) * A));
        veil.bands.forEach((b, k) => g.addColorStop(Math.min(1, rankRadius((k + 0.5) * VTEST_BAND, layout.rMax)), withAlpha(pal.veil, b * A)));
        g.addColorStop(Math.min(1, rankRadius(10 * VTEST_BAND, layout.rMax) + 0.06), withAlpha(pal.veil, 0));
        g.addColorStop(1, withAlpha(pal.veil, 0));
        ctx.globalAlpha = ease;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, R * reach, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Ring bei Rang 5.000.
      const ringR = rankRadius(SKY_RING_RANK, layout.rMax) * R;
      if (ringR <= R * reach) {
        ctx.strokeStyle = withAlpha(pal.ring, 0.8);
        ctx.lineWidth = 1.25 / z;
        ctx.setLineDash([3 / z, 4 / z]);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const n = entries.length;
      const xs = layout.xs;
      const ys = layout.ys;
      const rho = layout.rho;
      // Grundpunkte (ohne Karte): ein Pfad aus kleinen Quadraten.
      const d = 1.5 / z;
      ctx.fillStyle = withAlpha(pal.dot, pal.dotA);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (tones[i] !== 'none' || rho[i]! > reach) continue;
        ctx.rect(cx + xs[i]! * R - d / 2, cy + ys[i]! * R - d / 2, d, d);
      }
      ctx.fill();

      // Sterne, nach Farbe gebündelt (Neu, Lernt, Sicher, Fest); Fest mit Glanz.
      const star = (tone: SkyTone, color: string, r: number): void => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (tones[i] !== tone || rho[i]! > reach) continue;
          const x = cx + xs[i]! * R;
          const y = cy + ys[i]! * R;
          ctx.moveTo(x + r / z, y);
          ctx.arc(x, y, r / z, 0, Math.PI * 2);
        }
        ctx.fill();
      };
      if (!pal.light) ctx.globalCompositeOperation = 'lighter';
      star('firm', withAlpha(pal.ok, pal.light ? 0.16 : 0.22), 6);
      ctx.globalCompositeOperation = 'source-over';
      star('new', withAlpha(pal.violet, 0.45), 1.7);
      star('learning', withAlpha(pal.violet, 0.75), 2);
      star('safe', withAlpha(pal.ok, 0.75), 2.2);
      star('firm', pal.ok, 2.5);
      if (!pal.light) star('firm', withAlpha(pal.fg, 0.85), 1);

      // Auswahl.
      if (sel !== null && sel < n) {
        ctx.strokeStyle = pal.fg;
        ctx.lineWidth = 1.5 / z;
        ctx.beginPath();
        ctx.arc(cx + xs[sel]! * R, cy + ys[sel]! * R, 7 / z, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      cv.dataset.drawMs = (performance.now() - t0).toFixed(1);
    };

    if (introDone.current || level === 'off') {
      introDone.current = true;
      draw(1);
      cv.dataset.drawn = 'true';
      return;
    }
    // Einlauf: 600 ms von innen nach außen, dann still (keine Dauerschleife).
    let raf = 0;
    const start = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - start) / INTRO_MS);
      draw(p);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        introDone.current = true;
        cv.dataset.drawn = 'true';
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [size, view, sel, theme, tones, veil, entries.length, layout, level, R]);

  const onPointerUp = (ev: React.PointerEvent<HTMLCanvasElement>): void => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const now = ev.timeStamp;
    const prev = lastTap.current;
    if (prev && now - prev.t < DOUBLE_MS && Math.hypot(prev.x - x, prev.y - y) < 28) {
      lastTap.current = null;
      toggleZoom(x, y);
      return;
    }
    lastTap.current = { t: now, x, y };
    const hit = skyHit(screen.grid, screen.px, screen.py, x, y, (i) => tones[i] !== 'none');
    setSel(hit);
  };

  // Zoom: Weltpunkt unter dem Finger in die Mitte, ×3; noch einmal = ganzer Himmel.
  const toggleZoom = (x: number, y: number): void => {
    setView((v) => {
      if (v.z !== 1) return { z: 1, fx: 0, fy: 0 };
      const wx = size / 2 + (x - size / 2);
      const wy = size / 2 + (y - size / 2);
      const lim = size / 2 - size / (2 * ZOOM);
      const c = (q: number) => Math.min(size / 2 + lim, Math.max(size / 2 - lim, q));
      return { z: ZOOM, fx: c(wx), fy: c(wy) };
    });
  };
  const zoomButton = (): void => {
    if (view.z !== 1) setView({ z: 1, fx: 0, fy: 0 });
    else if (sel !== null) toggleZoom(screen.px[sel]!, screen.py[sel]!);
    else toggleZoom(size / 2, size / 2);
  };

  const e = sel !== null ? entries[sel] : undefined;
  const tone = sel !== null ? (tones[sel] ?? 'none') : 'none';
  const pct = counts.words ? Math.round((counts.inRing / counts.words) * 100) : 0;
  const aria = t('eeSkyAria', { words: num(counts.words), stars: num(counts.stars), firm: num(counts.firm), ring: num(counts.inRing) });

  return (
    <section className="lx-sky flex flex-col gap-3" aria-labelledby="ee-sky-title" data-testid="word-sky" data-stars={counts.stars} data-words={counts.words} data-firm={counts.firm} data-veil={veil ? 'true' : 'false'} data-zoom={view.z}>
      <header className="flex flex-col gap-1">
        <h2 id="ee-sky-title" className="text-lg font-semibold">
          {t('eeSkyTitle')}
        </h2>
        <p className="text-sm text-muted">{t('eeSkyLead')}</p>
      </header>
      <div ref={wrap} className="lx-sky-stage">
        <canvas
          ref={canvas}
          className="lx-sky-canvas"
          style={{ width: size || undefined, height: size || undefined }}
          role="img"
          aria-label={aria}
          onPointerUp={onPointerUp}
          data-testid="word-sky-canvas"
        />
        <button type="button" className="lx-sky-zoom" onClick={zoomButton} aria-pressed={view.z !== 1} data-testid="word-sky-zoom">
          {view.z !== 1 ? t('eeSkyZoomOut') : t('eeSkyZoomIn')}
        </button>
      </div>
      <p className="sr-only" data-testid="word-sky-summary">
        {aria}
      </p>
      {e ? (
        <div className="lx-sky-pick" role="status" data-testid="word-sky-pick" data-word={e.w} data-tone={tone}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold" lang="en">
                {e.w}
              </span>
              <span className="lx-tnum text-xs text-muted">{t('eeSkyRank', { r: num(e.r) })}</span>
            </span>
            <span className="text-sm text-muted">{e.d}</span>
            <span className="text-xs font-semibold" data-tone={tone}>
              {tone === 'none' ? t('eeSkyNoCard') : t(STATE_KEY[tone])}
            </span>
          </div>
          {tone === 'none' && (
            <Button variant="ghost" icon="plus" onClick={() => onAdd(e)} data-testid="word-sky-add">
              {t('atAdd')}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-subtle">{t('eeSkyHint')}</p>
      )}
      {/* UX-Prüfung W3: jede Zahl mit ihrer Bedeutung – die Legende zählt deine Karten im Himmel, nicht die Atlas-Wörter. */}
      <p className="lx-tnum m-0 text-xs text-muted" data-testid="word-sky-cards" data-n={counts.stars}>
        {t('eeSkyCards', { n: num(counts.stars) })}
      </p>
      <ul className="lx-sky-legend" aria-label={t('eeSkyLegendAria')} data-testid="word-sky-legend">
        <li data-tone="firm">
          <i aria-hidden="true" />
          {t('exStateFirm')} <b className="lx-tnum">{num(counts.firm)}</b>
        </li>
        <li data-tone="safe">
          <i aria-hidden="true" />
          {t('exStateSafe')} <b className="lx-tnum">{num(counts.safe)}</b>
        </li>
        <li data-tone="learning">
          <i aria-hidden="true" />
          {t('exStateLearning')} <b className="lx-tnum">{num(counts.learning)}</b>
        </li>
        <li data-tone="new">
          <i aria-hidden="true" />
          {t('exStateNew')} <b className="lx-tnum">{num(counts.fresh)}</b>
        </li>
      </ul>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <p className="lx-sky-ringnote m-0">{t('eeSkyRing')}</p>
        <p className="m-0" data-testid="word-sky-ring" data-in-ring={counts.inRing}>
          {t('eeSkyRingSub', { ring: num(counts.inRing), words: num(counts.words), pct })}
        </p>
        <p className="m-0" data-testid="word-sky-veil">
          {veil ? t('eeSkyVeil', { d: formatDate(lang, veil.t) }) : t('eeSkyNoVeil')}
        </p>
      </div>
    </section>
  );
}
