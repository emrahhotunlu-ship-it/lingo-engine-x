import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent } from 'react';
import { spring } from './motion';

type Option<T extends string> = {
  value: T;
  label: string;
  testId?: string;
  /** Farbpunkt vor dem Text (CSS-Variable, z. B. `--swatch-iris`), nur Schmuck (aria-hidden). */
  dot?: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  /** Spalten (Phase 6: Zahlenauswahl in einer Reihe); Standard wie bisher 3 bzw. 2. */
  columns?: 4 | 6;
  testId?: string;
};

const COLS: Record<4 | 6, string> = { 4: 'grid-cols-4', 6: 'grid-cols-3 sm:grid-cols-6' };

/** Auswahl als Radiogruppe: Pfeiltasten wechseln, gemeinsames Hervorhebungs-Element gleitet mit. */
export function Segmented<T extends string>({ label, value, options, onChange, columns, testId }: Props<T>) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    const opt = options[next];
    if (!opt) return;
    onChange(opt.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      data-testid={testId}
      className={`grid w-full gap-1 rounded-[var(--radius-control)] bg-track p-1 ${columns ? COLS[columns] : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            data-testid={o.testId}
            className={`relative min-h-11 min-w-0 rounded-[calc(var(--radius-control)-4px)] px-2 text-sm leading-tight transition-colors ${active ? 'font-semibold text-fg' : 'font-medium text-muted hover:text-fg'}`}
          >
            {active && (
              // UX-Prüfung W11 (Relaunch P1, Nora 28.10.2026): Gewählt = deckende Fläche über der Spur, Ring in line-2, Fettung und
              // Schrift fg statt fg-2 – nicht mehr die Schriftfarbe als Fläche.
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-[inherit] bg-surface-solid shadow-sm ring-1 ring-inset ring-line-strong"
                aria-hidden="true"
              />
            )}
            {/* Wörter bleiben ganz (kein globales overflow-wrap mitten im Wort); nur echte Silbentrennung. */}
            <span className={`relative [overflow-wrap:normal] [hyphens:auto] ${o.dot ? 'inline-flex items-center justify-center gap-2' : ''}`}>
              {o.dot && <span aria-hidden="true" className="size-2.5 flex-none rounded-full" style={{ background: `var(${o.dot})` }} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
