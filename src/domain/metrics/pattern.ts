import { daysBetween } from '../date';
import type { PatState } from '../plan/types';

// Zustand eines Grammatik-MUSTERS (Lernplattform 2.0 §4.9): Neu · Lernt · Sicher · Fest. Die EINZIGE Stelle, die ihn berechnet
// (`write.ts` schreibt nur die Rohwerte, Heute, Themenblatt, Fortschritt und Abschlusskarte lesen von hier). Rein, nichts wird gespeichert.
//
// Eintrag `grammar/<thema>.pats[muster]` (Datenregeln §8, ≤ 12 Einträge, < 2 KB), Bedeutung der Felder:
//   n   Antworten insgesamt · c richtige · last Zeitpunkt der letzten Antwort (ms) · h Antworten mit Hilfe
//   r   die letzten 5 Ergebnisse als Bits, Bit 0 = das neueste, 1 = richtig ohne Hilfe · k Zahl der gültigen Bits (0 bis 5)
//   dd  höchstens 2 verschiedene Lerntage mit „richtig ohne Hilfe“ (die jüngsten) · s erster Lerntag mit Zustand „Sicher“ · i Einführungstag
// `patPush` ist die eine Schreibregel dazu (P5 ruft sie auf), damit Lesen und Schreiben dieselbe Kodierung haben.

export type PatEntry = {
  n?: number;
  c?: number;
  last?: number;
  h?: number;
  r?: number;
  k?: number;
  dd?: string[];
  s?: string;
  i?: string;
  /** V1: die Formen der letzten Antworten (Aufgabenart, höchstens 4, kommagetrennt, die neueste zuletzt), z. B. `ocl,kwt,err`. */
  f?: string;
};

export type PatternState = 'new' | 'learning' | 'safe' | 'firm';
export const PATTERN_STATES: readonly PatternState[] = ['new', 'learning', 'safe', 'firm'];
const ORDER: Record<PatternState, number> = { new: 0, learning: 1, safe: 2, firm: 3 };

/** Schwellen (Plan §4.9): Sicher = mindestens 2 von den letzten 3 richtig ohne Hilfe an mindestens 2 Tagen; Fest = Sicher seit mindestens 21 Tagen. */
export const SAFE_OF_LAST = 3;
export const SAFE_NEED = 2;
export const SAFE_DAYS = 2;
export const FIRM_SINCE_DAYS = 21;
export const BITS_MAX = 5;
export const DD_MAX = 2;

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (v: unknown): string | null => (typeof v === 'string' && DAY.test(v) ? v : null);

/** Eintrag tolerant lesen (nur Zahlen und Tagesschlüssel, alles andere fällt weg). */
export function readPatEntry(v: unknown): PatEntry | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const dd = Array.isArray(o.dd) ? o.dd.map(dayOf).filter((d): d is string => d !== null).slice(0, DD_MAX) : [];
  const out: PatEntry = { n: num(o.n), c: num(o.c), last: num(o.last), h: num(o.h), r: Math.max(0, Math.floor(num(o.r))) & 31, k: Math.min(BITS_MAX, Math.max(0, Math.floor(num(o.k)))), dd };
  const s = dayOf(o.s);
  if (s) out.s = s;
  const i = dayOf(o.i);
  if (i) out.i = i;
  if (typeof o.f === 'string' && /^[a-z0-9_]+(,[a-z0-9_]+){0,3}$/.test(o.f)) out.f = o.f;
  return out;
}

const bit = (e: PatEntry, k: number): boolean => (num(e.r) >> k) % 2 === 1;

/** Ist der Zustand „Sicher“ (ohne die 21-Tage-Regel) im Moment erfüllt? */
function safeNow(e: PatEntry): boolean {
  const k = Math.min(num(e.k), SAFE_OF_LAST);
  if (k < SAFE_NEED) return false;
  let ok = 0;
  for (let b = 0; b < k; b++) if (bit(e, b)) ok++;
  return ok >= SAFE_NEED && (e.dd?.length ?? 0) >= SAFE_DAYS;
}

