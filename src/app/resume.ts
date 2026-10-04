import { useEffect } from 'react';
import { create } from 'zustand';
import { local, KEY_PREFIX } from '../platform/storage';
import { logError, logWarn } from '../platform/diagnostics';
import type { MessageKey } from '../i18n';
import type { Route } from './router/types';
import type { Place } from './shell/tabs';

// Fortsetzen nach Neuladen (docs/neubau/architektur.md §3.2, plan.md §0 „Fortsetzen“, N04).
//
// Reine Bequemlichkeit (Kap. 3.1): Die Momentaufnahme liegt nur lokal, als IDs und Positionen.
// Antworten gehen wie bisher sofort in die db; `restore` schreibt NIE in die db.
//
// Regel (plan.md §0, ersetzt die 30-Minuten-Regel aus architektur.md §3.2):
// - `lx:resume` zeigt auf die EINE offene Tätigkeit, `lx:resume:<id>` hält ihre Momentaufnahme.
// - Liegt der letzte Schritt weniger als 2 Min. zurück, öffnet der Rahmen die Übung nach dem
//   Neuladen direkt an derselben Stelle (typisch: Safari hat den Tab verworfen, neue Version).
// - Sonst steht am gleichen Lerntag bis zu 6 Std. lang die Zeile „Weitermachen: …“ auf Heute und
//   am Herkunftsplatz (`ResumeRow`). Ein Tipp stellt SYNCHRON her (iPhone-Tastatur).
// - Fremder Lerntag (Wechsel um 04:00), andere `version`, unbekannte Übung oder `restore() === false`
//   → verwerfen. Das reguläre Ende (Momentaufnahme `null`) löscht; ✕ behält (`holdResume`).
//
// Die Pakete liefern je Übung einen `Resumable` (in `defineArea({ resumables })`); der Rahmen
// abonniert ihn, speichert 300 ms nach jeder Änderung und sofort bei `pagehide`/`hidden`.

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type Resumable<S> = {
  /** 'trainer', 'grammarSession', 'lesson', 'roleplay', 'read' … (Schlüssel `lx:resume:<id>`). */
  id: string;
  /** Schema der Momentaufnahme; anders → verwerfen. */
  version: number;
  /** Wo die Zeile „Weiter, wo du warst“ erscheint (zusätzlich immer auf Heute). */
  origin: Place;
  /** Reiner Lesezugriff auf den Sitzungs-Store (JSON, ≤ 50 KB); `null` = nichts (mehr) zu sichern. */
  snapshot(): S | null;
  /** Meist `useX.subscribe`. */
  subscribe(cb: () => void): () => void;
  /** SYNCHRON (Klick-Handler, iPhone-Tastatur); schreibt nie in db. `false` = verwerfen. */
  restore(s: S): boolean;
  /** Ziel beim Fortsetzen. */
  route(s: S): Route;
  /** „Stapel ‚Beruf‘ · Karte 23 von 40“. */
  label(s: S, t: T): string;
};

/** Hülle im Speicher: `lx:resume:<id>`. */
export type ResumeEnvelope<S = unknown> = {
  v: number;
  id: string;
  /** Lerntag (Wechsel um 04:00) – ein fremder Tag wird verworfen. */
  day: string;
  savedAt: number;
  /** Tab-Kennung (`lx:tab`), für „In einem anderen Fenster geöffnet“. */
  tabId: string;
  route: Route;
  data: S;
};

export const RESUME_PREFIX = `${KEY_PREFIX}resume:`;
/** Zeiger auf die eine offene Tätigkeit: `{ v: 1, id, day, at }`. */
export const RESUME_POINTER = `${KEY_PREFIX}resume`;

