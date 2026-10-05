import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import type { IconName } from './Icon';
import { useKeyboardInset } from './chat/keyboard';

// Feste Aktionsleiste unten (Gesamtkonzept 3.6, R1/R2): ein Hauptknopf, Zustand gedimmt statt ausgeblendet
// (Prüfen), danach Weiter; Beschriftung blendet in 150 ms um (CSS `lx-bar-in`, bei reduzierter Bewegung abgeschaltet).
// Die Leiste wird in den Anker `#lx-actionbar-host` der Shell gezeichnet (nicht in die Übung): Dort wirken
// weder `transform` der Seitenübergänge noch `backdrop-filter` der Karten auf `position: fixed`.
// Solange sie steht, setzt sie `html[data-actionbar]`; die Seite bekommt Polster in Leistenhöhe (index.css).
// Folgt der Bildschirmtastatur per `visualViewport` (Merkmalserkennung: ohne ihn bleibt sie am unteren Rand).

export const ACTIONBAR_HOST = 'lx-actionbar-host';
let open = 0;
const subscribeNever = () => () => undefined;
const findHost = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.getElementById(ACTIONBAR_HOST));

type Props = {
  children: ReactNode;
  /** Wechselt der Wert, blendet der Inhalt in 150 ms neu ein (Prüfen → Weiter). */
  stateKey?: string;
  /** Kleinere Zusatzknöpfe links vom Hauptknopf (Tipp, Zurücksetzen): nie gefüllt. */
  aside?: ReactNode;
  testId?: string;
};

export function ActionBar({ children, stateKey = 'main', aside, testId = 'actionbar' }: Props) {
  // Anker der Shell: beim ersten Zeichnen kann er noch fehlen, React fragt nach dem Einhängen erneut.
  const host = useSyncExternalStore(subscribeNever, findHost, () => null);
  const inset = useKeyboardInset();
  useEffect(() => {
    open += 1;
    document.documentElement.setAttribute('data-actionbar', '');
    return () => {
      open = Math.max(0, open - 1);
      if (open === 0) document.documentElement.removeAttribute('data-actionbar');
    };
  }, []);
  const bar = (
    <div className="lx-actionbar" data-testid={testId} style={inset > 0 ? { bottom: inset } : undefined}>
      <div className="lx-actionbar-inner" key={stateKey}>
        {aside}
        {children}
      </div>
    </div>
  );
  return host ? createPortal(bar, host) : bar;
}

type PrimaryProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  icon?: IconName;
  iconAfter?: IconName;
  testId: string;
  className?: string;
  [key: `data-${string}`]: string | undefined;
};

/** Der Hauptknopf der Leiste: gefüllt, 56 px hoch, füllt die Breite (neben einem Zusatzknopf den Rest). */
export function PrimaryAction({ children, onClick, disabled, busy, busyLabel, icon, iconAfter, testId, className, ...data }: PrimaryProps) {
  return (
    <Button
      variant="primary"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      busy={busy}
      busyLabel={busyLabel}
      icon={icon}
      iconAfter={iconAfter}
      data-testid={testId}
      className={`lx-actionbar-main sm:w-full ${className ?? ''}`}
      {...data}
    >
      {children}
    </Button>
  );
}
