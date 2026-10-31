import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

// D1 V-BAU: Chip (`.chip`, Vorschau style.css:336). Als Anzeige 28 px; als Filter (mit `onClick`) 34 px sichtbar wie die Filterchips
// der Vorschau (screens.js:856) und 44 px Trefferfläche (v.css). Gewählt = `aria-pressed`, nicht nur Farbe.

type Props = {
  children: ReactNode;
  icon?: IconName;
  /** Zahl hinter dem Text (Filterchips: „Alle 214“). */
  count?: ReactNode;
  onClick?: () => void;
  /** Nur mit `onClick`: gewählt. */
  selected?: boolean;
  lang?: string;
  className?: string;
  'data-testid'?: string;
};

export function VChip({ children, icon, count, onClick, selected, lang, className, ...rest }: Props) {
  const inner = (
    <>
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
      {count != null && <span className="lx-v-chip-n lx-v-num">{count}</span>}
    </>
  );
  const cls = `lx-v-chip${className ? ` ${className}` : ''}`;
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={selected ?? false} onClick={onClick} lang={lang} data-testid={rest['data-testid']}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} lang={lang} data-testid={rest['data-testid']}>
      {inner}
    </span>
  );
}
