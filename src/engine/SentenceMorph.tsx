import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SPRINGS } from '../ui/motion';
import type { MorphWord } from './morphPlan';

// Bühne des Struktur-Films (Lernplattform 3.0 P61, Erlebnis-Engine §5.6): ein Satz, jedes Wort ein eigenes Element. Wechselt der Schritt,
// gleiten die Wörter mit gleicher Kennung per FLIP an ihren neuen Platz (nur `transform`, Compositor; 40 ms versetzt in Leserichtung),
// bewegte Wörter ziehen eine dünne Bahn, neue Wörter blenden ein, wegfallende blenden an ihrem alten Platz aus.
// Kein Layoutsprung: alle Sätze des Films liegen unsichtbar in derselben Rasterzelle und geben die Höhe vor.
// Ohne Bewegung (`animate = false`: Stufe „Aus“ oder reduzierte Bewegung) steht jeder Schritt sofort als Standbild da.
// Keine Dauerschleife: Web-Animations-API und CSS, kein requestAnimationFrame.

type Rect = { x: number; y: number; w: number; h: number; text: string };
type Ghost = { id: string; text: string; x: number; y: number };
type Trail = { id: string; d: string };

export type TapState = 'idle' | 'right' | 'wrong' | 'answer' | 'dim';

export type SentenceMorphProps = {
  words: readonly MorphWord[];
  /** Alle Sätze des Films (für die feste Höhe der Bühne). */
  sizers: readonly string[];
  animate: boolean;
  /** 1 = normal, 0,75 = langsamer. */
  speed?: number;
  /** Vorhersage: Wörter sind Knöpfe. */
  onTap?: ((index: number) => void) | undefined;
  tapState?: ((index: number) => TapState) | undefined;
  tapLabel?: ((word: string) => string) | undefined;
  className?: string;
};

/** Dauer der Wortbewegung (Feder `morph`, ≈ 450 ms) – bewusst ein Moment, keine Bedienbewegung. */
export const MORPH_MS = Math.round(SPRINGS.morph.visualDuration * 1000);
export const STAGGER_MS = 40;
const EASE = 'cubic-bezier(0.3, 1.18, 0.5, 1)';

function Words({ list, render }: { list: readonly string[]; render?: (w: string, i: number) => ReactNode }) {
  return (
    <>
      {list.map((w, i) => (
        <span key={i}>
          {i > 0 ? ' ' : ''}
          {render ? render(w, i) : <span className="lx-fm-w">{w}</span>}
        </span>
      ))}
    </>
  );
}

export function SentenceMorph({ words, sizers, animate, speed = 1, onTap, tapState, tapLabel, className }: SentenceMorphProps) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const last = useRef(new Map<string, Rect>());
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const now = new Map<string, Rect>();
    for (const w of words) {
      const el = els.current.get(w.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      now.set(w.id, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, text: w.text });
    }
    const prev = last.current;
    last.current = now;
    if (!animate || prev.size === 0 || typeof Element.prototype.animate !== 'function') return;

    const dur = MORPH_MS / speed;
    const moved: Trail[] = [];
    let k = 0;
    words.forEach((w) => {
      const el = els.current.get(w.id);
      const a = prev.get(w.id);
      const b = now.get(w.id);
      if (!el || !b) return;
      if (!a) {
        // Neues Wort: blendet nach den Bewegungen ein.
        el.animate([{ opacity: 0, transform: 'translateY(0.35em) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260 / speed, delay: dur * 0.45, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
        return;
      }
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: dur, delay: k * STAGGER_MS, easing: EASE, fill: 'backwards' });
        k++;
        if (Math.hypot(dx, dy) > 12) {
          const x0 = a.x + a.w / 2;
          const y0 = a.y + a.h * 0.92;
          const x1 = b.x + b.w / 2;
          const y1 = b.y + b.h * 0.92;
          const lift = Math.min(28, 10 + Math.abs(x1 - x0) * 0.12);
          moved.push({ id: w.id, d: `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${((x0 + x1) / 2).toFixed(1)} ${(Math.max(y0, y1) + lift).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}` });
        }
      }
      if (a.text !== w.text) {
        // Gleiches Wort, neue Form (hire → hired): kurz aufblenden.
        el.animate([{ opacity: 0.25, filter: 'blur(2px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 320 / speed, delay: dur * 0.3, easing: 'ease-out', fill: 'backwards' });
      }
    });
    const keep = new Set(words.map((w) => w.id));
    const gone: Ghost[] = [];
    for (const [id, r] of prev) if (!keep.has(id)) gone.push({ id, text: r.text, x: r.x, y: r.y });
    setGhosts(gone);
    setTrails(moved);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setGhosts([]);
      setTrails([]);
      timer.current = null;
    }, dur + k * STAGGER_MS + 450);
  }, [words, animate, speed]);

  useLayoutEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };

  return (
    <div className={`lx-fm-stage grid ${className ?? ''}`} style={{ ['--lx-fm-dur' as string]: `${Math.round(MORPH_MS / speed)}ms` }}>
      {sizers.map((s, i) => (
        <p key={i} aria-hidden="true" className="lx-fm-line lx-fm-sizer invisible [grid-area:1/1]">
          <Words list={s.trim().split(/\s+/)} />
        </p>
      ))}
      <div ref={box} className="relative [grid-area:1/1]" data-testid="film-stage">
        <p className="lx-fm-line" lang="en">
          {words.map((w, i) => (
            <span key={w.id}>
              {i > 0 ? ' ' : ''}
              {onTap ? (
                <button
                  ref={setRef(w.id)}
                  type="button"
                  className="lx-fm-w lx-fm-tap"
                  data-hi={w.hi || undefined}
                  data-state={tapState?.(i) ?? 'idle'}
                  aria-label={tapLabel?.(w.text)}
                  onClick={() => onTap(i)}
                  data-testid="film-word"
                >
                  {w.text}
                </button>
              ) : (
                <span ref={setRef(w.id)} className="lx-fm-w" data-hi={w.hi || undefined} data-testid="film-word" data-wid={w.id}>
                  {w.text}
                </span>
              )}
            </span>
          ))}
        </p>
        {ghosts.map((g) => (
          <span key={`g-${g.id}`} aria-hidden="true" className="lx-fm-w lx-fm-ghost" style={{ left: g.x, top: g.y }}>
            {g.text}
          </span>
        ))}
        {trails.length > 0 && (
          <svg className="lx-fm-trails" aria-hidden="true">
            {trails.map((t, i) => (
              <path key={t.id} d={t.d} pathLength={1} style={{ animationDelay: `${i * STAGGER_MS}ms` }} />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
