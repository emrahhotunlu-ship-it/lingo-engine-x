import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Tile } from '../domain/drills/order';
import { decideDrag } from './tileDrag';

// Bausteine (Kap. 4.3): Tippen legt einen Baustein ans Ende der Satzzeile bzw. nimmt ihn zurück;
// Ziehen legt ihn an eine bestimmte Stelle (auch innerhalb der Zeile umsortieren). Beides mit
// Maus, Finger und Tastatur (Bausteine sind Knöpfe). Layout-Animation beim Umordnen.
// Lernplattform 2.0 §4.4: Die Ablagezeile ist so hoch wie die Zeilen der gelegten Bausteine (mindestens eine, einmal geschätzt,
// wächst nur). Der Vorrat lässt senkrechtes Wischen zu (`pan-y`);
// Ziehen beginnt erst nach 6 px waagrechter Bewegung oder 150 ms Halten (`decideDrag`). Gesperrt: leerer Vorrat weg, Wischen frei.

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
  /** Anzahl der Plätze in der Antwortzeile (Standard: Bausteine ohne Ablenker). Leere Plätze zeigen gestrichelte Umrisse. */
  slots?: number;
  /** UX-Prüfung W3: der Vorrat steht an anderer Stelle (feste Leiste unten), die Antwortzeile bleibt in der Lücke des Satzes. */
  poolTarget?: HTMLElement | null;
  /** Antwortzeile als Teil des Satzes (inline in der Lücke). */
  inline?: boolean;
};

/** Zeichen je Markierung: Farbe allein reicht nicht (WCAG 1.4.1). */
const MARK_GLYPH: Readonly<Record<Mark, string>> = { ok: '✓', near: '↔', off: '✕' };

type Drag = { id: number; from: 'pool' | 'line'; x0: number; y0: number; dx: number; dy: number; moved: boolean; pointer: number; t0: number; kind: 'touch' | 'mouse' };

