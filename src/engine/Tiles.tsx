import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Tile } from '../domain/drills/order';

// Bausteine (Kap. 4.3): Tippen legt einen Baustein ans Ende der Satzzeile bzw. nimmt ihn zurück;
// Ziehen legt ihn an eine bestimmte Stelle (auch innerhalb der Zeile umsortieren). Beides mit
// Maus, Finger und Tastatur (Bausteine sind Knöpfe). Layout-Animation beim Umordnen.

type Mark = 'ok' | 'off' | 'near';

type Props = {
  tiles: readonly Tile[];
  placed: readonly number[];
  onChange: (placed: number[]) => void;
  locked: boolean;
  marks?: Readonly<Record<number, Mark>>;
  labels: { line: string; pool: string };
  /** Beschriftung der Markierungen für Screenreader (die Markierung zeigt zusätzlich zur Farbe ein Zeichen). */
  markLabels?: Readonly<Record<Mark, string>>;
};

/** Zeichen je Markierung: Farbe allein reicht nicht (WCAG 1.4.1). */
const MARK_GLYPH: Readonly<Record<Mark, string>> = { ok: '✓', near: '↔', off: '✕' };

type Drag = { id: number; from: 'pool' | 'line'; x0: number; y0: number; dx: number; dy: number; moved: boolean; pointer: number };

const THRESHOLD = 6;

export function Tiles({ tiles, placed, onChange, locked, marks, labels, markLabels }: Props) {
  const reduce = useReducedMotion();
  const line = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState(false);
  const justDragged = useRef(false);
  const byId = new Map(tiles.map((t) => [t.id, t]));
  // Feste Fläche (Emrahs Meldung 03.10.2026, „kein t im Buchstabenvorrat“): Ein gelegter Baustein lässt im Vorrat einen
  // unsichtbaren Platzhalter zurück, und die Satzzeile ist von Anfang an so hoch wie der volle Vorrat. So springt beim
  // Antippen nichts nach oben – vorher rutschte der Knopf „Prüfen“ unter den Finger und prüfte nach 1–2 Buchstaben.
  const poolRef = useRef<HTMLDivElement>(null);
  const [lineMin, setLineMin] = useState<number | null>(null);
  useLayoutEffect(() => {
    const h = poolRef.current?.getBoundingClientRect().height ?? 0;
    const el = line.current;
    if (!(h > 0) || !el) return;
    // border-box: Innenabstand und Rahmen der Zeile kommen dazu.
    const cs = window.getComputedStyle(el);
    const extra = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + (parseFloat(cs.getPropertyValue(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))) || 0), 0);
    setLineMin(Math.ceil(h + extra));
  }, [tiles]);

  const toggle = (id: number) => {
    if (locked) return;
    onChange(placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id]);
  };

  const inLine = (x: number, y: number): boolean => {
    const r = line.current?.getBoundingClientRect();
    return !!r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 12 && y <= r.bottom + 12;
  };

  /** Einfügestelle in der Satzzeile nach Zeigerposition (ohne den gezogenen Baustein). */
  const dropIndex = (x: number, y: number, id: number): number => {
    const rest = placed.filter((p) => p !== id);
    for (let i = 0; i < rest.length; i++) {
      const el = refs.current.get(rest[i] as number);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const sameRow = y >= r.top - 6 && y <= r.bottom + 6;
      if ((sameRow && x < r.left + r.width / 2) || y < r.top - 6) return i;
    }
    return rest.length;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: number, from: 'pool' | 'line') => {
    if (locked || e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id, from, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, pointer: e.pointerId });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    const moved = drag.moved || Math.hypot(dx, dy) > THRESHOLD;
    setDrag({ ...drag, dx, dy, moved });
    setOver(moved && inLine(e.clientX, e.clientY));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    setDrag(null);
    setOver(false);
    if (!d.moved) return; // Tippen: erledigt `onClick`.
    justDragged.current = true;
    window.setTimeout(() => {
      justDragged.current = false;
    }, 0);
    if (inLine(e.clientX, e.clientY)) {
      const idx = dropIndex(e.clientX, e.clientY, d.id);
      const rest = placed.filter((p) => p !== d.id);
      onChange([...rest.slice(0, idx), d.id, ...rest.slice(idx)]);
    } else if (d.from === 'line') onChange(placed.filter((p) => p !== d.id));
  };

  const tileButton = (id: number, where: 'pool' | 'line') => {
    const t = byId.get(id);
    if (!t) return null;
    const dragging = drag?.id === id && drag.moved;
    const mark = marks?.[id];
    return (
      <motion.button
        key={id}
        layout={!reduce && !dragging}
        ref={(el: HTMLButtonElement | null) => {
          if (el) refs.current.set(id, el);
          else refs.current.delete(id);
        }}
        type="button"
        className="lx-tile"
        lang="en"
        data-testid="tile"
        data-tile={t.text}
        data-where={where}
        data-state={mark}
        data-dragging={dragging || undefined}
        disabled={locked}
        style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, position: 'relative' } : undefined}
        onPointerDown={(e) => onPointerDown(e, id, where)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          setDrag(null);
          setOver(false);
        }}
        onClick={(e) => {
          // Nach einem Ziehen kein zusätzliches Tippen auslösen.
          if (justDragged.current) {
            justDragged.current = false;
            if (e.detail > 0) return;
          }
          toggle(id);
        }}
      >
        {mark && (
          <>
            <span className="lx-tile-mark" aria-hidden="true">
              {MARK_GLYPH[mark]}
            </span>
            {markLabels?.[mark] && <span className="sr-only">{markLabels[mark]}: </span>}
          </>
        )}
        {t.text}
      </motion.button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={line} className="lx-tile-line" role="group" aria-label={labels.line} data-testid="tile-line" data-over={over || undefined} style={lineMin ? { minHeight: lineMin } : undefined}>
        {placed.map((id) => tileButton(id, 'line'))}
      </div>
      <div ref={poolRef} className="flex flex-wrap gap-2" role="group" aria-label={labels.pool} data-testid="tile-pool">
        {tiles.map((t) =>
          placed.includes(t.id) ? (
            <span key={t.id} className="lx-tile invisible" aria-hidden="true" data-testid="tile-ghost">
              {t.text}
            </span>
          ) : (
            tileButton(t.id, 'pool')
          ),
        )}
      </div>
    </div>
  );
}
