import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { DURATION } from './motion';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

type Props = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconAfter?: IconName;
  /** Läuft gerade: Knopf gesperrt, Beschriftung wechselt, kein Spinner (Kap. 3.4). */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
};

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold ' +
  'transition-[background-color,box-shadow,opacity] disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[0_8px_24px_-12px_var(--lx-accent)] hover:brightness-110',
  secondary: 'lx-glass text-fg hover:bg-surface-strong',
  ghost: 'text-muted hover:bg-surface hover:text-fg',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-14 w-full px-6 text-base sm:w-auto',
};

export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, busy, busyLabel, children, className, disabled, ...rest }: Props) {
  return (
    <motion.button
      type="button"
      whileTap={disabled || busy ? undefined : { scale: 0.98 }}
      transition={{ duration: DURATION.fast }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ''}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      <span>{busy && busyLabel ? busyLabel : children}</span>
      {iconAfter && <Icon name={iconAfter} size={size === 'lg' ? 22 : 18} />}
    </motion.button>
  );
}

type IconButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & { icon: IconName; label: string };

/** Nur-Symbol-Knopf mit Beschriftung für Screenreader; Touch-Ziel 44 px. */
export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={{ duration: DURATION.fast }}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg ${className ?? ''}`}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </motion.button>
  );
}
