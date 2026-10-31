import type { HTMLAttributes, ReactNode } from 'react';

// D1 V-BAU: Karte (`.card`, Vorschau style.css:312; mit Schatten wie `.daycard`, style.css:173). Ein Radius, eine Schattenstufe.

type Props = HTMLAttributes<HTMLDivElement> & { raised?: boolean; children: ReactNode };

export function VCard({ raised, className, children, ...rest }: Props) {
  return (
    <div className={`lx-v-card${className ? ` ${className}` : ''}`} data-raised={raised ? '' : undefined} {...rest}>
      {children}
    </div>
  );
}