/** Obergrenze je Momentaufnahme (§3.2: ≤ 50 KB). */
export const RESUME_MAX_BYTES = 50_000;
/** Automatisch zurück, wenn der letzte Schritt jünger ist (plan.md §0). */
export const RESUME_AUTO_MS = 2 * 60_000;
/** Zeile „Weitermachen“ höchstens so lange (am gleichen Lerntag). */
export const RESUME_ROW_MS = 6 * 60 * 60_000;
/** Speichern nach jeder Änderung (entprellt). */
export const RESUME_DEBOUNCE_MS = 300;

const keyOf = (id: string) => `${RESUME_PREFIX}${id}`;

/** Speichert eine Hülle; zu große oder nicht speicherbare Momentaufnahmen werden nicht geschrieben. */
export function saveResume<S>(env: ResumeEnvelope<S>): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(env);
  } catch (err) {
    logWarn('resume:save', err, env.id);
    return false;
  }
  if (raw.length > RESUME_MAX_BYTES) {
    logWarn('resume:save', { message: `Momentaufnahme zu groß (${raw.length} B)` }, env.id);
    return false;
  }
  return local.set(keyOf(env.id), raw);
}

function isEnvelope(x: unknown): x is ResumeEnvelope {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.v === 'number' &&
    typeof e.id === 'string' &&
    typeof e.day === 'string' &&
    typeof e.savedAt === 'number' &&
    typeof e.tabId === 'string' &&
    !!e.route &&
    typeof e.route === 'object' &&
    typeof (e.route as { name?: unknown }).name === 'string' &&
    'data' in e
  );
}

/** Liest eine Hülle; unlesbare oder fremd geformte Einträge ergeben `null`. */
export function loadResume(id: string): ResumeEnvelope | null {
  const env = local.getJson<unknown>(keyOf(id));
  return isEnvelope(env) && env.id === id ? env : null;
}

export function clearResume(id: string): void {
  local.remove(keyOf(id));
  const p = readPointer();
  if (p?.id === id) local.remove(RESUME_POINTER);
}

