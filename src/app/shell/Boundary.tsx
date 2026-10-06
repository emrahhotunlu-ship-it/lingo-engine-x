import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useNav } from '../nav';
import { routeToString } from '../router/deeplink';
import type { Route } from '../router/types';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { local, KEY_PREFIX } from '../../platform/storage';
import { logError } from '../../platform/diagnostics';
import { useLayer } from './layer';
import { usePlayer } from './playerContext';

// Fehlergrenzen auf drei Ebenen (docs/neubau/architektur.md §3.1, leistung.md §6, N03):
// 1. Wurzel (`RootBoundary` um den ganzen Rahmen): ruhiger Vollbild-Hinweis mit „Neu laden“.
// 2. Seite/Übung (`ScreenBoundary`, im Rahmen um jeden Bildschirm, `key` = Route als Text):
//    Seite → „Seite neu aufbauen“ / „Zu Heute“; Übung → „Diese Aufgabe überspringen“ (über
//    `usePlayerSkip`) bzw. „Übung beenden“.
// 3. Schritt (`StepBoundary resetKey={step}`): die Pakete legen sie um die aktuelle Aufgabe.
// Jeder gefangene Fehler geht SOFORT ins Diagnose-Protokoll (lx:diag, überlebt ein Neuladen).
// Asynchrone Fehler fangen Grenzen nicht – die laufen über `initDiagnostics` und `runAction`.

/** Test-Schalter ohne Test-Code im Build (§3.1): `lx:crash-once=<route>` wirft genau einmal. */
export const CRASH_KEY = `${KEY_PREFIX}crash-once`;

type BoundaryProps = {
  /** Protokoll-Bereich, z. B. `ui:trainer` oder `step:trainer`. */
  scope: string;
  /** Zusatz fürs Protokoll (Route, Karten-ID). */
  detail?: string;
  /** Ändert sich der Wert, wird die Grenze zurückgesetzt (neuer Schritt, neue Route). */
  resetKey?: unknown;
  fallback: (reset: () => void, error: Error) => ReactNode;
  children: ReactNode;
};

type BoundaryState = { error: Error | null; key: unknown };

/** Kleine eigene Fehlergrenze (React 19 hat keinen Hook dafür). */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    // Neuer Schritt/neue Route: Fehler vergessen (sonst bliebe der Hinweis über der nächsten Aufgabe).
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null };
    return null;
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    disarmCrashProbe();
    const stack = (info.componentStack ?? '').split('\n').slice(0, 6).join(' ‹ ').replace(/\s+/g, ' ').trim();
    logError(this.props.scope, error, [this.props.detail, stack].filter(Boolean).join(' · ').slice(0, 600));
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.reset, this.state.error);
    return this.props.children;
  }
}

/** Ausgelöste Probe: wirft, bis eine Grenze den Fehler angenommen hat (auch bei Wiederholungen des Renderns). */
let pendingCrash: string | null = null;
/** Hat eine Schritt-Probe den Wurf übernommen, bleibt die Probe der Übungsebene im selben Durchgang still. */
let stepClaimed = false;

/**
 * Wirft genau einmal, wenn `localStorage['lx:crash-once'] === name`, und löscht den Schlüssel –
 * so erholt sich „Seite neu aufbauen“/„Überspringen“ sofort. E2E setzt ihn über
 * `boot({ localStorage })`; im Alltag ist der Schlüssel nie gesetzt.
 */
export function CrashProbe({ name, level = 'screen' }: { name: string; level?: 'screen' | 'step' | 'player' }) {
  if (pendingCrash === null && local.get(CRASH_KEY) === name) {
    local.remove(CRASH_KEY);
    pendingCrash = name;
  }
  if (pendingCrash !== name) return null;
  // Die Schritt-Grenze hat den Wurf schon angenommen: nicht nochmals auf Übungsebene werfen,
  // sonst verdeckt der Übungs-Hinweis „Diese Aufgabe überspringen“ (disarm läuft erst im Commit).
  if (level === 'player' && stepClaimed) return null;
  if (level === 'step') stepClaimed = true;
  throw new Error(`crash-once: ${name}`);
}

/** Nach dem Fangen: Die Probe ist verbraucht (erst im Commit, damit React-Wiederholungen weiter werfen). */
function disarmCrashProbe(): void {
  pendingCrash = null;
  stepClaimed = false;
}

