import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHiddenInput } from './HiddenInput';
import { emit } from './fx';
import { useT } from '../i18n';
import type { MaskCell } from '../domain/answer/mask';

// Kinetische Lücke (Kap. 4.1, Architektur-Entwurf §6.1/6.3): getippt wird direkt in die Lücke.
// Jeder Buchstabe fliegt vom Eingabepunkt in die Lücke und rastet ein; die Lücke wächst mit,
// erbt Schrift und Grundlinie. Ohne Maske verrät die Anfangsbreite die Lösung nicht; mit Maske
// (Stufen mit Hilfe oder nach „Tipp", CLAUDE.md A7) zeigt die Lücke je Buchstabe einen
// Platzhalter, Leerzeichen und Bindestriche sind sichtbar, und jeder getippte Buchstabe fliegt
// auf seinen Platz. Bei reduzierter Bewegung erscheinen die Buchstaben ohne Flug.
// Freier Cursor (UX-Neuanfang 02.11.2026): Jeder Buchstabe hat eine feste Kennung; eingefügt wird an der Cursorstelle, und nur
// der neue Buchstabe fliegt. Die Lücke zeichnet Cursor (blinkend) und Markierung selbst, das unsichtbare Feld rechnet.

export type GapState = 'input' | 'correct' | 'near' | 'wrong';

type Props = {
  label: string;
  maxLength: number;
  state: GapState;
  /** Claude prüft noch (`grammar-fit@1`): die Eingabe ist gesperrt, die Antwort bleibt stehen. */
  busy?: boolean | undefined;
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
  /**
   * Nach der Prüfung: die Lösung gleitet in 200 ms in die Lücke, die eigene Eingabe steht klein und durchgestrichen
   * darüber (Lernplattform 2.0 §4.4). Bei reduzierter Bewegung sofort. Wirkt nur, solange die Lücke nicht mehr eingibt.
   */
  reveal?: { solution: string; given: string | null } | null | undefined;
  /** Unterdrückt Haptik und Ton der Lücke (das Urteil übernimmt sie). Standard: aus, also wie bisher. */
  silent?: boolean | undefined;
};

type Flyer = { id: number; cid: number; ch: string; x: number; y: number; dx: number; dy: number; font: string };
type Pt = { x: number; top: number; bottom: number };

const MAX_FLYERS = 12;
const FLIGHT_MS = 240;
let flyerSeq = 1;
let charSeq = 1;
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

