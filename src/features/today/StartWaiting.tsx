import { useEffect } from 'react';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { IconButton } from '../../ui/Button';
import { useC1xReady } from '../c1x/ready';
import { cancelPendingStart, noteTaskVisible, runPendingStart, usePendingStart } from './startRun';
import { useToday } from './state';

// Wartender Start (Relaunch P6, stufe1-plan §4.3 Nr. 7): Der Übungsrahmen steht als Skelett, sobald getippt wurde; die erste Aufgabe beginnt von
// selbst, wenn alles da ist. Kein Zeitgeber, keine Schleife: Der Läufer reagiert nur auf Änderungen von Tagesstand, Rahmen und gepackten Inhalten.

/** Skelett des Übungsrahmens: Kopf mit ✕ und Fortschritt, Aufgabensatz, Lücke, Knopf unten. */
function WaitingFrame({ onCancel }: { onCancel: () => void }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg" role="status" aria-label={t('stWaiting')} data-testid="start-waiting">
      <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex min-h-11 items-center gap-3">
          <IconButton icon="close" label={t('stWaitingCancel')} onClick={onCancel} data-testid="start-waiting-cancel" />
          <div className="lx-skeleton h-1.5 flex-1 rounded-full" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-3 pt-6" aria-hidden="true">
          <div className="lx-skeleton h-3 w-28" />
          <div className="lx-skeleton h-7 w-11/12" />
          <div className="lx-skeleton h-7 w-3/4" />
          <div className="lx-skeleton mt-4 h-12 w-2/5 rounded-[0.875rem]" />
        </div>
        <div className="lx-skeleton mt-auto min-h-14 rounded-full" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Läufer im Rahmen: `active` = die App zeigt schon Bildschirme (kein Laden, keine Umstellung). `system` = Systemzustand ohne Weg zur Aufgabe
 * (keine Datenbank, offline, Umstellung) → Warten beenden. `exercise` = eine Übungsebene ist sichtbar → Messpunkt `lx:first-task`.
 */
export function PendingStartRunner({ active, blocked, exercise }: { active: boolean; blocked: boolean; exercise: boolean }) {
  const api = useHiddenInput();
  const pending = usePendingStart((s) => s.pending);
  const view = useToday((s) => s);
  const c1x = useC1xReady();
  useEffect(() => {
    if (!pending) return;
    if (blocked) {
      cancelPendingStart(api);
      return;
    }
    if (active) runPendingStart(api);
  }, [pending, active, blocked, view, c1x, api]);
  useEffect(() => {
    if (exercise) noteTaskVisible();
  }, [exercise]);
  return pending ? <WaitingFrame onCancel={() => cancelPendingStart(api)} /> : null;
}