/** Alle gespeicherten Hüllen (jüngste zuerst). */
export function listResumes(): ResumeEnvelope[] {
  return local
    .keys()
    .filter((k) => k.startsWith(RESUME_PREFIX))
    .map((k) => loadResume(k.slice(RESUME_PREFIX.length)))
    .filter((e): e is ResumeEnvelope => e !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

type Pointer = { v: 1; id: string; day: string; at: number };

function readPointer(): Pointer | null {
  const p = local.getJson<unknown>(RESUME_POINTER);
  if (!p || typeof p !== 'object') return null;
  const r = p as Record<string, unknown>;
  return r.v === 1 && typeof r.id === 'string' && typeof r.day === 'string' && typeof r.at === 'number' ? { v: 1, id: r.id, day: r.day, at: r.at } : null;
}

// ---------------------------------------------------------------- Laufzeit

export type ResumeDeps = {
  // Die Momentaufnahme ist je Übung verschieden (Typ je Vertrag).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list: () => ReadonlyArray<Resumable<any>>;
  now: () => number;
  /** Aktueller Lerntag (Wechsel um 04:00). */
  day: () => string;
  /** Kennung dieses Browser-Tabs (`lx:tab`). */
  tabId: () => string;
};

/** Offene Tätigkeit, wie sie Heute und der Herkunftsplatz anbieten. */
export type PendingResume = {
  env: ResumeEnvelope;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resumable: Resumable<any>;
  /** Alter des letzten Schritts in ms. */
  age: number;
  /** Momentaufnahme aus einem anderen Tab. */
  otherTab: boolean;
};

type ResumeState = { pending: PendingResume | null; rev: number };

/** Anzeige-Zustand (Zeile „Weitermachen“). */
export const useResume = create<ResumeState>(() => ({ pending: null, rev: 0 }));

let deps: ResumeDeps | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Mit ✕ verlassene Sitzungen: ein anschließendes `null` löscht die Momentaufnahme nicht. */
const held = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function byId(id: string): Resumable<any> | null {
  return deps?.list().find((r) => r.id === id) ?? null;
}

/** Sofort speichern (oder löschen, wenn die Sitzung regulär zu Ende ist). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveNow(r: Resumable<any>): boolean {
  if (!deps) return false;
  const t = timers.get(r.id);
  if (t) {
    clearTimeout(t);
    timers.delete(r.id);
  }
  let snap: unknown;
  try {
    snap = r.snapshot();
  } catch (err) {
    logError('resume:snapshot', err, r.id);
    return false;
  }
  if (snap === null || snap === undefined) {
    if (held.has(r.id)) return false;
    if (loadResume(r.id)) {
      clearResume(r.id);
      refreshPending();
    }
    return false;
  }
  held.delete(r.id);
  let route: Route;
  try {
    route = r.route(snap);
  } catch (err) {
    logError('resume:route', err, r.id);
    return false;
  }
  const now = deps.now();
  const day = deps.day();
  const ok = saveResume({ v: r.version, id: r.id, day, savedAt: now, tabId: deps.tabId(), route, data: snap });
  if (ok) local.set(RESUME_POINTER, JSON.stringify({ v: 1, id: r.id, day, at: now } satisfies Pointer));
  refreshPending();
  return ok;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function schedule(r: Resumable<any>): void {
  const prev = timers.get(r.id);
  if (prev) clearTimeout(prev);
  timers.set(
    r.id,
    setTimeout(() => {
      timers.delete(r.id);
      saveNow(r);
    }, RESUME_DEBOUNCE_MS),
  );
}

/** Alle ausstehenden Speichervorgänge sofort ausführen (`pagehide`, `hidden`). */
export function flushResume(): void {
  for (const id of [...timers.keys()]) {
    const r = byId(id);
    if (r) saveNow(r);
  }
}

/**
 * ✕ in der Übungsleiste: jetzige Momentaufnahmen sofort sichern und behalten, auch wenn die
 * Übung ihren Store beim Schließen leert. `true` = etwas wurde gesichert (Toast „Gespeichert …“).
 */
export function holdResume(): boolean {
  if (!deps) return false;
  let any = false;
  for (const r of deps.list()) {
    let snap: unknown = null;
    try {
      snap = r.snapshot();
    } catch (err) {
      logError('resume:snapshot', err, r.id);
    }
    if (snap === null || snap === undefined) continue;
    if (saveNow(r)) {
      held.add(r.id);
      any = true;
    }
  }
  return any;
}

/**
 * Die offene Tätigkeit laut `lx:resume` – geprüft auf Lerntag, Version, bekannte Übung und
 * Höchstalter. Ungültiges wird dabei aufgeräumt.
 */
export function pendingResume(): PendingResume | null {
  if (!deps) return null;
  const p = readPointer();
  if (!p) return null;
  const env = loadResume(p.id);
  const r = byId(p.id);
  const now = deps.now();
  const day = deps.day();
  if (!env || !r || env.day !== day || env.v !== r.version || now - env.savedAt > RESUME_ROW_MS) {
    // Verwerfen: fremder Lerntag, andere Version, unbekannte Übung oder zu alt.
    if (env && r) clearResume(p.id);
    else local.remove(RESUME_POINTER);
    if (env && !r) local.remove(keyOf(p.id));
    return null;
  }
  return { env, resumable: r, age: Math.max(0, now - env.savedAt), otherTab: env.tabId !== deps.tabId() };
}

/**
 * P1 (Tageseinheit): Sitzungen, die ein Block der Tageseinheit sind, bekommen keine eigene Zeile –
 * dort führt der Knopf der Tageskarte weiter (plan.md §1.3 Nr. 3). Das automatische Fortsetzen
 * (< 2 Min.) bleibt unberührt.
 */
let rowHidden: ((p: PendingResume) => boolean) | null = null;
export function setResumeRowHidden(fn: ((p: PendingResume) => boolean) | null): void {
  rowHidden = fn;
  if (deps) refreshPending();
}

function refreshPending(): void {
  const p = pendingResume();
  let hide = false;
  try {
    hide = !!p && !!rowHidden?.(p);
  } catch (err) {
    logWarn('resume:row', err, p?.env.id);
  }
  useResume.setState((s) => ({ pending: hide ? null : p, rev: s.rev + 1 }));
}

/** Wirft eine Momentaufnahme weg (z. B. „Nein“ beim anderen Fenster). */
export function discardResume(id: string): void {
  held.delete(id);
  clearResume(id);
  refreshPending();
}

/**
 * Stellt SYNCHRON her (Klick-Handler). `navigate` führt zur Übung (der Rahmen öffnet sie über der
 * Herkunft). `false` = nicht herstellbar; die Momentaufnahme ist dann verworfen.
 */
export function restorePending(p: PendingResume, navigate: (route: Route, origin: Place) => void): boolean {
  let ok: boolean;
  try {
    ok = p.resumable.restore(p.env.data);
  } catch (err) {
    logError('resume:restore', err, p.env.id);
    ok = false;
  }
  if (!ok) {
    discardResume(p.env.id);
    return false;
  }
  held.delete(p.env.id);
  let route: Route = p.env.route;
  try {
    route = p.resumable.route(p.env.data);
  } catch (err) {
    logWarn('resume:route', err, p.env.id);
  }
  navigate(route, p.resumable.origin);
  refreshPending();
  return true;
}

/**
 * Für den Player: eine Übung ohne aktive Sitzung (z. B. nach Deep-Link) aus ihrer Momentaufnahme
 * herstellen, wenn es eine vom selben Lerntag gibt. Kein Navigieren.
 */
export function restoreFor(routeName: string): boolean {
  if (!deps) return false;
  for (const r of deps.list()) {
    const env = loadResume(r.id);
    if (!env || env.route.name !== routeName || env.day !== deps.day() || env.v !== r.version) continue;
    try {
      if (r.restore(env.data)) {
        held.delete(r.id);
        return true;
      }
    } catch (err) {
      logError('resume:restore', err, r.id);
    }
    discardResume(r.id);
  }
  return false;
}

/**
 * Startet das Fortsetzen: abonniert alle `Resumable`, speichert entprellt und beim Verlassen der
 * Seite sofort, räumt Hüllen fremder Lerntage weg. Liefert die Abmeldung.
 */
export function installResume(next: ResumeDeps): () => void {
  deps = next;
  const day = next.day();
  for (const env of listResumes()) if (env.day !== day) clearResume(env.id);
  const unsubs = next.list().map((r) => {
    try {
      return r.subscribe(() => schedule(r));
    } catch (err) {
      logError('resume:subscribe', err, r.id);
      return () => undefined;
    }
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushResume();
  };
  const onPageHide = () => flushResume();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide);
  refreshPending();
  return () => {
    flushResume();
    unsubs.forEach((u) => u());
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    held.clear();
    deps = null;
    useResume.setState({ pending: null, rev: 0 });
  };
}

/**
 * Nach dem Start (App bereit, kein Deep-Link): Ist der letzte Schritt jünger als 2 Min. und aus
 * diesem Tab, geht es automatisch zurück an dieselbe Stelle. Einmal je Laden der Seite.
 */
let autoDone = false;
export function useAutoResume(active: boolean, navigate: (route: Route, origin: Place) => void, blocked: () => boolean = () => false): void {
  useEffect(() => {
    if (!active || autoDone) return;
    autoDone = true;
    if (blocked()) return;
    const p = pendingResume();
    if (p && p.age < RESUME_AUTO_MS && !p.otherTab) restorePending(p, navigate);
  }, [active, navigate, blocked]);
}

/** Nur für Tests: Laufzeit zurücksetzen. */
export function resetResumeRuntime(): void {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  held.clear();
  deps = null;
  autoDone = false;
  useResume.setState({ pending: null, rev: 0 });
}
