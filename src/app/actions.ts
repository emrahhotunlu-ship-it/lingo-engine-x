import { create } from 'zustand';
import { getWriter } from '../data';
import { useLive } from '../data/live';
import { logError, logWarn } from '../platform/diagnostics';
import { toast } from '../ui/Toast';
import { ensureLang, hasLang, translate } from '../i18n';
import { useSettings, type Lang, type Accent, type ThemeMode } from './settings';
import { WORK_MAX } from '../prompts/work';
import { restDowOf, vacAdd, vacCancel } from '../domain/streak';

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
  // Großpaket C: Englisch wird erst jetzt geladen. Erst umschalten, wenn die Texte da sind (kein deutscher Zwischenstand); klappt das
  // Laden nicht, bleibt die Sprache und eine Meldung sagt es.
  await ensureLang(lang);
  if (!hasLang(lang)) {
    toast(translate(prev, 'saveFailed'), 'error');
    return;
  }
  useSettings.getState().setLangLocal(lang);
  await persist({ lang }, () => useSettings.getState().setLangLocal(prev));
}

export async function changeTheme(theme: ThemeMode): Promise<void> {
  const s = useSettings.getState();
  const prev = s.theme;
  if (prev === theme) return;
  s.setThemeLocal(theme);
  await persist({ theme: { m: theme } }, () => useSettings.getState().setThemeLocal(prev));
}

/** Akzent (Relaunch P1): `app/profile.theme.a`; `theme.m` und das alte `theme.p` bleiben unberührt (verschmolzen). */
export async function changeAccent(accent: Accent): Promise<void> {
  const s = useSettings.getState();
  const prev = s.accent;
  if (prev === accent) return;
  s.setAccentLocal(accent);
  await persist({ theme: { a: accent } }, () => useSettings.getState().setAccentLocal(prev));
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

// ------------------------------------------------------------------ Urlaub ankündigen (Großpaket B10)

/**
 * Liest, rechnet und schreibt `app/profile.vac` in EINEM Schritt (`writer.transform`, data-guard Sollte 3: kein Überschreiben zwischen zwei
 * Geräten). Ist `vac` vorhanden, aber keine Liste, wird nichts geschrieben (Sollte 2: nie fremde Inhalte überschreiben).
 */
async function writeVac(compute: (list: readonly unknown[]) => unknown[] | null): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let ok = false;
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur) return null;
      const v = cur.vac;
      if (v !== undefined && v !== null && !Array.isArray(v)) {
        logWarn('settings:vac', new Error('app/profile.vac ist keine Liste – nichts geschrieben'));
        return null;
      }
      const next = compute(Array.isArray(v) ? v : []);
      if (!next) return null;
      ok = true;
      return { update: { vac: next } };
    });
  } catch (err) {
    ok = false;
    logError('settings:vac', err);
    toast(translate(useSettings.getState().lang, 'saveFailed'), 'error');
  }
  return ok;
}

/** Urlaub eintragen (`app/profile.vac`, nur ergänzend; Regeln in `vacAdd`). `false` = nicht gespeichert (voll oder Fehler). */
export async function addVacation(from: string, to: string, today: string, nowMs: number): Promise<boolean> {
  return writeVac((list) => vacAdd(list, { from, to, t: nowMs }, today));
}

/** Urlaub aufheben: kommender bekommt `x`, laufender wird auf gestern gekürzt (`vacCancel`); nie gelöscht. */
export async function cancelVacation(t: number, today: string, nowMs: number): Promise<void> {
  await writeVac((list) => vacCancel(list, t, today, nowMs));
}

/** Ruhetag wählen (Großpaket B10): 1–7 oder `null` (frei). Nur ergänzend in `app/profile.restDow`. */
export async function changeRestDow(dow: number | null): Promise<void> {
  if (dow !== null && restDowOf(dow) === null) return;
  if ((useLive.getState().docs['app/profile']?.restDow ?? null) === dow) return;
  await persist({ restDow: dow }, () => undefined);
}
