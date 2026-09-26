import { isDocPath, isReadOnlyPath, schemaForPath } from '../../data/paths';
import { validateDoc } from '../../data/validate';
import { jsonEqual } from '../equal';
import { addDays, isDayKey, legacyDayKey } from '../date';

// Noch nicht übertragene Kopien der alten App (sw2:__dirty) – bewusst SCHLICHT und sicher
// (Kap. 9, Regel 1 und 6). Automatisch geschieht nur, was nie etwas verlieren kann:
// - fehlt das Dokument in der Datenbank → die Kopie wird angelegt;
// - `app/profile`: Lerntage und Zähler (`days`, `xpDays`, `minutes`, `act`, `xp`, `answers`,
//   `vAnswers`, `gAnswers`) werden je Schlüssel mit dem höheren Wert ergänzt – das schützt die Serie.
//   Nur echte, nicht künftige Kalendertage und keine negativen Werte;
// - `app/course`: fehlende abgeschlossene Lektionen werden ergänzt.
// Alles andere, was abweicht, wird NICHT zusammengeführt, sondern gemeldet (`not_merged` bzw.
// `rest`). Es bleibt in diesem Browser (`sw2:`) und in der Sicherung (`browserCopies`) erhalten.
// Ein Datenbank-Dokument mit unerwartetem Aufbau wird nie angefasst (`db_invalid`, Regel 6).

type Doc = Record<string, unknown>;

export type RescueSkipReason = 'read_only' | 'invalid' | 'db_invalid' | 'unchanged' | 'missing_local' | 'unknown_path' | 'not_merged';

export type RescueDecision =
  | { kind: 'create'; data: Doc }
  | { kind: 'merge'; patch: Doc; changes: number; rest: boolean }
  | { kind: 'skip'; reason: 'unchanged' | 'not_merged' | 'db_invalid' };

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const PROFILE_DAY_MAPS = ['days', 'xpDays', 'minutes'] as const;
const PROFILE_COUNTERS = ['xp', 'answers', 'vAnswers', 'gAnswers'] as const;

type KeyOk = (key: string) => boolean;
const anyKey: KeyOk = () => true;

/** Behälter, in den ergänzt werden darf: fehlt, ist `null` oder ein Objekt – nie etwas anderes ersetzen. */
const container = (v: unknown): Doc | null => (v === undefined || v === null ? {} : isObj(v) ? v : null);

/** Zahlen ≥ 0 je Schlüssel ergänzen, wenn sie in der Datenbank fehlen oder kleiner sind. */
function maxMap(remote: unknown, local: unknown, keyOk: KeyOk): Doc | null {
  const r = container(remote);
  if (!isObj(local) || !r) return null;
  const add: Doc = {};
  for (const [k, v] of Object.entries(local)) {
    const lv = num(v);
    if (lv === null || lv < 0 || !keyOk(k)) continue;
    const present = Object.hasOwn(r, k) && r[k] !== null && r[k] !== undefined;
    const rv = present ? num(r[k]) : null;
    if (!present || (rv !== null && lv > rv)) add[k] = v;
  }
  return Object.keys(add).length ? add : null;
}

function mergeProfile(remote: Doc, local: Doc, nowMs: number): Doc {
  // Nur echte Kalendertage bis heute: ein künftiger Tag würde später ohne Übung als gelernt zählen.
  const today = legacyDayKey(nowMs);
  const pastDay: KeyOk = (k) => isDayKey(k) && addDays(k, 0) === k && k <= today; // echtes Datum, nicht 2026-02-31
  const patch: Doc = {};
  for (const key of PROFILE_DAY_MAPS) {
    const add = maxMap(remote[key], local[key], pastDay);
    if (add) patch[key] = add;
  }
  const rAct = container(remote.act);
  if (isObj(local.act) && rAct) {
    const act: Doc = {};
    for (const [d, o] of Object.entries(local.act)) {
      if (!pastDay(d)) continue;
      const add = maxMap(Object.hasOwn(rAct, d) ? rAct[d] : undefined, o, anyKey);
      if (add) act[d] = add;
    }
    if (Object.keys(act).length) patch.act = act;
  }
  for (const key of PROFILE_COUNTERS) {
    const lv = num(local[key]);
    const present = remote[key] !== undefined && remote[key] !== null;
    const rv = num(remote[key]);
    if (lv !== null && lv >= 0 && (!present || (rv !== null && lv > rv))) patch[key] = lv;
  }
  return patch;
}

function mergeCourse(remote: Doc, local: Doc): Doc {
  const r = container(remote.done);
  if (!isObj(local.done) || !r) return {};
  const add: Doc = {};
  for (const [id, v] of Object.entries(local.done)) if (!Object.hasOwn(r, id) && isObj(v)) add[id] = v;
  return Object.keys(add).length ? { done: add } : {};
}

/** Steckt alles aus `a` schon in `b`? (Objekte schlüsselweise, alles andere als Ganzes.) */
function contained(a: unknown, b: unknown): boolean {
  if (isObj(a) && isObj(b)) return Object.entries(a).every(([k, v]) => v === undefined || (Object.hasOwn(b, k) && contained(v, b[k])));
  return jsonEqual(a, b);
}

function countLeaves(patch: Doc): number {
  return Object.values(patch).reduce<number>((sum, v) => sum + (isObj(v) ? countLeaves(v) : 1), 0);
}

export function mergeLegacyLocal(path: string, remote: Doc | undefined, local: Doc, nowMs: number): RescueDecision {
  if (!remote) return { kind: 'create', data: local };
  if (jsonEqual(remote, local)) return { kind: 'skip', reason: 'unchanged' };
  if (!validateDoc(path, remote).ok) return { kind: 'skip', reason: 'db_invalid' };
  const patch = path === 'app/profile' ? mergeProfile(remote, local, nowMs) : path === 'app/course' ? mergeCourse(remote, local) : {};
  const after = applyUpdate(remote, patch);
  const rest = !contained(local, after);
  if (Object.keys(patch).length) return { kind: 'merge', patch, changes: countLeaves(patch), rest };
  return { kind: 'skip', reason: rest ? 'not_merged' : 'unchanged' };
}

export type RescueItem = { path: string; markedAt: number; local: Doc; action: 'create' | 'merge'; changes: number; rest: boolean };
export type RescueClassification = { item: RescueItem; merged: Doc } | { skip: RescueSkipReason };

/** Prüft einen vorgemerkten Pfad der alten App gegen den bekannten Stand der Datenbank. */
export function classifyLegacyPath(path: string, markedAt: number, local: Doc | undefined, remote: Doc | undefined, nowMs: number): RescueClassification {
  if (!isDocPath(path) || !schemaForPath(path)) return { skip: 'unknown_path' };
  if (!local) return { skip: 'missing_local' };
  if (isReadOnlyPath(path)) return { skip: 'read_only' };
  if (!validateDoc(path, local).ok) return { skip: 'invalid' };
  const d = mergeLegacyLocal(path, remote, local, nowMs);
  if (d.kind === 'skip') return { skip: d.reason };
  if (d.kind === 'create') return { item: { path, markedAt, local, action: 'create', changes: 1, rest: false }, merged: local };
  return { item: { path, markedAt, local, action: 'merge', changes: d.changes, rest: d.rest }, merged: applyUpdate(remote ?? {}, d.patch) };
}

/** Wirkung von db `update(patch)`: Objekte verschmelzen rekursiv, alles andere ersetzt. */
export function applyUpdate(base: Doc, patch: Doc): Doc {
  const out: Doc = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] = isObj(v) && isObj(cur) ? applyUpdate(cur, v) : v;
  }
  return out;
}
