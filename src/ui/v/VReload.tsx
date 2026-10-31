import { VButton } from './VButton';
import { VNotice } from './VNotice';
import type { IconName } from '../Icon';

// D1 V-BAU: „Erneut laden“ (für P9a/H16, Vorschau screens.js:1053–1056): ruhiger Hinweis mit einem Zweitknopf. Kein Rot, kein Vorwurf.
// Der Knopf ist `sec`, damit der Hauptknopf des Bildschirms (z. B. „Weiter“) der einzige volle Knopf bleibt.

type Props = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  /** Läuft gerade wieder: Knopf gesperrt, Beschriftung `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  icon?: IconName;
  'data-testid'?: string;
};

export function VReload({ message, retryLabel, onRetry, busy, busyLabel, icon = 'refresh', ...rest }: Props) {
  return (
    <VNotice
      icon={icon}
      live
      data-testid={rest['data-testid']}
      action={
        <VButton variant="sec" size="sm" onClick={onRetry} busy={busy} busyLabel={busyLabel} className="lx-v-reload-btn">
          {retryLabel}
        </VButton>
      }
    >
      {message}
    </VNotice>
  );
}
