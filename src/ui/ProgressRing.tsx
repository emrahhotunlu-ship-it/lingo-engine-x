import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE_OUT } from './motion';

// Ruhige Fortschrittsanzeigen (Kap. 7). Bewegung höchstens 300 ms (Kap. 4.4); bei
// reduzierter Bewegung erscheinen sie ohne Animation (Kap. 4.6).

type RingProps = { value: number; size?: number; stroke?: number; label: string };

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** Fortschrittsring, z. B. für das Tagesziel. `value` 0–1. */
export function ProgressRing({ value, size = 64, stroke = 6, label }: RingProps) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp01(value));
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
        initial={{ strokeDashoffset: reduce ? offset : c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: reduce ? 0 : DURATION.slow, ease: EASE_OUT }}
      />
    </svg>
  );
}

type BarProps = { value: number; label: string; tone?: 'accent' | 'muted'; duration?: number };

/** Schlanker Balken. Smaragd nur für Erledigtes/Richtiges (Kap. 8), sonst `muted`. */
export function Bar({ value, label, tone = 'accent', duration = DURATION.slow }: BarProps) {
  const reduce = useReducedMotion();
  const width = `${clamp01(value) * 100}%`;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-track" role="img" aria-label={label}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone === 'accent' ? 'var(--lx-accent)' : 'var(--lx-fg-subtle)' }}
        initial={{ width: reduce ? width : 0 }}
        animate={{ width }}
        transition={{ duration: reduce ? 0 : duration, ease: EASE_OUT }}
      />
    </div>
  );
}
