import { useEffect } from 'react';
import { getDb, initCapabilities, useCapabilities } from '../platform/capabilities';
import { startDayLive, startLive, useLive } from '../data/live';
import { ensureDay } from '../features/today/store';
import { initSpeech } from '../platform/speech';
import { setSoundEnabled } from '../platform/sound';
import { setHapticsEnabled } from '../platform/haptics';
import { normHaptic } from '../domain/progress/settings';
import { logWarn } from '../platform/diagnostics';
import { useClock, useClockTicker } from './clock';
import { useNav, type Route } from './nav';
import { bootAreas, screenOf } from './registry';
import { routeFromHash } from './router/deeplink';
import type { RouteName } from './router/types';
import { applyDocumentSettings, isLang, isPalette, isThemeMode, resolveTheme, useSettings } from './settings';
import { settingsWritePending } from './actions';

// Start des App-Rahmens (aus App.tsx verschoben, unverändert): Fähigkeiten starten, Daten genau
// einmal abonnieren, Einstellungen anwenden, Tagesplan je Lerntag festlegen. Dazu die einmaligen
// Installationen der Bereiche (`defineArea({ boot })`) und der Deep-Link `#go=` (einmal gelesen).

export function useBoot(): void {
  const dbStatus = useCapabilities((s) => s.db);

  useEffect(() => {
    initCapabilities();
  }, []);

  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startLive(db);
  }, [dbStatus]);

  // Tagesprotokoll log/<heute>: ein Abo je Lerntag, neu um 04:00.
  useClockTicker();
  const today = useClock((s) => s.today);
  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    return startDayLive(db, today);
  }, [dbStatus, today]);

  // Einmalige Installationen der Bereiche (heute: Sammel-Puffer beim Verlassen, Tastenkürzel).
  useEffect(() => {
    bootAreas();
  }, []);

  // Gespeicherte Einstellungen aus app/profile übernehmen (maßgeblich gegenüber localStorage).
  const profile = useLive((s) => s.docs['app/profile']);
  useEffect(() => {
    if (!profile || settingsWritePending()) return;
    const s = useSettings.getState();
    if (isLang(profile.lang) && profile.lang !== s.lang) s.setLangLocal(profile.lang);
    const theme = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { m?: unknown }).m : undefined;
    if (isThemeMode(theme) && theme !== s.theme) s.setThemeLocal(theme);
    // Farbthema (M21): `theme.p` der alten App; fehlt es, bleibt die lokale Wahl (Standard Salbei).
    const palette = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { p?: unknown }).p : undefined;
    if (isPalette(palette) && palette !== s.palette) s.setPaletteLocal(palette);
  }, [profile]);

  // Töne (Kap. 4.7): Einstellung aus dem Profil, Standard aus.
  const sound = profile?.sound === true;
  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  // Vibration (Kap. 4.3): Standard an, abschaltbar (`app/profile.haptic === false`).
  const hapticOn = normHaptic(profile?.haptic);
  useEffect(() => {
    setHapticsEnabled(hapticOn);
  }, [hapticOn]);

  // Sprachausgabe (en-US): Stimmen laden, Stimme und Tempo aus dem Profil (nur Lesen).
  const voice = typeof profile?.voice === 'string' ? profile.voice : null;
  const rate = typeof profile?.rate === 'number' ? profile.rate : null;
  useEffect(() => {
    initSpeech({ voice, rate });
  }, [voice, rate]);

  // Sprache und Modus auf <html> anwenden; „Automatisch" folgt dem System.
  const lang = useSettings((s) => s.lang);
  const theme = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => applyDocumentSettings(lang, resolveTheme(theme, mq.matches), palette);
    apply();
    if (theme !== 'auto') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [lang, theme, palette]);
}

export type SystemScreen = 'loading' | 'nodb' | 'offline' | 'migration';
export type Screen = SystemScreen | RouteName;

export const isSystemScreen = (s: Screen): s is SystemScreen => s === 'loading' || s === 'nodb' || s === 'offline' || s === 'migration';

/** Systemzustand (keine Route) oder der sichtbare Bildschirm. */
export function useScreen(): Screen {
  const route = useNav((s) => s.route);
  const db = useCapabilities((s) => s.db);
  const status = useLive((s) => s.status);
  const schema = useLive((s) => s.docs['app/schema']);
  const schemaInvalid = useLive((s) => 'app/schema' in s.invalid);
  if (db === 'absent') return 'nodb';
  if (status === 'error') return 'offline';
  if (db === 'pending' || status !== 'ready') return 'loading';
  const migrated = !!schema && !schemaInvalid && typeof schema.version === 'number' && schema.version >= 1;
  return migrated ? route.name : 'migration';
}

/** Tagesplan einmal je Lerntag festlegen – sobald die Daten da sind und die Seite sichtbar ist. */
export function useEnsureDay(active: boolean): void {
  const today = useClock((s) => s.today);
  useEffect(() => {
    if (!active) return;
    const run = () => {
      if (document.visibilityState === 'visible') void ensureDay(useClock.getState().now);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [active, today]);
}

let deepLinkRead = false;

/** Liest `#go=<route>` genau einmal, sobald die App bereit ist (nie geschrieben, kein History-Eintrag). */
export function readDeepLink(hash: string): Route | null {
  if (deepLinkRead) return null;
  deepLinkRead = true;
  if (!hash.includes('go=')) return null;
  const route = routeFromHash(hash, (name) => screenOf(name as RouteName));
  if (!route) logWarn('nav:deeplink', `unbekannt: ${hash.slice(0, 120)}`);
  return route;
}

export function useDeepLink(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const route = readDeepLink(window.location.hash);
    if (route) useNav.getState().go(route);
  }, [active]);
}
