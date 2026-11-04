import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useKeepGapVisible } from '../ui/chat/keyboard';

// Ein einziges, dauerhaft eingehängtes, unsichtbares Eingabefeld (Architektur-Entwurf §6.2).
// Es liegt genau über der aktiven Lücke: Ein Tippen auf die Lücke trifft das echte Feld
// (nativer Fokus, Tastatur am iPhone). Ohne Tippen auf die Lücke wird es nur synchron in
// Klick- oder Tasten-Handlern fokussiert (`focusNow`) – der einzige verlässliche Weg auf iOS.
// Weil es dasselbe Feld bleibt, bleibt am Handy auch die Tastatur von Karte zu Karte offen.
//
// Bedienung der Lücke (UX-Neuanfang 02.11.2026, Teil A): Der Cursor ist frei. Pfeile, Pos1/Ende, Shift-Markieren, Strg/Cmd+A,
// Einfügen, Rücktaste und Entf wirken an der Cursorstelle (das native Feld rechnet, die Lücke zeichnet Cursor und Markierung).
// Klick bzw. Tippen auf einen Buchstaben setzt den Cursor dorthin (`caretAt`), Doppelklick markiert das Wort, Ziehen markiert.
// Tab: Das Feld selbst ist kein Tab-Halt am Dokumentende; die Lücke steht im Satz als Halt und reicht den Fokus weiter, aus dem
// Feld heraus springt Tab zum nächsten bzw. vorigen Bedienelement nach bzw. vor der Lücke. Hilfsknöpfe (Anhören, Tipp, Wort, …)
// nehmen der Lücke den Fokus nicht. Ein Buchstabe ohne Fokus (Laptop) landet in der Lücke, sofern kein Kürzel ihn genommen hat.

export type InputTarget = {
  el: HTMLElement;
  label: string;
  maxLength: number;
  /** Neuer Wert aus dem Feld; Rückgabe = übernommener Wert (gesperrt → alter Wert). */
  onInput(value: string): string;
  onEnter(): void;
  /** Taste im Feld, bevor sie als Eingabe zählt; `true` = verbraucht. */
  onKey?(key: string): boolean;
  onFocusChange?(focused: boolean): void;
  /** Aktueller Wert der Lücke (beim Binden ins Feld übernommen, damit Feld und Lücke gleich sind). */
  value?(): string;
  /** Gesperrt (nach dem Prüfen): Tippen ohne Fokus wird nicht in die Lücke geleitet. */
  locked?(): boolean;
  /** Auswahl im Feld (Zeichen-Index, Code-Punkte) – die Lücke zeichnet Cursor bzw. Markierung. */
  onSelect?(start: number, end: number): void;
  /** Cursorstelle (Code-Punkte) zu einem Punkt im Bild, z. B. dem angetippten Buchstaben. */
  caretAt?(x: number, y: number): number;
};

type Api = {
  bind: (t: InputTarget) => () => void;
  focusNow: () => void;
  blur: () => void;
  reset: (value?: string) => void;
  isInput: (el: EventTarget | null) => boolean;
  remeasure: () => void;
};

const Ctx = createContext<Api | null>(null);

export function useHiddenInput(): Api {
  const api = useContext(Ctx);
  if (!api) throw new Error('HiddenInputProvider fehlt');
  return api;
}

/** Ist `el` das unsichtbare Eingabefeld der Lücke? (Für Bausteine ohne Zugriff auf den Kontext, z. B. das Wort-Fenster.) */
export function isGapInput(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && el.dataset.testid === 'gap-input';
}

type Box = { top: number; left: number; width: number; height: number };

/** Code-Einheiten-Index → Zeichen-Index (Code-Punkte). */
function toCp(value: string, unit: number): number {
  return [...value.slice(0, Math.max(0, unit))].length;
}
/** Zeichen-Index (Code-Punkte) → Code-Einheiten-Index. */
function toUnit(value: string, cp: number): number {
  return [...value].slice(0, Math.max(0, cp)).join('').length;
}

