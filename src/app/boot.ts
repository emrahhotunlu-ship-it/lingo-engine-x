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
import { bootAreas, kindOf, screenOf } from './registry';
import { loadTodayDoc } from '../data/todayDoc';
import { routeFromHash } from './router/deeplink';
import type { RouteName } from './router/types';
import { applyDocumentSettings, isAccent, isLang, isThemeMode, resolveTheme, useSettings } from './settings';
import { settingsWritePending } from './actions';
import { useDocTotal } from '../features/capacity/docTotal';
import { useC1xReady } from '../features/c1x/ready';
import { loadActs } from '../features/vocab/actStore';

// Start des App-Rahmens (aus App.tsx verschoben, unverändert): Fähigkeiten starten, Daten genau
// einmal abonnieren, Einstellungen anwenden, Tagesplan je Lerntag festlegen. Dazu die einmaligen
// Installationen der Bereiche (`defineArea({ boot })`) und der Deep-Link `#go=` (einmal gelesen).

export function useBoot(): void {
  const dbStatus = useCapabilities((s) => s.db);

  useEffect(() => {
    initCapabilities();
  }, []);
  // Dokumenten-Wächter (Prüfbefund S8): Gesamtzahl für die Sperre neuer Karten.
  useDocTotal();

  useEffect(() => {
    if (dbStatus !== 'ready') return;
    const db = getDb();
    if (!db) return;
    // Relaunch P6 (stufe1-plan §4.3 Nr. 3): ZUERST das kleine Startbild `app/today` mit einem einzelnen `get` – Heute zeichnet daraus Ring und
    // Knopf, während die großen Abos noch laden. Nie abonniert.
    loadTodayDoc(db);
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

  // Sammelakte der Aktivierungen (`act/<Monat>`, Wörter aktivieren Stufe 2): die letzten drei Monate einmal je Lerntag lesen. Der Rundenbau ist synchron und
  // nimmt, was geladen ist (frühere eigene Sätze als Quelle und für die Neuheitsprüfung, „einsatzbereit“); ohne sie läuft alles wie sonst.
  useEffect(() => {
    if (dbStatus !== 'ready') return;
    void loadActs(today);
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
    // Akzent (Relaunch P1): `theme.a`; fehlt es, bleibt die lokale Wahl (Standard Iris). Das alte `theme.p` wird nur noch mitgetragen.
    const accent = profile.theme && typeof profile.theme === 'object' ? (profile.theme as { a?: unknown }).a : undefined;
    if (isAccent(accent) && accent !== s.accent) s.setAccentLocal(accent);
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
  const accent = useSettings((s) => s.accent);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => applyDocumentSettings(lang, resolveTheme(theme, mq.matches), accent);
    apply();
    if (theme !== 'auto') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [lang, theme, accent]);
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
  const overlay = useNav((s) => s.overlay !== null);
  // Gepackte c1x-Inhalte (nur wenn eine Aufgabenart eingeschaltet ist): der Rundenbau ist synchron und liest nur, was geladen ist.
  const c1xReady = useC1xReady();
  if (db === 'absent') return 'nodb';
  if (status === 'error') return 'offline';
  // Relaunch P6 (Nr. 6): kein globales Warten mehr auf alles. „Rahmen bereit“ = Datenbank und Abos; die Reiter (Heute zuerst) erscheinen
  // ohne die gepackten c1x-Inhalte. „Bereich bereit“: Nur Übungen und Unterseiten (dort werden Aufgaben gebaut) warten auf sie.
  if (db === 'pending' || status !== 'ready') return 'loading';
  if (!c1xReady && (overlay || kindOf(route.name) !== 'tab')) return 'loading';
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

let deepLinkUsed = false;

/** Wurde beim Start ein Deep-Link angewandt? (Dann kein automatisches Fortsetzen.) */
export function deepLinkApplied(): boolean {
  return deepLinkUsed;
}

export function useDeepLink(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const route = readDeepLink(window.location.hash);
    if (!route) return;
    deepLinkUsed = true;
    useNav.getState().go(route);
  }, [active]);
}
