import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHiddenInput } from './HiddenInput';
import type { MaskCell } from '../domain/answer/mask';

// Kinetische Lücke (Kap. 4.1, Architektur-Entwurf §6.1/6.3): getippt wird direkt in die Lücke.
// Jeder Buchstabe fliegt vom Eingabepunkt in die Lücke und rastet ein; die Lücke wächst mit,
// erbt Schrift und Grundlinie. Ohne Maske verrät die Anfangsbreite die Lösung nicht; mit Maske
// (Stufen mit Hilfe oder nach „Tipp", CLAUDE.md A7) zeigt die Lücke je Buchstabe einen
// Platzhalter, Leerzeichen und Bindestriche sind sichtbar, und jeder getippte Buchstabe fliegt
// auf seinen Platz. Bei reduzierter Bewegung erscheinen die Buchstaben ohne Flug.

export type GapState = 'input' | 'correct' | 'near' | 'wrong';

type Props = {
  label: string;
  maxLength: number;
  state: GapState;
  /** Nach der Prüfung: je Zeichen, ob es abweicht (goldene Markierung). */
  marks?: boolean[] | undefined;
  /** Buchstaben-Platzhalter (nur Länge und Trennzeichen, nie die Lösung). */
  mask?: readonly MaskCell[] | null | undefined;
  /**
   * Nach der Prüfung: die gewertete Eingabe (mit vorgegebenem Anfangsbuchstaben, falls er
   * nicht mitgetippt wurde). Die Markierungen `marks` beziehen sich auf diesen Text.
   */
  shown?: string | null | undefined;
  onChange: (value: string, info: { firstKey: boolean; deleted: number }) => void;
  onEnter: () => void;
  onKey?: (key: string) => boolean;
};

type Flyer = { id: number; index: number; ch: string; x: number; y: number; dx: number; dy: number; font: string };

const MAX_FLYERS = 12;
const FLIGHT_MS = 240;
let flyerSeq = 1;
let canvas: HTMLCanvasElement | null = null;

function fontOf(el: Element): string {
  const cs = getComputedStyle(el);
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
}

