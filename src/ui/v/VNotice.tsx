import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

// D1 V-BAU: Hinweis (`.notice`, Vorschau style.css:380–381; Ausfälle H16 screens.js:1042–1066). Ruhig, mit Symbol und Text
// (Zustand nie nur über Farbe, kein Rot für Hinweise). `live` = Statusmeldung für Screenreader.

type Props = { icon?: IconName; children: ReactNode; action?: ReactNode; live?: boolean; className?: string; 'data-testid'?: string };

export function VNotice({ icon = 'info', children, action, live, className, ...rest }: Props) {
  return (
    <div className={`lx-v-notice${className ? ` ${className}` : ''}`} role={live ? 'status' : undefined} data-testid={rest['data-testid']}>
      <Icon name={icon} size={18} />
      <div className="lx-v-notice-body">
        <span>{children}</span>
        {action}
      </div>
    </div>
  );
}
