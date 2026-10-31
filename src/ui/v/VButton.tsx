import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

// D1 V-BAU: Knopf der Vorschau (`.btn pri|sec|ghost`, `.sm`, `.full`; Vorschau style.css:161–170).
// Ein Hauptknopf (`pri`) je Bildschirm (stufe1-plan.md §6.6). Alle Größen ≥ 44 px.

export type VButtonVariant = 'pri' | 'sec' | 'ghost';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: VButtonVariant;
  /** `sm` = 44 px (Knöpfe im Band, Nebenhandlungen). */
  size?: 'md' | 'sm';
  /** Volle Breite (`.btn.full`). */
  full?: boolean;
  icon?: IconName;
  /** Läuft gerade: gesperrt und mit eigener Beschriftung, kein Spinner (Kap. 3.4). */
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
};

export function VButton({ variant = 'sec', size = 'md', full, icon, busy, busyLabel, children, className, disabled, type, ...rest }: Props) {
  return (
    <button
      type={type ?? 'button'}
      className={`lx-v-btn${className ? ` ${className}` : ''}`}
      data-variant={variant}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-full={full ? '' : undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
}
