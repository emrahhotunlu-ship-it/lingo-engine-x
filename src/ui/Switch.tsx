import { motion } from 'framer-motion';
import { spring } from './motion';

// Schalter (an/aus) als Knopf mit role="switch": ganze Zeile tippbar (≥ 44 px), Zustand für
// Screenreader über aria-checked. Ersetzt kleine Kontrollkästchen.

type Props = { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; testId?: string };

export function Switch({ checked, onChange, label, disabled, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-left text-sm disabled:opacity-60"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-accent' : 'bg-track'}`}
        style={{ boxShadow: 'inset 0 0 0 1px var(--lx-fg-subtle)' }}
      >
        <motion.span layout transition={spring} className={`size-5 rounded-full bg-surface-solid shadow ${checked ? 'ml-auto' : ''}`} />
      </span>
    </button>
  );
}
