import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from './motion';

type Props = { value: number; size?: number; stroke?: number; label: string };

/** Ruhiger Fortschrittsring (Kap. 7). `value` 0–1. */
export function ProgressRing({ value, size = 64, stroke = 6, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lx-track)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--lx-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - v) }}
        transition={{ duration: DURATION.slow * 2, ease: EASE_OUT }}
      />
    </svg>
  );
}

/** Schlanker Balken, z. B. für Beherrschung je Thema. */
export function Bar({ value, label, tone = 'accent' }: { value: number; label: string; tone?: 'accent' | 'muted' }) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-track" role="img" aria-label={label}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone === 'accent' ? 'var(--lx-accent)' : 'var(--lx-fg-subtle)' }}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ duration: DURATION.slow * 2, ease: EASE_OUT }}
      />
    </div>
  );
}