function textWidth(text: string, font: string): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 10;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function KineticGap({ label, maxLength, state, marks, mask, shown, onChange, onEnter, onKey }: Props) {
  const api = useHiddenInput();
  const reduce = useReducedMotion();
  const gap = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('');
  const [landed, setLanded] = useState<boolean[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [focused, setFocused] = useState(false);
  const width = useMotionValue<number | string>('3.5em');
  const locked = state !== 'input';
  const flyersNow = useRef<Flyer[]>([]);
  const timers = useRef(new Set<number>());
  const landRef = useRef((f: Flyer) => {
    flyersNow.current = flyersNow.current.filter((x) => x.id !== f.id);
    setFlyers((all) => all.filter((x) => x.id !== f.id));
    setLanded((l) => l.map((v, k) => (k === f.index ? true : v)));
  });
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach((id) => window.clearTimeout(id));
      set.clear();
    };
  }, []);
  const live = useRef({ locked, value, reduce, onChange, onEnter, onKey, mask });
  useLayoutEffect(() => {
    live.current = { locked, value, reduce, onChange, onEnter, onKey, mask };
  });

  const handleInput = useCallback((next: string): string => {
    const s = live.current;
    if (s.locked) return s.value;
    const prev = s.value;
    let p = 0;
    while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
    const g = gap.current;
    const i = inner.current;
    const spawned: Flyer[] = [];
    if (!s.reduce && g && i && next.length > p) {
      const font = fontOf(i);
      const gr = g.getBoundingClientRect();
      const ir = i.getBoundingClientRect();
      const fromX = Math.min(window.innerWidth - 24, gr.right + 8);
      const fromY = Math.min(window.innerHeight - 24, gr.bottom + 56);
      const slots = i.querySelectorAll<HTMLElement>('[data-slot]');
      const off = hintOffset(s.mask, next);
      for (let k = p; k < next.length; k++) {
        const slot = slots[k + off];
        let x = ir.left + textWidth(next.slice(0, k), font);
        let y = ir.top;
        if (slot) {
          const r = slot.getBoundingClientRect();
          x = r.left + Math.max(0, (r.width - textWidth(next[k] ?? '', font)) / 2);
          y = r.top;
        }
        spawned.push({ id: flyerSeq++, index: k, ch: next[k] ?? '', x, y, dx: fromX - x, dy: fromY - y, font });
      }
    }
    // Höchstens 12 Flieger gleichzeitig: beim 13. landet der älteste sofort.
    const all = [...flyersNow.current.filter((x) => x.index < p), ...spawned];
    const drop = Math.max(0, all.length - MAX_FLYERS);
    const keep = all.slice(drop);
    const flying = new Set(keep.map((f) => f.index));
    flyersNow.current = keep;
    // Landung nach fester Flugzeit (≈ 240 ms): deterministisch, auch wenn ein Bild ausfällt.
    for (const f of keep) if (spawned.includes(f)) timers.current.add(window.setTimeout(() => landRef.current(f), FLIGHT_MS));
    setLanded((l) => {
      const out = l.slice(0, p).map((v, k) => v || !flying.has(k));
      for (let k = p; k < next.length; k++) out[k] = !flying.has(k);
      return out;
    });
    setFlyers(keep);
    setValue(next);
    s.onChange(next, { firstKey: prev.length === 0 && next.length > 0, deleted: Math.max(0, prev.length - p) });
    return next;
  }, []);

  useEffect(() => {
    const el = gap.current;
    if (!el) return;
    return api.bind({
      el,
      label,
      maxLength,
      onInput: handleInput,
      onEnter: () => live.current.onEnter(),
      onKey: (k) => live.current.onKey?.(k) ?? false,
      onFocusChange: setFocused,
    });
  }, [api, label, maxLength, handleInput]);

  // Die Lücke wächst mit dem Text (Feder), mindestens 3,5em – unabhängig von der Lösung.
  // Mit Platzhaltern bemisst sie sich aus den Plätzen selbst (Breite `auto`, B3).
  const masked = !!mask;
  useLayoutEffect(() => {
    const g = gap.current;
    const i = inner.current;
    if (!g || !i) return;
    if (masked) {
      api.remeasure();
      return;
    }
    const em = parseFloat(getComputedStyle(g).fontSize) || 16;
    const target = Math.max(3.5 * em, i.scrollWidth + 0.6 * em);
    const cur = width.get();
    if (typeof cur !== 'number' || reduce) width.set(target);
    else if (cur !== target) void animate(width, target, { type: 'spring', stiffness: 520, damping: 40 });
    api.remeasure();
  }, [value, api, reduce, width, masked, shown]);


  return (
    <>
      <motion.span
        ref={gap}
        className="lx-gap"
        data-testid="gap"
        data-state={state}
        data-focused={focused || undefined}
        data-masked={mask ? '' : undefined}
        style={{ width: mask ? 'auto' : width }}
        lang="en"
      >
        <span ref={inner} className="lx-gap-inner" data-settled={locked || undefined}>
          {mask ? (
            <MaskedLetters mask={mask} value={value} shown={locked ? (shown ?? null) : null} landed={landed} marks={marks} reduce={!!reduce} />
          ) : (
            <AnimatePresence initial={false}>
              {[...value].map((ch, i) => (
                <Letter key={`${i}-${ch}`} ch={ch} i={i} landed={!!landed[i]} off={!!marks?.[i]} reduce={!!reduce} />
              ))}
            </AnimatePresence>
          )}
        </span>
      </motion.span>
      {flyers.length > 0 &&
        createPortal(
          <div className="lx-flyer-layer" aria-hidden="true">
            {flyers.map((f) => (
              <motion.span
                key={f.id}
                data-flyer=""
                className="lx-flyer"
                style={{ left: f.x, top: f.y, font: f.font }}
                initial={{ x: f.dx, y: f.dy, scale: 1.3, opacity: 0.2 }}
                animate={{ x: 0, y: [f.dy, f.dy / 2 - 14, 0], scale: 1, opacity: 1 }}
                transition={{ x: { type: 'spring', stiffness: 700, damping: 34, mass: 0.6 }, y: { duration: 0.22, ease: 'easeOut' }, scale: { duration: 0.2 }, opacity: { duration: 0.15 } }}
              >
                {f.ch === ' ' ? ' ' : f.ch}
              </motion.span>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Vorgegebener Anfangsbuchstabe (B1): Tippt man ihn nicht mit, bleibt er auf Platz 1 stehen und
 * die Eingabe beginnt auf Platz 2. Tippt man ihn mit, beginnt die Eingabe auf Platz 1.
 */
export function hintOffset(mask: readonly MaskCell[] | null | undefined, value: string): 0 | 1 {
  const first = mask?.[0];
  if (!first || first.kind !== 'slot' || !first.hint || !value) return 0;
  return value[0]?.toLowerCase() === first.hint.toLowerCase() ? 0 : 1;
}

function MaskedLetters({
  mask,
  value,
  shown,
  landed,
  marks,
  reduce,
}: {
  mask: readonly MaskCell[];
  value: string;
  shown: string | null;
  landed: boolean[];
  marks: boolean[] | undefined;
  reduce: boolean;
}) {
  // Nach der Prüfung zeigt die Lücke die gewertete Eingabe (inkl. Anfangsbuchstabe); während
  // der Eingabe steht der Anfangsbuchstabe fest auf Platz 1, solange er nicht mitgetippt ist.
  const off = shown !== null ? 0 : hintOffset(mask, value);
  const text = shown ?? value;
  const chars = [...text];
  const total = Math.max(mask.length, chars.length + off);
  const cells = [];
  for (let i = 0; i < total; i++) {
    const cell = mask[i];
    const vi = i - off;
    const ch = vi >= 0 ? chars[vi] : undefined;
    const fixedHint = off === 1 && i === 0 && cell?.kind === 'slot' && cell.hint;
    const extra = !cell;
    cells.push(
      <span
        key={`s${i}`}
        className={`lx-slot${cell?.kind === 'fixed' ? ' lx-slot-fixed' : ''}${extra ? ' lx-slot-extra' : ''}`}
        data-slot={extra ? 'extra' : cell.kind === 'fixed' ? 'fixed' : 'letter'}
        data-filled={ch !== undefined || fixedHint ? '' : undefined}
      >
        {ch !== undefined ? (
          <Letter ch={ch} i={vi} landed={shown !== null || !!landed[vi]} off={!!marks?.[vi]} reduce={reduce} />
        ) : cell?.kind === 'fixed' ? (
          <span aria-hidden="true">{cell.ch === ' ' ? '\u00a0' : cell.ch}</span>
        ) : cell?.kind === 'slot' && cell.hint ? (
          <span className="lx-slot-hint" data-hint-fixed={fixedHint ? '' : undefined} aria-hidden="true">
            {cell.hint}
          </span>
        ) : null}
      </span>,
    );
  }
  return <>{cells}</>;
}

function Letter({ ch, i, landed, off, reduce }: { ch: string; i: number; landed: boolean; off: boolean; reduce: boolean }) {
  return (
    <motion.span
      key={`${i}-${ch}`}
      data-letter=""
      data-landed={landed ? 'true' : 'false'}
      className={`lx-letter${off ? ' lx-letter-off' : ''}`}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
    >
      {ch === ' ' ? '\u00a0' : ch}
    </motion.span>
  );
}
