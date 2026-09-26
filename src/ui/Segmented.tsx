import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent } from 'react';
import { spring } from './motion';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
};

/** Auswahl als Radiogruppe: Pfeiltasten wechseln, gemeinsames Hervorhebungs-Element gleitet mit. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
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
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="flex w-full flex-wrap gap-1 rounded-[var(--radius-control)] bg-surface p-1">
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
            className={`relative min-h-11 flex-1 basis-24 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-medium transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} transition={spring} className="lx-glass absolute inset-0 rounded-[inherit] bg-surface-strong" aria-hidden="true" />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
