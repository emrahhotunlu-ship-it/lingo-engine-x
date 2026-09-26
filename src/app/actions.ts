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