/**
 * Neu: kein Eintrag, keine Antwort · Sicher: von den letzten 3 Ergebnissen mindestens 2 richtig ohne Hilfe, an mindestens 2 Tagen ·
 * Fest: Sicher, mindestens 21 Tage seit dem ersten „Sicher“ (`s`) und das letzte Ergebnis richtig · sonst Lernt.
 * Zwei falsche in Folge setzen Sicher und Fest auf Lernt zurück (`s` bleibt stehen).
 */
export function patternState(e: PatEntry | undefined, today: string): PatternState {
  if (!e || num(e.n) <= 0) return 'new';
  const k = num(e.k);
  if (k >= 2 && !bit(e, 0) && !bit(e, 1)) return 'learning';
  if (!safeNow(e)) return 'learning';
  if (e.s && daysBetween(e.s, today) >= FIRM_SINCE_DAYS && k >= 1 && bit(e, 0)) return 'firm';
  return 'safe';
}

export const patternStateNo = (s: PatternState): PatState => ORDER[s] as PatState;

/**
 * Antwort in den Eintrag buchen: Zähler, die 5 Bits, die jüngsten 2 Tage „richtig ohne Hilfe“, der erste Tag „Sicher“ (`s`).
 * `ok` = richtig, `help` = mit Hilfe (Tipp, Stütze, zweiter Versuch). Ein Ergebnis zählt nur ohne Hilfe als richtig. Liefert einen neuen Eintrag.
 */
export const FORMS_MAX = 4;
/** Die letzten Formen eines Musters (neueste zuletzt), tolerant gelesen. */
export const formsOfPat = (e: PatEntry | undefined): string[] => (e?.f ? e.f.split(',') : []);

export function patPush(e: PatEntry | undefined, a: { ok: boolean; help: boolean; day: string; t: number; form?: string }): PatEntry {
  const cur = readPatEntry(e) ?? { n: 0, c: 0, h: 0, r: 0, k: 0, dd: [] };
  const clean = a.ok && !a.help;
  const r = (((num(cur.r) << 1) | (clean ? 1 : 0)) & 31) >>> 0;
  const k = Math.min(BITS_MAX, num(cur.k) + 1);
  const dd = clean && !(cur.dd ?? []).includes(a.day) ? [...(cur.dd ?? []), a.day].sort().slice(-DD_MAX) : [...(cur.dd ?? [])];
  const next: PatEntry = { ...cur, n: num(cur.n) + 1, c: num(cur.c) + (a.ok ? 1 : 0), h: num(cur.h) + (a.help ? 1 : 0), last: a.t, r, k, dd };
  if (!next.s && safeNow(next)) next.s = a.day;
  if (a.form && /^[a-z0-9_]+$/.test(a.form)) next.f = [...formsOfPat(cur), a.form].slice(-FORMS_MAX).join(',');
  return next;
}

type Doc = Readonly<Record<string, unknown>>;

/** Die Muster-Einträge eines Themas-Dokuments. */
export function patsOf(doc: Doc | undefined): Record<string, PatEntry> {
  const raw = doc?.pats;
  const out: Record<string, PatEntry> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = readPatEntry(v);
    if (e) out[id] = e;
  }
  return out;
}

/**
 * Zustand eines Themas aus seinen Mustern; `null`, wenn das Dokument noch keine `pats` hat (dann gilt allein die p-Regel, `metrics/grammar`).
 * Ein Thema ist höchstens „Sicher“, wenn jedes Muster mindestens „Lernt“ ist: Fehlt ein Muster oder ist es Neu, ist das Thema „Lernt“.
 * `allPats` (Muster-IDs des Themas, aus der Musterdatei) zählt auch nie geübte Muster mit.
 */
export function topicStateFromPatterns(topic: string, doc: Doc | undefined, today: string, allPats?: readonly string[]): PatternState | null {
  void topic;
  const entries = patsOf(doc);
  if (!Object.keys(entries).length) return null;
  const ids = allPats?.length ? [...new Set([...allPats, ...Object.keys(entries)])] : Object.keys(entries);
  const states = ids.map((id) => patternState(entries[id], today));
  if (states.every((s) => s === 'new')) return 'new';
  const lowest = states.reduce((m, s) => (ORDER[s] < ORDER[m] ? s : m), 'firm' as PatternState);
  return lowest === 'new' ? 'learning' : lowest;
}
