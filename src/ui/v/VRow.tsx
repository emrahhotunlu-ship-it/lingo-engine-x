import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

// D1 V-BAU: Zeile (`.row`, Vorschau style.css:194–200; „Wenn du mehr willst“ screens.js:100–103): Symbol in Kachel, Titel, Unterzeile,
// Pfeil. Mit `onClick` ist die ganze Zeile ein Knopf (60 px hoch), sonst eine reine Anzeige.

type Props = {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  /** Pfeil rechts (Standard: nur, wenn die Zeile bedienbar ist). */
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
  id?: string;
};

export function VRow({ icon, title, sub, chevron, onClick, className, id, ...rest }: Props) {
  const inner = (
    <>
      {icon && (
        <span className="lx-v-row-ic" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="lx-v-row-t">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {(chevron ?? Boolean(onClick)) && (
        <span className="lx-v-row-chev" aria-hidden="true">
          <Icon name="chevronRight" size={18} />
        </span>
      )}
    </>
  );
  const cls = `lx-v-row${className ? ` ${className}` : ''}`;
  if (onClick) {
    return (
      <button type="button" id={id} className={cls} onClick={onClick} data-testid={rest['data-testid']}>
        {inner}
      </button>
    );
  }
  return (
    <div id={id} className={cls} data-testid={rest['data-testid']}>
      {inner}
    </div>
  );
}