export function Tiles({ tiles, placed, onChange, locked, marks, labels, markLabels, slots, poolTarget = null, inline = false }: Props) {
  const reduce = useReducedMotion();
  const line = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState(false);
  const justDragged = useRef(false);
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const slotCount = slots ?? tiles.filter((x) => !x.distractor).length;
  const emptySlots = locked ? 0 : Math.max(0, slotCount - placed.length);
  // Plätze in Bausteinhöhe (Plan §4.4): Die Ablagezeile ist so hoch wie die Zeilen, die die gelegten Bausteine brauchen – nicht
  // höher (bisher fest 148 px). Damit beim Antippen nichts springt (Emrahs Meldung „kein t“), wird die Zeilenzahl EINMAL aus den
  // Breiten aller Bausteine geschätzt (Zeilenumbruch nachgerechnet) und danach nur noch nach oben korrigiert. Ein Satz, der in
  // eine Zeile passt, hat damit eine Zeile Höhe. Gemessen wird nach dem Zeichnen, neu mit jeder Aufgabe.
  const pool = useRef<HTMLDivElement>(null);
  const [lineMin, setLineMin] = useState<number | null>(null);
  const rowsSeen = useRef<{ tiles: readonly Tile[]; rows: number }>({ tiles, rows: 1 });
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const measure = (): void => {
      if (rowsSeen.current.tiles !== tiles) rowsSeen.current = { tiles, rows: 1 };
      const cs = window.getComputedStyle(el);
      const px = (k: string): number => parseFloat(cs.getPropertyValue(k)) || 0;
      const extra = px('padding-top') + px('padding-bottom') + px('border-top-width') + px('border-bottom-width');
      const gap = px('row-gap');
      const avail = el.clientWidth - px('padding-left') - px('padding-right');
      const placedEls = Array.from(el.querySelectorAll<HTMLElement>('[data-where="line"]'));
      const poolEls = Array.from(pool.current?.children ?? []) as HTMLElement[];
      const th = Math.max(0, ...placedEls.map((n) => n.offsetHeight), ...poolEls.map((n) => n.offsetHeight)) || (el.firstElementChild as HTMLElement | null)?.offsetHeight || 0;
      if (!(th > 0)) return;
      // Zeilen der schon gelegten Bausteine (tatsächlich) und aller Bausteine (Schätzung, nur solange der Vorrat sichtbar ist).
      const placedRows = new Set(placedEls.map((n) => Math.round(n.offsetTop))).size;
      let guess = 1;
      if (avail > 0 && poolEls.length === tiles.length) {
        // Auch der Fallen-Baustein zählt: Man kann ihn legen, dann braucht die Zeile Platz für alle Bausteine des Vorrats.
        const widths = tiles.map((_, k) => (poolEls[k]?.offsetWidth ?? 0) + 4);
        const pack = (ws: number[]): number => {
          let rows = 1;
          let used = 0;
          for (const w of ws) {
            if (used > 0 && used + gap + w > avail) {
              rows++;
              used = w;
            } else used += (used > 0 ? gap : 0) + w;
          }
          return rows;
        };
        guess = Math.max(pack(widths), pack([...widths].sort((x, y) => y - x)));
      }
      const rows = Math.max(rowsSeen.current.rows, placedRows, guess, 1);
      rowsSeen.current.rows = rows;
      const next = Math.ceil(rows * th + (rows - 1) * gap + extra);
      setLineMin((cur) => (cur === next ? cur : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tiles, placed, locked, slots]);

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
    setDrag({ id, from, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, pointer: e.pointerId, t0: e.timeStamp, kind: e.pointerType === 'touch' ? 'touch' : 'mouse' });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    let moved = drag.moved;
    if (!moved) {
      const decision = decideDrag({ dx, dy, heldMs: e.timeStamp - drag.t0, pointer: drag.kind });
      if (decision === 'scroll') {
        // Senkrecht gewinnt: die Seite scrollt, kein Ziehen (der Browser sendet danach pointercancel).
        setDrag(null);
        setOver(false);
        return;
      }
      moved = decision === 'drag';
    }
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
        data-selected={(where === 'line' && !mark && !locked) || undefined}
        data-dragging={dragging || undefined}
        disabled={locked}
        style={{ ...(where === 'pool' && !locked ? { touchAction: 'pan-y' } : null), ...(dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, position: 'relative' } : null) }}
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

  const poolNode =
    !locked || tiles.some((x) => !placed.includes(x.id)) ? (
      <div ref={pool} className="flex flex-wrap gap-2" role="group" aria-label={labels.pool} data-testid="tile-pool" style={locked ? undefined : { touchAction: 'pan-y' }}>
        {tiles.map((t) =>
          placed.includes(t.id) ? (
            locked ? null : (
              <span key={t.id} className="lx-tile lx-tile-ghost" aria-hidden="true" data-testid="tile-ghost">
                {t.text}
              </span>
            )
          ) : (
            tileButton(t.id, 'pool')
          ),
        )}
      </div>
    ) : null;
  return (
    <div className={inline ? 'dz-tiles-inline' : 'flex flex-col gap-4'}>
      <div ref={line} className="lx-tile-line" role="group" aria-label={labels.line} data-testid="tile-line" data-over={over || undefined} style={lineMin ? { minHeight: lineMin } : undefined}>
        {placed.map((id) => tileButton(id, 'line'))}
        {/* Feste Plätze: so viele Umrisse, wie noch Bausteine fehlen – die Zeile bleibt gleich hoch (R9). */}
        {Array.from({ length: emptySlots }, (_, k) => (
          <span key={`slot-${k}`} className="lx-tile-slot" aria-hidden="true" data-testid="tile-slot" />
        ))}
      </div>
      {poolTarget ? (poolNode ? createPortal(poolNode, poolTarget) : null) : poolNode}
    </div>
  );
}
