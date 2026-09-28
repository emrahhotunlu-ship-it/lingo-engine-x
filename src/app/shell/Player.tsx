import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlayerContext, usePlayer, type PlayerApi } from './playerContext';
import { useT } from '../../i18n';
import { toast } from '../../ui/Toast';
import { logInfo } from '../../platform/diagnostics';
import { useNav } from '../nav';
import { playerNotes, screenOf, type PlayerNoteDef } from '../registry';
import { holdResume, restoreFor } from '../resume';
import { routeToString } from '../router/deeplink';
import type { Route } from '../router/types';
import { CrashProbe, ErrorBoundary, ExerciseErrorNotice } from './Boundary';
import { LayerContext } from './layer';

// Übungsebene (docs/neubau/architektur.md §2.7, plan.md §1.2, N02): Jede Route mit
// `kind:'exercise'` läuft hier – mit Fehlergrenze, Überspringen, Fortsetzen und `ensure()`.
// Die Übung selbst zeichnet ihre Leiste mit `ExerciseTop` (features/learn/ui.tsx); die liest den
// Player-Kontext: Zeile unter dem Balken (`playerNote`, P1: „Tageseinheit · Block 2 von 5“) und
// das ✕ ohne Rückfrage (Toast „Gespeichert …“, wenn ein Fortsetz-Stand gesichert wurde).

export { usePlayer, type PlayerApi } from './playerContext';

/**
 * Die Übung meldet an, wie sie OHNE Bewertung zur nächsten Aufgabe geht (§2.7). Die Fehlergrenze
 * der Übungsebene bietet dann „Diese Aufgabe überspringen“ an.
 */
export function usePlayerSkip(fn: (() => void) | null): void {
  const { setSkip } = usePlayer();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const has = fn !== null;
  useEffect(() => {
    if (!has) return;
    setSkip(() => ref.current?.());
    return () => setSkip(null);
  }, [has, setSkip]);
}

/** Ein Beitrag zur Zeile unter dem Balken – Hook-Aufruf in eigener Komponente (feste Reihenfolge). */
function NoteProbe({ def, route, onNote }: { def: PlayerNoteDef; route: Route; onNote: (v: string | null) => void }) {
  const use = def.use;
  const v = use(route);
  useEffect(() => onNote(v), [v, onNote]);
  return null;
}

function Notes({ route, onNote }: { route: Route; onNote: (v: string | null) => void }) {
  const defs = playerNotes();
  const values = useRef<Array<string | null>>([]);
  const report = useCallback(
    (i: number) => (v: string | null) => {
      values.current[i] = v;
      onNote(values.current.find((x) => !!x) ?? null);
    },
    [onNote],
  );
  const handlers = useMemo(() => defs.map((_, i) => report(i)), [defs, report]);
  return (
    <>
      {defs.map((d, i) => (
        <NoteProbe key={i} def={d} route={route} onNote={handlers[i] ?? onNote} />
      ))}
    </>
  );
}

/** `ensure` vor dem ersten Zeichnen: Sitzung aktiv? Sonst herstellen, sonst ruhig zurück. */
function useEnsure(route: Route): boolean {
  const [ok] = useState(() => {
    const def = screenOf(route.name);
    if (!def?.ensure) return true;
    const ensure = def.ensure;
    if (ensure(route)) return true;
    // Ohne Sitzung (Deep-Link, Neuladen): aus der Momentaufnahme desselben Lerntags herstellen.
    return restoreFor(route.name) && ensure(route);
  });
  const back = useNav((s) => s.back);
  const { t } = useT();
  useEffect(() => {
    if (ok) return;
    logInfo('player:ensure', `ohne Sitzung: ${routeToString(route)}`);
    toast(t('nbShResumeGone'));
    back();
  }, [ok, route, back, t]);
  return ok;
}

function PlayerBody({ route, children }: { route: Route; children: ReactNode }) {
  const ok = useEnsure(route);
  return ok ? <>{children}</> : null;
}

/** Übungsebene um den Bildschirm der Übung. */
export function Player({ route, children }: { route: Route; children: ReactNode }) {
  const [note, setNote] = useState<string | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const [hasSkip, setHasSkip] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const back = useNav((s) => s.back);
  const setSkip = useCallback((fn: (() => void) | null) => {
    skipRef.current = fn;
    setHasSkip(fn !== null);
  }, []);
  const api = useMemo<PlayerApi>(() => ({ route, note, setSkip, skip: hasSkip ? () => skipRef.current?.() : null }), [route, note, setSkip, hasSkip]);
  const text = routeToString(route);
  return (
    <LayerContext.Provider value={{ kind: 'exercise', route }}>
      <PlayerContext.Provider value={api}>
        <Notes route={route} onNote={setNote} />
        <ErrorBoundary
          scope={`ui:${route.name}`}
          detail={text}
          resetKey={`${text}#${attempt}`}
          fallback={() => (
            <ExerciseErrorNotice
              onSkip={
                hasSkip
                  ? () => {
                      skipRef.current?.();
                      setAttempt((n) => n + 1);
                    }
                  : null
              }
              onEnd={() => {
                holdResume();
                back();
              }}
            />
          )}
        >
          <PlayerBody route={route}>{children}</PlayerBody>
          {/* Nach den Kindern: Liegt in der Übung eine StepBoundary, verbraucht deren Probe den
              Schlüssel zuerst („Diese Aufgabe überspringen“); sonst greift diese Ebene. */}
          <CrashProbe name={route.name} />
        </ErrorBoundary>
      </PlayerContext.Provider>
    </LayerContext.Provider>
  );
}
