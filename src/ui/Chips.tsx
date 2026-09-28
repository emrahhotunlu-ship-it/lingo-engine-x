import type { ReactNode } from 'react';

// Chips (Prototyp v1 `.chips`/`.chip`): Filter als Umschalter (`aria-pressed`) oder ruhige
// Anzeige. Waagrecht wischbar statt umzubrechen, wenn `scroll` gesetzt ist (390 px, G5).

export type ChipOption<T extends string> = { value: T; label: ReactNode; testId?: string };

type ChipsProps<T extends string> = {
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  testId?: string;
  /** Eine Zeile, waagrecht wischbar (sonst Umbruch). */
  scroll?: boolean;
};

const CHIP = 'inline-flex min-h-9 items-center rounded-full px-3 text-sm whitespace-nowrap transition-colors';

/** Filter-Chips: genau einer ist gewählt. */
export function Chips<T extends string>({ options, value, onChange, label, testId, scroll }: ChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex gap-2 ${scroll ? '-mx-4 overflow-x-auto px-4 [scrollbar-width:none]' : 'flex-wrap'}`} data-testid={testId} data-hscroll={scroll ? '' : undefined}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            data-testid={o.testId}
            data-value={o.value}
            className={`${CHIP} ${on ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg hover:bg-surface'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Einzelner Chip zur Anzeige (kein Knopf) oder als Knopf mit `onClick`. */
export function Chip({ children, onClick, testId, tone = 'default' }: { children: ReactNode; onClick?: () => void; testId?: string; tone?: 'default' | 'accent' }) {
  const cls = `${CHIP} ${tone === 'accent' ? 'bg-accent-soft font-semibold text-accent-text' : 'bg-surface-strong text-fg'}`;
  if (!onClick)
    return (
      <span className={cls} data-testid={testId}>
        {children}
      </span>
    );
  return (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-surface`} data-testid={testId}>
      {children}
    </button>
  );
}
