import { create } from 'zustand';
import { getWriter } from '../data';
import { useLive } from '../data/live';
import { logError } from '../platform/diagnostics';
import { toast } from '../ui/Toast';
import { translate } from '../i18n';
import { useSettings, type Lang, type Palette, type ThemeMode } from './settings';
import { WORK_MAX } from '../prompts/work';

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

/** Farbthema (M21): `app/profile.theme.p` wie in der alten App; `theme.m` bleibt unberührt (verschmolzen). */
export async function changePalette(palette: Palette): Promise<void> {
  const s = useSettings.getState();
  const prev = s.palette;
  if (prev === palette) return;
  s.setPaletteLocal(palette);
  await persist({ theme: { p: palette } }, () => useSettings.getState().setPaletteLocal(prev));
}

/** Beruflicher Kontext (M22): Freitext, Leerraum zusammengefasst, höchstens 400 Zeichen. */
export function normCtx(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, WORK_MAX);
}

/** Beruflichen Kontext in `app/profile.ctx` speichern (gelesen von prompts/work.ts). `false` = nicht gespeichert. */
export async function changeCtx(text: string): Promise<boolean> {
  const value = normCtx(text);
  const current = useLive.getState().docs['app/profile'];
  if (current && (typeof current.ctx === 'string' ? current.ctx : '') === value) return true;
  let ok = true;
  await persist({ ctx: value }, () => {
    ok = false;
  });
  return ok;
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

type Optimistic = Partial<Record<'goalMin' | 'newPerDay' | 'sound', number | boolean>> & { canDo?: Record<string, string | null> };
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
