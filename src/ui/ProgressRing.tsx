import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { DURATION, EASE_OUT, ringFill } from './motion';

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
        stroke="var(--lx-ok)"
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

type SegmentProps = { segments: number; done: number; size?: number; stroke?: number; label: string; children?: ReactNode };

/**
 * Tagesring (Lernplattform 2.0 §2.2): ein Segment je Pflichtschritt, erledigte in Erfolgsfarbe, Füllung in 300 ms
 * (`ringFill`), bei reduzierter Bewegung sofort. In der Mitte steht frei wählbarer Text („23 Min.“).
 */
export function SegmentRing({ segments, done, size = 56, stroke = 5, label, children }: SegmentProps) {
  const reduce = useReducedMotion();
  const n = Math.max(1, Math.floor(segments));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = n > 1 ? Math.min(6, c / n / 4) : 0;
  const len = c / n - gap;
  return (
    <span className="relative inline-flex flex-none items-center justify-center" style={{ width: size, height: size }} data-testid="today-ring" data-segments={n} data-filled={Math.min(n, Math.max(0, done))}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        {Array.from({ length: n }, (_, i) => {
          const dash = `${len} ${c - len}`;
          const off = -(i * (c / n));
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lx-track)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={off} />
              {i < done && (
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="var(--lx-ok)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={off}
                  initial={{ opacity: reduce ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduce ? { duration: 0 } : ringFill}
                />
              )}
            </g>
          );
        })}
      </svg>
      {children !== undefined && <span className="lx-tnum absolute inset-0 flex items-center justify-center text-center text-xs leading-none font-semibold" aria-hidden="true">{children}</span>}
    </span>
  );
}