function Notice({ title, sub, children, testId }: { title: string; sub: string; children: ReactNode; testId: string }) {
  return (
    <div role="alert" className="lx-card mx-auto my-6 flex w-full max-w-xl flex-col gap-3 p-5" data-testid={testId}>
      <p className="m-0 flex items-center gap-2 text-base font-semibold">
        <Icon name="alert" size={18} className="text-gold-text" />
        {title}
      </p>
      <p className="m-0 text-sm text-muted">{sub}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Hinweis einer Seite: neu aufbauen oder zu Heute. */
export function PageErrorNotice({ onRebuild, onToday }: { onRebuild: () => void; onToday: () => void }) {
  const { t } = useT();
  return (
    <Notice title={t('nbShErrPage')} sub={t('nbShErrPageSub')} testId="boundary-page">
      <Button variant="primary" icon="refresh" onClick={onRebuild} data-testid="boundary-rebuild">
        {t('nbShErrRebuild')}
      </Button>
      <Button variant="ghost" onClick={onToday} data-testid="boundary-today">
        {t('nbShErrToToday')}
      </Button>
    </Notice>
  );
}

/** Hinweis einer Übung: Aufgabe überspringen (wenn angemeldet) oder Übung beenden. */
export function ExerciseErrorNotice({ onSkip, onEnd }: { onSkip: (() => void) | null; onEnd: () => void }) {
  const { t } = useT();
  return (
    <Notice title={t('nbShErrExercise')} sub={t('nbShErrExerciseSub')} testId="boundary-exercise">
      {onSkip && (
        <Button variant="primary" iconAfter="arrowRight" onClick={onSkip} data-testid="boundary-skip">
          {t('nbShErrSkip')}
        </Button>
      )}
      <Button variant={onSkip ? 'ghost' : 'primary'} onClick={onEnd} data-testid="boundary-end">
        {t('nbShErrEnd')}
      </Button>
    </Notice>
  );
}

/**
 * Grenze um jede Seite/Reiter-Wurzel (§3.1 Nr. 2): „Seite neu aufbauen“ baut den Bildschirm neu
 * auf (Schlüssel zählt hoch), „Zu Heute“ führt zur Startseite. Kopf und Reiterleiste bleiben.
 */
export function ScreenBoundary({ route, children }: { route: Route; children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const go = useNav((s) => s.go);
  const text = routeToString(route);
  return (
    <ErrorBoundary
      scope={`ui:${route.name}`}
      detail={text}
      resetKey={`${text}#${attempt}`}
      fallback={() => <PageErrorNotice onRebuild={() => setAttempt((n) => n + 1)} onToday={() => go({ name: 'today' })} />}
    >
      <CrashProbe name={route.name} />
      {children}
    </ErrorBoundary>
  );
}

/**
 * Schritt-Grenze für die Pakete: um die aktuelle Aufgabe legen, `resetKey` = Schritt/Karten-ID.
 * Eine kaputte Aufgabe kostet nur diese Aufgabe: „Diese Aufgabe überspringen“ ruft `onSkip`
 * (ohne Bewertung weiter). Ohne `onSkip` gilt das im Player angemeldete Überspringen.
 */
export function StepBoundary({ resetKey, scope, detail, onSkip, children }: { resetKey: unknown; scope: string; detail?: string; onSkip?: () => void; children: ReactNode }) {
  const player = usePlayer();
  const { route } = useLayer();
  const skip = onSkip ?? player.skip;
  return (
    <ErrorBoundary
      scope={`step:${scope}`}
      detail={detail ?? String(resetKey)}
      resetKey={resetKey}
      fallback={(reset) => (
        <StepNotice
          onSkip={
            skip
              ? () => {
                  skip();
                  reset();
                }
              : null
          }
        />
      )}
    >
      {/* Test-Schalter `lx:crash-once=<route>` (G4): zuerst hier, damit die Übung weiterläuft. */}
      {route && <CrashProbe name={route.name} level="step" />}
      {children}
    </ErrorBoundary>
  );
}

function StepNotice({ onSkip }: { onSkip: (() => void) | null }) {
  const { t } = useT();
  return (
    <div role="alert" className="lx-card flex flex-col gap-3 p-4" data-testid="boundary-step">
      <p className="m-0 flex items-center gap-2 font-semibold">
        <Icon name="alert" size={18} className="text-gold-text" />
        {t('nbShErrStep')}
      </p>
      {onSkip && (
        <div>
          <Button variant="primary" iconAfter="arrowRight" onClick={onSkip} data-testid="boundary-skip">
            {t('nbShErrSkip')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Letzte Grenze um den ganzen Rahmen (§3.1 Nr. 1). */
export function RootBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <ErrorBoundary scope="ui:root" fallback={() => fallback}>
      {children}
    </ErrorBoundary>
  );
}

/** Hinweis der Wurzel-Grenze: „Neu laden“ und „Diagnose und Sicherung“. */
export function RootNotice({ onDiagnostics }: { onDiagnostics: () => void }) {
  const { t } = useT();
  return (
    <Notice title={t('nbShErrRoot')} sub={t('nbShErrRootSub')} testId="boundary-root">
      <Button variant="primary" icon="refresh" onClick={() => window.location.reload()} data-testid="boundary-reload">
        {t('nbShErrReload')}
      </Button>
      <Button variant="ghost" onClick={onDiagnostics} data-testid="boundary-diag">
        {t('nbShErrDiag')}
      </Button>
    </Notice>
  );
}
