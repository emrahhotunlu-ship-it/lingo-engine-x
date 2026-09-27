import { local, KEY_PREFIX } from '../platform/storage';
import type { MessageKey } from '../i18n';
import type { Route } from './router/types';
import type { Place } from './shell/tabs';

// Fortsetzen nach Neuladen (docs/neubau/architektur.md §3.2) – WP0a: nur Vertrag und Speicher.
// Das Wiederherstellen (Laden beim Start, Zeile „Weiter, wo du warst“, Frische-Regel, Zeitgeber,
// pagehide-Flush) folgt in WP0b.
//
// Reine Bequemlichkeit (Kap. 3.1): Die Momentaufnahme liegt nur lokal. Antworten gehen wie bisher
// sofort in die db; `restore` schreibt NIE in die db.

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type Resumable<S> = {
  /** 'trainer', 'grammarSession', 'lesson', 'roleplay', 'read' … (Schlüssel `lx:resume:<id>`). */
  id: string;
  /** Schema der Momentaufnahme; anders → verwerfen. */
  version: number;
  /** Wo die Zeile „Weiter, wo du warst“ erscheint. */
  origin: Place;
  /** Reiner Lesezugriff auf den Sitzungs-Store (JSON, ≤ 50 KB); `null` = nichts zu sichern. */
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

/** Obergrenze je Momentaufnahme (§3.2: ≤ 50 KB). */
export const RESUME_MAX_BYTES = 50_000;

const keyOf = (id: string) => `${RESUME_PREFIX}${id}`;

/** Speichert eine Hülle; zu große oder nicht speicherbare Momentaufnahmen werden nicht geschrieben. */
export function saveResume<S>(env: ResumeEnvelope<S>): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(env);
  } catch {
    return false;
  }
  if (raw.length > RESUME_MAX_BYTES) return false;
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
