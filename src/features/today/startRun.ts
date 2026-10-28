import { create } from 'zustand';
import { c1xReadyNow } from '../c1x/ready';
import { startDuty } from '../learn/flow';
import { startUnit } from '../unit/run';
import { unlockSpeech } from '../../platform/speech';
import { firstOpenDuty, todayNow, type TodayView } from './state';
import { markStart } from './startPerf';

// Wartender Start (Relaunch Stufe 1 P6, stufe1-plan §4.3 Nr. 7): Ein Tipp auf den Start-Knopf, bevor der Plan steht, öffnet SOFORT den
// Übungsrahmen als Skelett (`StartWaiting`); die erste Aufgabe beginnt von selbst, sobald Plan, Tagesprotokoll und gepackte Inhalte da sind.
// Welcher Block beginnt, entscheidet der BERECHNETE Plan (`startUnit` → erster offener Block); `go` aus `app/today` ist nur die Beschriftung.
// iPhone: Der Fokus auf das versteckte Eingabefeld wird SYNCHRON im Tipp gesetzt und gehalten, bis die Aufgabe steht (sie fokussiert oder löst ihn).

/** Die Schnittstelle des versteckten Eingabefelds, soweit der Start sie braucht. */
export type StartApi = { focusNow: () => void; blur: () => void };

type Pending = {
  /** Ein Start wartet auf den Plan. */
  pending: boolean;
  /** In diesem Seitenladen wurde gestartet (für den Messpunkt `lx:first-task`). */
  started: boolean;
};

export const usePendingStart = create<Pending>(() => ({ pending: false, started: false }));

/** Kann jetzt sofort eine Aufgabe beginnen? (Plan steht, Tagesprotokoll geladen, gepackte Inhalte bereit.) */
export function startReady(view: Pick<TodayView, 'ready' | 'dayLoaded'>): boolean {
  return view.ready && view.dayLoaded && c1xReadyNow();
}

/** Start nach dem berechneten Plan: Block der Einheit, sonst der erste offene Pflichtpunkt (alter Plan). `false` = nichts zu starten. */
function launch(api: StartApi, view: TodayView): boolean {
  if (view.status === 'allDone' || view.status === 'nothing') return false;
  if (startUnit(api)) return true;
  const id = firstOpenDuty(view);
  if (!id) return false;
  startDuty(id, api);
  return true;
}

/**
 * Tipp auf den Start-Knopf (SYNCHRON im Klick). `frame`: Der Rahmen zeigt schon die echte Heute-Ansicht (keine Systemansicht). Steht alles,
 * beginnt die Aufgabe sofort (wie bisher); sonst Fokus halten und warten (`PendingStartRunner`).
 */
export function requestStart(api: StartApi, frame: boolean): void {
  unlockSpeech();
  usePendingStart.setState({ started: true });
  const view = todayNow();
  if (frame && startReady(view)) {
    launch(api, view);
    return;
  }
  api.focusNow();
  usePendingStart.setState({ pending: true });
}

/**
 * Aus dem Läufer (`PendingStartRunner`, nach jeder Änderung des Tagesstands): Steht jetzt alles, die wartende Aufgabe beginnen. Liefert, ob
 * der wartende Start erledigt ist (begonnen oder nichts mehr zu tun).
 */
export function runPendingStart(api: StartApi): boolean {
  if (!usePendingStart.getState().pending) return true;
  const view = todayNow();
  if (view.planStatus === 'error') {
    cancelPendingStart(api);
    return true;
  }
  if (!startReady(view)) return false;
  usePendingStart.setState({ pending: false });
  if (!launch(api, view)) api.blur();
  return true;
}

/** ✕ im wartenden Rahmen bzw. Systemzustand (keine Datenbank, Umstellung): Warten beenden, Tastatur schließen. */
export function cancelPendingStart(api: StartApi): void {
  if (!usePendingStart.getState().pending) return;
  usePendingStart.setState({ pending: false });
  api.blur();
}

/** Die erste Aufgabe steht (Übungsebene sichtbar) nach einem Start in diesem Seitenladen. */
export function noteTaskVisible(): void {
  if (usePendingStart.getState().started) markStart('lx:first-task');
}

/** Nur für Tests. */
export function resetPendingStartForTests(): void {
  usePendingStart.setState({ pending: false, started: false }, true);
}
