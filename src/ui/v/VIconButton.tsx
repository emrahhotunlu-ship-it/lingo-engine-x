import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '../Icon';

// D1 V-BAU: Symbolknopf der Vorschau (`.iconbtn`, 44 × 44 px; Vorschau style.css:151–152). Beschriftung für Screenreader ist Pflicht.

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & { icon: IconName; label: string };

export function VIconButton({ icon, label, className, type, ...rest }: Props) {
  return (
    <button type={type ?? 'button'} className={`lx-v-iconbtn${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={24} />
    </button>
  );
}
