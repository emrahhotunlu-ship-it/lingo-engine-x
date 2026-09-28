import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../../platform/diagnostics';

// Fehlergrenze je Karte (architektur.md §3.1 Ebene „Schritt“, plan.md §4.4 Muss 6): Eine kaputte
// Karte kostet nur diese Karte – Hinweis mit „Überspringen“, die Runde läuft weiter. Protokolliert
// mit Karten-ID. `resetKey` = Schritt der Runde: die nächste Karte beginnt wieder unversehrt.

type Props = { resetKey: string | number; where: string; fallback: (skip: () => void) => ReactNode; onSkip: () => void; children: ReactNode };
type State = { failed: boolean; key: string | number };

export class CardBoundary extends Component<Props, State> {
  override state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(p: Props, s: State): Partial<State> | null {
    return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null;
  }

  override componentDidCatch(err: unknown, info: ErrorInfo): void {
    logError('ui:trainer', err, `${this.props.where} ${info.componentStack?.split('\n').slice(0, 3).join(' ') ?? ''}`.trim());
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.props.onSkip) : this.props.children;
  }
}
