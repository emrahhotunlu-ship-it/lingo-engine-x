// Lernzeit (Lernplattform 3.0 P53, Motivation „Wenn-Dann-Plan“): eine Uhrzeit und ein Anker im Alltag, gespeichert in `app/profile.ii = {t: 'HH:MM', cue}`
// (< 100 Bytes). Ein Vorschlag, keine Bedingung: der ganze Lerntag bis 04:00 zählt weiter, Serie und Plan lesen das Feld nie.
// `cue` ist eine der festen Kennungen (in der Oberflächensprache angezeigt) oder ein eigener Text (≤ 40 Zeichen, unverändert angezeigt).

export type Ii = { t: string; cue: string };

/** Feste Anker (Reihenfolge der Chips): nach dem ersten Kaffee · in der Bahn · nach dem Mittag · vor Feierabend. */
export const CUE_IDS = ['coffee', 'train', 'lunch', 'evening'] as const;
export type CueId = (typeof CUE_IDS)[number];

export const CUE_MAX = 40;
/** Obergrenze des gespeicherten Felds (JSON, UTF-8). */
export const II_MAX_BYTES = 100;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isCueId = (v: string): v is CueId => (CUE_IDS as readonly string[]).includes(v);

/** Größe des Felds in Bytes, so wie es gespeichert wird. */
export const iiBytes = (ii: Ii): number => new TextEncoder().encode(JSON.stringify(ii)).length;

/** `7:5` / `07:05` / `7.30` → `07:05` / `07:30`; sonst `null`. */
export function normTime(raw: string): string | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(raw);
  if (!m) return null;
  const t = `${(m[1] ?? '').padStart(2, '0')}:${m[2] ?? ''}`;
  return HHMM.test(t) ? t : null;
}

/**
 * Sauberes Feld aus der Eingabe: gültige Uhrzeit, Anker gekürzt (Leerraum zusammengefasst, ≤ 40 Zeichen) und so weit gekürzt, dass das Feld unter
 * 100 Bytes bleibt (Umlaute und Sonderzeichen zählen mehrfach). Ohne gültige Uhrzeit `null`.
 */
export function cleanIi(time: string, cue: string): Ii | null {
  const t = normTime(time);
  if (!t) return null;
  let c = [...cue.replace(/\s+/g, ' ').trim()].slice(0, CUE_MAX);
  while (c.length && iiBytes({ t, cue: c.join('') }) >= II_MAX_BYTES) c = c.slice(0, -1);
  return { t, cue: c.join('').trim() };
}

/** Tolerant lesen: fremder Aufbau oder ungültige Uhrzeit → `null` (die Zeile fehlt dann einfach). */
export function readIi(profile: Readonly<Record<string, unknown>> | null | undefined): Ii | null {
  const raw = profile?.ii;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const t = typeof r.t === 'string' ? normTime(r.t) : null;
  if (!t) return null;
  const cue = typeof r.cue === 'string' ? r.cue.replace(/\s+/g, ' ').trim().slice(0, CUE_MAX) : '';
  return { t, cue };
}

/** Uhrzeit für die Anzeige: Deutsch `7:30`, Englisch im 12-Stunden-Format `7:30 AM`. */
export function formatTime(t: string, lang: 'de' | 'en'): string {
  const m = HHMM.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const min = m[2] ?? '00';
  if (lang === 'de') return `${h}:${min}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Schreib-Operation für `app/profile.ii`: geschrieben wird ausschließlich das Ergebnis von `cleanIi` (gültige Uhrzeit, Moment ≤ 40 Zeichen, < 100 Bytes)
 * oder `null` (Lernzeit entfernt). Ungültige Eingabe oder keine Änderung → `null` (kein Schreibvorgang).
 */
export function iiOp(cur: Readonly<Record<string, unknown>>, next: Ii | null): { update: { ii: Ii | null } } | null {
  const clean = next ? cleanIi(next.t, next.cue) : null;
  if (next && !clean) return null;
  if (JSON.stringify(cur.ii ?? null) === JSON.stringify(clean)) return null;
  return { update: { ii: clean } };
}
