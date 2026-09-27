import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent } from 'react';
import { spring } from './motion';

type Option<T extends string> = { value: T; label: string; testId?: string };

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
              // Gewählte Fläche: fest, mit Kante in Text-Grau (≥ 3:1 in allen Modi, WCAG 1.4.11).
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-[inherit] bg-surface-solid shadow-sm"
                style={{ boxShadow: 'inset 0 0 0 1px var(--lx-fg-subtle)' }}
                aria-hidden="true"
              />
            )}
            {/* Wörter bleiben ganz (kein globales overflow-wrap mitten im Wort); nur echte Silbentrennung. */}
            <span className="relative [overflow-wrap:normal] [hyphens:auto]">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
