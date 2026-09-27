import { create } from 'zustand';
import { getWriter } from '../data';
import { useLive } from '../data/live';
import { logError } from '../platform/diagnostics';
import { toast } from '../ui/Toast';
import { translate } from '../i18n';
import { useSettings, type Lang, type ThemeMode } from './settings';

// Einstellungen ändern: optimistisch sofort anzeigen, in `app/profile` speichern,
// bei Fehler zurückrollen (Kap. 3.4).

let pendingWrites = 0;

/** Läuft gerade ein Schreibvorgang für Einstellungen? Dann nicht vom Snapshot überschreiben lassen. */
export const settingsWritePending = (): boolean => pendingWrites > 0;

async function persist(patch: Record<string, unknown>, rollback: () => void): Promise<void> {
  const writer = getWriter();
  if (!writer) return;
  pendingWrites++;
  try {
    const current = useLive.getState().docs['app/profile'];
    await writer.patch('app/profile', patch, current);
  } catch (err) {
    logError('settings:save', err);
    rollback();
    toast(translate(useSettings.getState().lang, 'saveFailed'), 'error');
  } finally {
    pendingWrites--;
  }
}

export async function changeLang(lang: Lang): Promise<void> {
  const s = useSettings.getState();
  const prev = s.lang;
  if (prev === lang) return;
  s.setLangLocal(lang);
  await persist({ lang }, () => useSettings.getState().setLangLocal(prev));
}

export async function changeTheme(theme: ThemeMode): Promise<void> {
  const s = useSettings.getState();
  const prev = s.theme;
  if (prev === theme) return;
  s.setThemeLocal(theme);
  await persist({ theme: { m: theme } }, () => useSettings.getState().setThemeLocal(prev));
}

/** „Automatisch weiter" nach richtiger Antwort (Funktionsabgleich M6), gespeichert in `app/profile.autoNext`. */
export async function changeAutoNext(on: boolean): Promise<void> {
  const current = useLive.getState().docs['app/profile'];
  if (current && current.autoNext === on) return;
  await persist({ autoNext: on }, () => undefined);
}

// ---------------------------------------------------------------- Phase 6 (Plan §9, E11, E12, E16)
// Werte ohne lokale Kopie: angezeigt wird der Live-Stand des Profils; `optimistic` hält den
// neuen Wert bis zur Bestätigung, bei Fehler fällt die Anzeige auf den gespeicherten Wert zurück.

type Optimistic = Partial<Record<'goalMin' | 'newPerDay' | 'sound' | 'haptic', number | boolean>> & { canDo?: Record<string, string | null> };
export const useOptimistic = create<Optimistic>(() => ({}));

async function persistField(patch: Record<string, unknown>, show: Optimistic, clear: () => void): Promise<void> {
  useOptimistic.setState(show);
  try {
    await persist(patch, () => undefined);
  } finally {
    clear();
  }
}

export async function changeGoalMin(min: number): Promise<void> {
  if (useLive.getState().docs['app/profile']?.goalMin === min) return;
  await persistField({ goalMin: min }, { goalMin: min }, () => useOptimistic.setState({ goalMin: undefined }));
}

export async function changeNewPerDay(n: number): Promise<void> {
  if (useLive.getState().docs['app/profile']?.newPerDay === n) return;
  await persistField({ newPerDay: n }, { newPerDay: n }, () => useOptimistic.setState({ newPerDay: undefined }));
}

export async function changeSound(on: boolean): Promise<void> {
  if (useLive.getState().docs['app/profile']?.sound === on) return;
  await persistField({ sound: on }, { sound: on }, () => useOptimistic.setState({ sound: undefined }));
}

export async function changeHaptic(on: boolean): Promise<void> {
  const cur = useLive.getState().docs['app/profile']?.haptic;
  if ((cur !== false) === on) return;
  await persistField({ haptic: on }, { haptic: on }, () => useOptimistic.setState({ haptic: undefined }));
}

/** Can-Do selbst markieren (`profile.canDo[<cefrId>] = Lerntag`) bzw. aufheben (`null`, nie gelöscht). */
export async function toggleCanDo(id: string, on: boolean, day: string): Promise<void> {
  const value = on ? day : null;
  await persistField({ canDo: { [id]: value } }, { canDo: { ...(useOptimistic.getState().canDo ?? {}), [id]: value } }, () =>
    useOptimistic.setState((s) => {
      const next = { ...(s.canDo ?? {}) };
      delete next[id];
      return { canDo: next };
    }),
  );
}