export function KineticGap({ label, maxLength, state, busy = false, marks, mask, shown, onChange, onEnter, onKey, reveal, silent = false }: Props) {
  const { t } = useT();
  const api = useHiddenInput();
  const reduce = useReducedMotion();
  const gap = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('');
  // Feste Kennung je Zeichen (Code-Punkte): Einfügen in der Mitte lässt die übrigen Buchstaben stehen.
  const [ids, setIds] = useState<number[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const width = useMotionValue<number | string>('3.5em');
  const locked = state !== 'input' || busy;
  // Ton und Vibration zur Rückmeldung (Kap. 4.7, 4.3) melden wir nur als Lernereignis; der Dirigent (`engine/fx`) spielt sie, einmal je Prüfen.
  useEffect(() => {
    if (state === 'input' || silent) return;
    emit({ k: 'verdict', v: state === 'correct' ? 'ok' : state === 'near' ? 'near' : 'wrong', el: gap.current });
  }, [state, silent]);
  const flyersNow = useRef<Flyer[]>([]);
  const timers = useRef(new Set<number>());
  const landRef = useRef((f: Flyer) => {
    flyersNow.current = flyersNow.current.filter((x) => x.id !== f.id);
    setFlyers((all) => all.filter((x) => x.id !== f.id));
  });
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach((id) => window.clearTimeout(id));
      set.clear();
    };
  }, []);
  const live = useRef({ locked, value, ids, reduce, onChange, onEnter, onKey, mask });
  useLayoutEffect(() => {
    live.current = { locked, value, ids, reduce, onChange, onEnter, onKey, mask };
  });

  /** Cursorstellen 0…n im Bild (n = Zeichenzahl): linke Kante des Zeichens, am Ende die rechte Kante des letzten. */
  const points = useCallback((): Pt[] => {
    const i = inner.current;
    if (!i) return [];
    const s = live.current;
    const n = s.ids.length;
    const ir = i.getBoundingClientRect();
    const out: Pt[] = [];
    if (s.mask) {
      const slots = i.querySelectorAll<HTMLElement>('[data-slot]');
      const off = hintOffset(s.mask, s.value);
      for (let b = 0; b <= n; b++) {
        const el = slots[b + off];
        const prev = slots[b + off - 1];
        const r = (el ?? prev)?.getBoundingClientRect();
        if (!r) out.push({ x: ir.left, top: ir.top, bottom: ir.bottom });
        else out.push({ x: el ? r.left : r.right, top: r.top, bottom: r.bottom });
      }
      return out;
    }
    const byId = new Map<number, HTMLElement>();
    i.querySelectorAll<HTMLElement>('[data-cid]').forEach((el) => byId.set(Number(el.dataset.cid), el));
    for (let b = 0; b <= n; b++) {
      const el = b < n ? byId.get(s.ids[b] ?? -1) : undefined;
      const last = b > 0 ? byId.get(s.ids[b - 1] ?? -1) : undefined;
      const r = (el ?? last)?.getBoundingClientRect();
      if (!r) out.push({ x: ir.left, top: ir.top, bottom: Math.max(ir.bottom, ir.top + 1) });
      else out.push({ x: el ? r.left : r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  }, []);

  /** Nächste Cursorstelle zu einem Punkt (erst die Zeile, dann die Waagerechte). */
  const caretAt = useCallback(
    (x: number, y: number): number => {
      const pts = points();
      let best = pts.length > 0 ? pts.length - 1 : 0;
      let bestD = Infinity;
      pts.forEach((p, b) => {
        const dy = y < p.top ? p.top - y : y > p.bottom ? y - p.bottom : 0;
        const d = dy * 1000 + Math.abs(x - p.x);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      });
      return best;
    },
    [points],
  );

  const handleInput = useCallback(
    (next: string): string => {
      const s = live.current;
      if (s.locked) return s.value;
      const prev = s.value;
      const a = [...prev];
      const b = [...next];
      // Gleicher Anfang und gleiches Ende bleiben stehen; dazwischen ist entfernt bzw. eingefügt (an der Cursorstelle).
      let p = 0;
      while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let q = 0;
      while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
      const removed = a.length - p - q;
      const added = b.slice(p, b.length - q);
      const newIds = added.map(() => charSeq++);
      const nextIds = [...s.ids.slice(0, p), ...newIds, ...s.ids.slice(a.length - q)];
      const g = gap.current;
      const i = inner.current;
      const spawned: Flyer[] = [];
      if (!s.reduce && g && i && added.length > 0) {
        const font = fontOf(i);
        const gr = g.getBoundingClientRect();
        const fromX = Math.min(window.innerWidth - 24, gr.right + 8);
        const fromY = Math.min(window.innerHeight - 24, gr.bottom + 56);
        const slots = i.querySelectorAll<HTMLElement>('[data-slot]');
        const off = hintOffset(s.mask, next);
        const at = points()[p];
        const ir = i.getBoundingClientRect();
        added.forEach((ch, k) => {
          const slot = s.mask ? slots[p + k + off] : undefined;
          let x = (at?.x ?? ir.left) + textWidth(added.slice(0, k).join(''), font);
          let y = at?.top ?? ir.top;
          if (slot) {
            const r = slot.getBoundingClientRect();
            x = r.left + Math.max(0, (r.width - textWidth(ch, font)) / 2);
            y = r.top;
          }
          spawned.push({ id: flyerSeq++, cid: newIds[k] ?? 0, ch, x, y, dx: fromX - x, dy: fromY - y, font });
        });
      }
      // Höchstens 12 Flieger gleichzeitig: beim 13. landet der älteste sofort. Gelöschte Buchstaben fliegen nicht weiter.
      const alive = new Set(nextIds);
      const all = [...flyersNow.current.filter((x) => alive.has(x.cid)), ...spawned];
      const keep = all.slice(Math.max(0, all.length - MAX_FLYERS));
      flyersNow.current = keep;
      // Landung nach fester Flugzeit (≈ 240 ms): deterministisch, auch wenn ein Bild ausfällt.
      for (const f of keep) if (spawned.includes(f)) timers.current.add(window.setTimeout(() => landRef.current(f), FLIGHT_MS));
      s.ids = nextIds;
      s.value = next;
      setIds(nextIds);
      setFlyers(keep);
      setValue(next);
      s.onChange(next, { firstKey: prev.length === 0 && next.length > 0, deleted: removed });
      return next;
    },
    [points],
  );

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
      value: () => live.current.value,
      locked: () => live.current.locked,
      onSelect: (a, b) => setSel((cur) => (cur[0] === a && cur[1] === b ? cur : [a, b])),
      caretAt,
    });
  }, [api, label, maxLength, handleInput, caretAt]);

  // Die Lücke wächst mit dem Text (Feder), mindestens 3,5em – unabhängig von der Lösung.
  // Mit Platzhaltern bemisst sie sich aus den Plätzen selbst (Breite `auto`, B3).
  const masked = !!mask;
  const rv = reveal && locked ? reveal : null;
  const revealed = !!rv;
  useLayoutEffect(() => {
    const g = gap.current;
    const i = inner.current;
    if (!g || !i) return;
    const em = parseFloat(getComputedStyle(g).fontSize) || 16;
    if (masked || revealed) {
      // K3 (Abgleich 04.11.2026): Die aufgedeckte Lösung brach in der Lücke um („trade-/off“), obwohl die Zeile Platz hatte.
      // Passt sie in die Zeile, bleibt sie in einer Zeile; nur zu lange Lösungen dürfen umbrechen.
      if (revealed) {
        let rbox: HTMLElement | null = g.parentElement;
        while (rbox && getComputedStyle(rbox).display.startsWith('inline')) rbox = rbox.parentElement;
        const ravail = rbox && rbox.clientWidth > 0 ? rbox.clientWidth : Infinity;
        // Erst ohne Umbruch messen, dann entscheiden (die umgebrochene Breite verrät nicht, ob die Lösung in eine Zeile passt).
        i.style.flexWrap = 'nowrap';
        i.style.whiteSpace = 'nowrap';
        if (i.scrollWidth + 0.6 * em > ravail) {
          i.style.flexWrap = 'wrap';
          i.style.whiteSpace = '';
        }
      }
      api.remeasure();
      return;
    }
    // Natürliche Breite = Summe der Wortgruppen (die Innenfläche selbst kann schon umbrechen);
    // höchstens die volle Zeilenbreite, darüber bricht die Antwort zwischen Wörtern um.
    const natural = Array.from(i.children).reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) || i.scrollWidth;
    let box: HTMLElement | null = g.parentElement;
    while (box && getComputedStyle(box).display.startsWith('inline')) box = box.parentElement;
    const avail = box && box.clientWidth > 0 ? box.clientWidth : Infinity;
    const target = Math.min(Math.max(3.5 * em, natural + 0.6 * em), avail);
    // Passt die Antwort in die Zeile, bricht sie nie im Kasten um (auch nicht, solange die Breite noch nachzieht); nur zu lange Antworten umbrechen.
    i.style.flexWrap = natural + 0.6 * em <= avail ? 'nowrap' : 'wrap';
    i.style.whiteSpace = '';
    const cur = width.get();
    if (typeof cur !== 'number' || reduce) width.set(target);
    else if (cur !== target) void animate(width, target, { type: 'spring', stiffness: 520, damping: 40 });
    api.remeasure();
  }, [value, api, reduce, width, masked, revealed, shown]);

  // Sichtbarer Cursor: steht an der Cursorstelle des Felds, nur solange die Lücke den Fokus hat und eingibt.
  const showCaret = focused && !locked && !revealed && sel[0] === sel[1];
  const placeCaret = useCallback(() => {
    const c = caret.current;
    const g = gap.current;
    if (!c || !g) return;
    const pt = points()[Math.min(sel[0], live.current.ids.length)];
    if (!showCaret || !pt) {
      c.style.display = 'none';
      return;
    }
    const gr = g.getBoundingClientRect();
    // Emrahs Kommentar 03.11.2026 („der Cursor blinkt genau in die Zeile rein“): der Strich steht in der Schrifthöhe und endet über der
    // Unterstreichung der Lücke (oben 12 %, Länge 70 % der Zeilenhöhe), statt die ganze Zeilenhöhe bis auf die Linie zu reichen.
    const em = parseFloat(getComputedStyle(g).fontSize) || 16;
    let lineH = pt.bottom - pt.top;
    let top0 = pt.top - gr.top;
    // K2 (Abgleich 04.11.2026): In der leeren Lücke hat die Messstelle keine Höhe – der Strich lag dann als kurzer Rest auf der Linie.
    // Ohne Buchstaben stehen Höhe und Oberkante deshalb aus Schriftgröße und Innenfläche der Lücke selbst (mittig über der Unterstreichung).
    if (lineH < em * 0.6) {
      const cs = getComputedStyle(g);
      const padT = parseFloat(cs.paddingTop) || 0;
      const padB = parseFloat(cs.paddingBottom) || 0;
      const innerH = Math.max(em, g.clientHeight - padT - padB);
      lineH = Math.min(innerH, em * 1.25);
      top0 = padT + (innerH - lineH) / 2;
    }
    lineH = Math.max(12, lineH);
    const left = `${Math.round((pt.x - gr.left - 1) * 10) / 10}px`;
    const top = `${Math.round((top0 + lineH * 0.12) * 10) / 10}px`;
    const height = `${Math.round(Math.max(10, lineH * 0.7) * 10) / 10}px`;
    const moved = c.style.left !== left || c.style.top !== top || c.style.display === 'none';
    c.style.display = '';
    c.style.left = left;
    c.style.top = top;
    c.style.height = height;
    // Nach jeder Bewegung zuerst sichtbar, dann wieder blinken.
    if (moved && c.getAnimations) c.getAnimations().forEach((an) => (an.currentTime = 0));
  }, [points, sel, showCaret]);
  useLayoutEffect(() => {
    placeCaret();
  });
  useEffect(() => {
    const g = gap.current;
    const i = inner.current;
    if (!g || !i || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => placeCaret());
    ro.observe(g);
    ro.observe(i);
    return () => ro.disconnect();
  }, [placeCaret]);
  const flyingIds = new Set(flyers.map((f) => f.cid));
  const selRange: [number, number] | null = focused && !locked && sel[0] !== sel[1] ? sel : null;


  return (
    <>
      <motion.span
        ref={gap}
        className="lx-gap"
        data-testid="gap"
        data-state={revealed ? 'reveal' : state}
        data-focused={focused || undefined}
        // Tab-Halt an der Lücke selbst: das unsichtbare Feld ist nicht in der Tab-Reihe, die Lücke reicht den Fokus weiter.
        tabIndex={!locked && !focused ? 0 : -1}
        onFocus={() => api.focusNow()}
        data-masked={mask && !revealed ? '' : undefined}
        data-revealed={revealed || undefined}
        style={{ width: mask || revealed ? 'auto' : width }}
        lang="en"
      >
        {rv?.given?.trim() && (
          <span className="lx-gap-given" data-testid="gap-given">
            <span className="sr-only">{t('exGapYours')}: </span>
            {rv.given}
          </span>
        )}
        <span ref={inner} className="lx-gap-inner" data-settled={locked || undefined}>
          {rv ? (
            <motion.span
              className="lx-gap-reveal"
              data-testid="gap-solution"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
            >
              <span className="sr-only">{t('exGapSolution')}: </span>
              {rv.solution}
            </motion.span>
          ) : mask ? (
            <MaskedLetters mask={mask} value={value} shown={locked ? (shown ?? null) : null} ids={ids} flying={flyingIds} sel={selRange} marks={marks} reduce={!!reduce} />
          ) : (
            // Wörter bleiben zusammen; lange Antworten (ganze Satzteile) brechen zwischen Wörtern um,
            // statt über den Rand hinauszulaufen (Befund 27.09.: Feld zu klein).
            // Nach dem Prüfen darf der Rahmen eine bereinigte Fassung zeigen (`shown`, Q0: Abkürzung „mba“ → „MBA“); gleiche Länge, nur andere Zeichen.
            wordGroups(locked && shown && [...shown].length === ids.length ? shown : value).map((g) => (
              <span key={ids[g.start] ?? `w${g.start}`} className="lx-gap-word">
                <AnimatePresence initial={false}>
                  {[...g.text].map((ch, k) => {
                    const i = g.start + k;
                    const cid = ids[i];
                    return (
                      <Letter
                        key={cid ?? `x${i}`}
                        cid={cid}
                        ch={ch}
                        landed={locked || cid === undefined || !flyingIds.has(cid)}
                        off={!!marks?.[i]}
                        sel={!!selRange && i >= selRange[0] && i < selRange[1]}
                        reduce={!!reduce}
                      />
                    );
                  })}
                </AnimatePresence>
              </span>
            ))
          )}
        </span>
        <span ref={caret} className="lx-caret" data-testid="gap-caret" aria-hidden="true" style={{ display: 'none' }} />
      </motion.span>
      {/* Nach dem Prüfen steht die Antwort fest: noch fliegende Buchstaben sind sofort gelandet (sonst blendet die Lücke sie bis 390 ms nach dem Prüfen erst ein und flackert). */}
      {flyers.length > 0 && !locked &&
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
  ids,
  flying,
  sel,
  marks,
  reduce,
}: {
  mask: readonly MaskCell[];
  value: string;
  shown: string | null;
  ids: readonly number[];
  flying: ReadonlySet<number>;
  sel: [number, number] | null;
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
          <Letter
            ch={ch}
            cid={ids[vi]}
            landed={shown !== null || ids[vi] === undefined || !flying.has(ids[vi] ?? -1)}
            off={!!marks?.[vi]}
            sel={!!sel && vi >= sel[0] && vi < sel[1]}
            reduce={reduce}
          />
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

function Letter({ ch, cid, landed, off, sel, reduce }: { ch: string; cid: number | undefined; landed: boolean; off: boolean; sel: boolean; reduce: boolean }) {
  return (
    <motion.span
      data-letter=""
      data-cid={cid}
      data-sel={sel || undefined}
      data-landed={landed ? 'true' : 'false'}
      className={`lx-letter${off ? ' lx-letter-off' : ''}`}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
    >
      {ch === ' ' ? '\u00a0' : ch}
    </motion.span>
  );
}

/** Buchstaben in Wortgruppen (je Wort samt folgendem Leerzeichen), Indizes bleiben global. */
function wordGroups(value: string): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  const chars = [...value];
  let start = 0;
  let cur = '';
  chars.forEach((ch, i) => {
    cur += ch;
    if (ch === ' ') {
      out.push({ start, text: cur });
      start = i + 1;
      cur = '';
    }
  });
  if (cur) out.push({ start, text: cur });
  return out;
}
