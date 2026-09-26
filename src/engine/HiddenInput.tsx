import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// Ein einziges, dauerhaft eingehängtes, unsichtbares Eingabefeld (Architektur-Entwurf §6.2).
// Es liegt genau über der aktiven Lücke: Ein Tippen auf die Lücke trifft das echte Feld
// (nativer Fokus, Tastatur am iPhone). Ohne Tippen auf die Lücke wird es nur synchron in
// Klick- oder Tasten-Handlern fokussiert (`focusNow`) – der einzige verlässliche Weg auf iOS.

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

type Box = { top: number; left: number; width: number; height: number };

export function HiddenInputProvider({ children }: { children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<InputTarget | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [meta, setMeta] = useState<{ label: string; maxLength: number } | null>(null);

  const measure = useCallback(() => {
    const t = target.current;
    if (!t) return;
    const r = t.el.getBoundingClientRect();
    setBox({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: Math.max(24, r.width), height: Math.max(24, r.height) });
  }, []);

  const api = useMemo<Api>(
    () => ({
      bind(t) {
        target.current = t;
        if (input.current) input.current.value = '';
        setMeta({ label: t.label, maxLength: t.maxLength });
        measure();
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

  // Beim Wechsel zwischen Bildschirmen bleibt das Feld eingehängt; ohne Ziel ruht es im Bild.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onFocus = () => target.current?.onFocusChange?.(true);
    const onBlur = () => target.current?.onFocusChange?.(false);
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const t = target.current;
    if (!t) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      t.onEnter();
      return;
    }
    if (t.onKey?.(e.key)) e.preventDefault();
  };

  const bound = !!box && !!meta;
  return (
    <Ctx.Provider value={api}>
      {children}
      <input
        ref={input}
        type="text"
        inputMode="text"
        enterKeyHint="go"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-testid="gap-input"
        aria-label={meta?.label ?? ''}
        aria-hidden={bound ? undefined : true}
        tabIndex={bound ? 0 : -1}
        maxLength={meta?.maxLength ?? 60}
        onInput={(e) => {
          const t = target.current;
          const el = e.currentTarget;
          if (!t) {
            el.value = '';
            return;
          }
          const accepted = t.onInput(el.value);
          if (accepted !== el.value) el.value = accepted;
          el.setSelectionRange(el.value.length, el.value.length);
        }}
        onSelect={(e) => {
          const el = e.currentTarget;
          if (el.selectionStart !== el.value.length) el.setSelectionRange(el.value.length, el.value.length);
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