/** Wortgrenzen um die Stelle `i` (Code-Punkte): Buchstaben, Ziffern, Apostroph und Bindestrich gehören zum Wort. */
export function wordAround(value: string, i: number): [number, number] {
  const chars = [...value];
  const inWord = (c: string | undefined) => !!c && /[\p{L}\p{N}'’-]/u.test(c);
  let s = Math.min(Math.max(0, i), chars.length);
  if (!inWord(chars[s]) && inWord(chars[s - 1])) s -= 1;
  let e = s;
  while (s > 0 && inWord(chars[s - 1])) s--;
  while (e < chars.length && inWord(chars[e])) e++;
  return [s, e];
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

function tabbable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tabIndex < 0 || isGapInput(el)) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

/** Tab aus dem Feld: nächstes bzw. voriges Bedienelement nach bzw. vor der Lücke (DOM-Reihenfolge), `null` = keins. */
function neighborOf(gap: HTMLElement, dir: 1 | -1): HTMLElement | null {
  const all = Array.from(document.querySelectorAll(FOCUSABLE)).filter(tabbable);
  const own = (el: HTMLElement) => el === gap || gap.contains(el);
  if (dir === 1) return all.find((el) => !own(el) && !!(gap.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? null;
  const before = all.filter((el) => !own(el) && !!(gap.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) && !el.contains(gap));
  return before[before.length - 1] ?? null;
}

/** Fokus irgendwo, wo Tippen nichts bewirkt (kein Feld, kein Dialog): dann gehört ein Buchstabe in die Lücke. */
function typingGoesNowhere(target: EventTarget | null, key: string): boolean {
  const a = document.activeElement;
  const el = (target instanceof HTMLElement ? target : a) as HTMLElement | null;
  if (el && (el.isContentEditable || el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]'))) return false;
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false;
  // Leertaste auf einem Knopf löst ihn aus; nur ohne Bedienelement im Fokus gehört sie in die Lücke.
  if (key === ' ' && el && el !== document.body && el.closest('button, a, summary, [role="button"], [tabindex]:not([tabindex="-1"])')) return false;
  return true;
}

export function HiddenInputProvider({ children }: { children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<InputTarget | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [meta, setMeta] = useState<{ label: string; maxLength: number } | null>(null);
  const lastSel = useRef<[number, number]>([-1, -1]);
  const pointer = useRef<string>('mouse');

  const measure = useCallback(() => {
    const t = target.current;
    if (!t) return;
    const r = t.el.getBoundingClientRect();
    // Trefferfläche mindestens 44 × 44 px (Kap. 4, F6), mittig über der Lücke.
    const width = Math.max(44, r.width);
    const height = Math.max(44, r.height);
    setBox({ top: r.top + window.scrollY - (height - r.height) / 2, left: r.left + window.scrollX - (width - r.width) / 2, width, height });
  }, []);

  /** Auswahl des Felds an die Lücke melden (nur bei Änderung). */
  const syncSel = useCallback((force = false) => {
    const el = input.current;
    const t = target.current;
    if (!el || !t) return;
    const s = toCp(el.value, el.selectionStart ?? el.value.length);
    const e = toCp(el.value, el.selectionEnd ?? el.value.length);
    if (!force && lastSel.current[0] === s && lastSel.current[1] === e) return;
    lastSel.current = [s, e];
    t.onSelect?.(s, e);
  }, []);

  /** Auswahl setzen (Code-Punkte); `back`: Richtung rückwärts (Shift-Markieren nach links). */
  const select = useCallback(
    (s: number, e: number, back = false) => {
      const el = input.current;
      if (!el) return;
      const a = toUnit(el.value, Math.min(s, e));
      const b = toUnit(el.value, Math.max(s, e));
      el.setSelectionRange(a, b, back ? 'backward' : 'forward');
      syncSel();
    },
    [syncSel],
  );

  const api = useMemo<Api>(
    () => ({
      bind(t) {
        target.current = t;
        const el = input.current;
        if (el) {
          // Feld und Lücke zeigen dasselbe (eine neue Lücke ist leer, eine wieder gebundene behält ihren Text); Cursor ans Ende.
          el.value = t.value?.() ?? '';
          if (document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
          // Hatte das Feld den Fokus schon vor dem Binden (im Weiter-Tipp fokussiert), erfährt es die neue Lücke hier.
          t.onFocusChange?.(document.activeElement === el);
        }
        lastSel.current = [-1, -1];
        setMeta({ label: t.label, maxLength: t.maxLength });
        measure();
        if (el) {
          const n = [...el.value].length;
          lastSel.current = [n, n];
          t.onSelect?.(n, n);
        }
        return () => {
          if (target.current !== t) return;
          target.current = null;
          setBox(null);
          setMeta(null);
        };
      },
      focusNow() {
        input.current?.focus({ preventScroll: true });
      },
      blur() {
        input.current?.blur();
      },
      reset(value = '') {
        if (input.current) input.current.value = value;
      },
      isInput(el) {
        return !!el && el === input.current;
      },
      remeasure: measure,
    }),
    [measure],
  );

  useLayoutEffect(() => {
    if (!box) return;
    const t = target.current;
    const ro = t ? new ResizeObserver(measure) : null;
    if (t && ro) ro.observe(t.el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [box, measure]);

  // iPhone-Tastatur (Kap. 4.1, H5): Lücke und Prüfen-Knopf bleiben über der Tastatur sichtbar –
  // gilt für jede Lücke (Trainer, Grammatik, Übungen, Lektion, Check), dieselbe Lösung wie im Chat.
  const getInput = useCallback(() => input.current, []);
  const getGap = useCallback(() => target.current?.el ?? null, []);
  useKeepGapVisible(getInput, getGap);

  // Beim Wechsel zwischen Bildschirmen bleibt das Feld eingehängt; ohne Ziel ruht es im Bild.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onFocus = () => {
      target.current?.onFocusChange?.(true);
      syncSel(true);
    };
    const onBlur = () => target.current?.onFocusChange?.(false);
    // Jede Cursorbewegung (Pfeile, Pos1/Ende, Markieren, Strg+A) meldet das Feld; die Lücke zeichnet sie.
    const onSel = () => syncSel();
    const onDocSel = () => {
      if (document.activeElement === el) syncSel();
    };
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);
    el.addEventListener('select', onSel);
    el.addEventListener('selectionchange', onSel);
    document.addEventListener('selectionchange', onDocSel);
    return () => {
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('select', onSel);
      el.removeEventListener('selectionchange', onSel);
      document.removeEventListener('selectionchange', onDocSel);
    };
  }, [syncSel]);

  // Hilfsknöpfe (Anhören, Tipp, Wort antippen, Prüfen, Weiter …) nehmen der Lücke den Fokus nicht: der Mausdruck auf einen Knopf
  // verschiebt den Fokus nicht, der Klick wirkt trotzdem. So bleibt am Handy die Tastatur offen und am Laptop der Cursor in der Lücke.
  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      const el = input.current;
      if (!el || !target.current || document.activeElement !== el || e.button !== 0) return;
      const hit = e.target instanceof Element ? e.target : null;
      if (!hit || hit === el) return;
      const btn = hit.closest('button, [role="button"]');
      if (!btn || btn.closest('[role="dialog"]')) return;
      // Ein Knopf, der ein Blatt öffnet, gibt den Fokus wie gewohnt ab: das Blatt nimmt ihn und gibt ihn beim Schließen zurück
      // (sonst gälte der Fokus des Blatts als Tastaturfokus und zeichnete den Fokusrahmen).
      if (btn.hasAttribute('aria-haspopup')) return;
      e.preventDefault();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);

  // Tippen ohne Fokus (Laptop): ein Buchstabe landet in der Lücke – erst nachdem alle Kürzel (T, W, 1–4, ?) ihn hätten nehmen können.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = input.current;
      const t = target.current;
      if (!el || !t || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (document.activeElement === el || t.locked?.()) return;
      if (!typingGoesNowhere(e.target, e.key)) return;
      const key = e.key;
      // Leertaste würde sonst die Seite rollen.
      if (key === ' ') e.preventDefault();
      window.setTimeout(() => {
        const cur = target.current;
        const field = input.current;
        if (e.defaultPrevented && key !== ' ') return;
        if (!cur || cur !== t || !field || cur.locked?.()) return;
        if (document.activeElement !== field && !typingGoesNowhere(document.activeElement, key)) return;
        field.focus({ preventScroll: true });
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? field.value.length;
        if (field.value.length - (end - start) >= (meta?.maxLength ?? cur.maxLength)) return;
        field.setRangeText(key, start, end, 'end');
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meta]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const t = target.current;
    if (!t) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      t.onEnter();
      return;
    }
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const next = neighborOf(t.el, e.shiftKey ? -1 : 1);
      if (next) {
        e.preventDefault();
        next.focus();
      }
      return;
    }
    if (t.onKey?.(e.key)) {
      e.preventDefault();
      return;
    }
    // Die neue Cursorstelle steht erst nach der Taste fest.
    window.requestAnimationFrame(() => syncSel());
  };

  // Maus: Klick setzt den Cursor auf den getroffenen Buchstaben, Doppelklick markiert das Wort, Dreifachklick alles, Ziehen markiert,
  // Shift+Klick erweitert. Das Feld selbst ist unsichtbar (seine Schrift liegt nicht über den Buchstaben), deshalb rechnet die Lücke.
  const drag = useRef<{ anchor: number } | null>(null);
  const onMouseDown = (e: MouseEvent<HTMLInputElement>) => {
    const t = target.current;
    const el = e.currentTarget;
    if (!t?.caretAt || e.button !== 0 || pointer.current !== 'mouse') return;
    e.preventDefault();
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    const at = t.caretAt(e.clientX, e.clientY);
    if (e.detail >= 3) {
      select(0, [...el.value].length);
      return;
    }
    if (e.detail === 2) {
      const [s, end] = wordAround(el.value, at);
      select(s, end);
      return;
    }
    if (e.shiftKey) {
      const anchor = el.selectionDirection === 'backward' ? toCp(el.value, el.selectionEnd ?? 0) : toCp(el.value, el.selectionStart ?? 0);
      select(anchor, at, at < anchor);
      drag.current = { anchor };
    } else {
      select(at, at);
      drag.current = { anchor: at };
    }
    const move = (m: globalThis.MouseEvent) => {
      const d = drag.current;
      const cur = target.current;
      if (!d || !cur?.caretAt || !(m.buttons & 1)) return;
      const to = cur.caretAt(m.clientX, m.clientY);
      select(d.anchor, to, to < d.anchor);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const bound = !!box && !!meta;
  return (
    <Ctx.Provider value={api}>
      {children}
      <input
        ref={input}
        type="text"
        inputMode="text"
        lang="en"
        enterKeyHint="go"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        // Emrah 04.11.2026: iOS bot „Kontakt autom. ausfüllen“ und den eigenen Nachnamen an. Ein eindeutiger Name sagt dem System, dass hier
        // eine Antwort steht, kein Kontaktfeld.
        name="lx-answer"
        aria-autocomplete="none"
        data-testid="gap-input"
        aria-label={meta?.label ?? ''}
        aria-hidden={bound ? undefined : true}
        // Kein Tab-Halt am Dokumentende: die Lücke im Satz ist der Halt und reicht den Fokus hierher weiter.
        tabIndex={-1}
        maxLength={meta?.maxLength ?? 60}
        onInput={(e) => {
          const t = target.current;
          const el = e.currentTarget;
          if (!t) {
            el.value = '';
            return;
          }
          const before = el.value;
          const at = el.selectionStart ?? before.length;
          const accepted = t.onInput(before);
          if (accepted !== before) {
            el.value = accepted;
            // Gesperrt bzw. gekürzt: der Cursor bleibt, wo er war (höchstens am Ende).
            const pos = Math.min(at, accepted.length);
            el.setSelectionRange(pos, pos);
          }
          syncSel();
        }}
        onPointerDown={(e) => {
          pointer.current = e.pointerType || 'mouse';
        }}
        onMouseDown={onMouseDown}
        onClick={(e) => {
          // Finger bzw. Stift: das native Tippen fokussiert (Tastatur am iPhone), danach steht der Cursor am angetippten Buchstaben.
          const t = target.current;
          if (!t?.caretAt || pointer.current === 'mouse') return;
          const at = t.caretAt(e.clientX, e.clientY);
          select(at, at);
        }}
        onKeyDown={onKeyDown}
        className={bound ? 'lx-hidden-input' : 'lx-hidden-input sr-only'}
        style={
          bound && box
            ? { top: box.top, left: box.left, width: box.width, height: box.height, pointerEvents: 'auto' }
            : { top: typeof window === 'undefined' ? 0 : window.scrollY + 96, left: 0, width: 1, height: 1, pointerEvents: 'none' }
        }
      />
    </Ctx.Provider>
  );
}
