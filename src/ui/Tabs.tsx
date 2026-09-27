import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { spring } from './motion';

// Reiter nach WAI-ARIA (tablist/tab/tabpanel): Pfeiltasten wechseln, Pos1/Ende springen,
// die Hervorhebung gleitet mit (gemeinsames Layout-Element, Kap. 4.4).

export type TabItem<T extends string> = { id: T; label: string; testId?: string };

type Props<T extends string> = {
  label: string;
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  testId?: string;
  children: ReactNode;
};

export function Tabs<T extends string>({ label, items, value, onChange, testId, children }: Props<T>) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, items.findIndex((i) => i.id === value));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const it = items[next];
    if (!it) return;
    onChange(it.id);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={label} onKeyDown={onKey} data-testid={testId} className="grid w-full grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-track p-1 sm:grid-cols-4">
        {items.map((it, i) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${it.id}`}
              aria-selected={active}
              aria-controls={`${base}-panel`}
              tabIndex={active ? 0 : -1}
              data-testid={it.testId}
              onClick={() => onChange(it.id)}
              className={`relative min-h-11 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm transition-colors ${active ? 'font-semibold text-fg' : 'font-medium text-muted hover:text-fg'}`}
            >
              {active && <motion.span layoutId={`${base}-pill`} className="absolute inset-0 rounded-[inherit] bg-surface-strong shadow-sm" transition={spring} aria-hidden="true" />}
              <span className="relative">{it.label}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} tabIndex={0} className="outline-none">
        {children}
      </div>
    </div>
  );
}
