import { isDocPath, isReadOnlyPath, schemaForPath } from '../../data/paths';
import { validateDoc } from '../../data/validate';
import { jsonEqual } from '../equal';

// Noch nicht übertragene Kopien der alten App (sw2:__dirty) – bewusst SCHLICHT und sicher
// (Kap. 9, Regel 1 und 6). Automatisch geschieht nur, was nie etwas verlieren kann:
// - fehlt das Dokument in der Datenbank → die Kopie wird angelegt;
// - `app/profile`: Lerntage und Zähler (`days`, `xpDays`, `minutes`, `act`, `xp`, `answers`,
//   `vAnswers`, `gAnswers`) werden je Schlüssel mit dem höheren Wert ergänzt – das schützt die Serie;
// - `app/course`: fehlende abgeschlossene Lektionen werden ergänzt.
// Alles andere, was abweicht, wird NICHT zusammengeführt, sondern gemeldet (`not_merged` bzw.
// `rest`). Es bleibt in diesem Browser (`sw2:`) und in der Sicherung (`browserCopies`) erhalten.

type Doc = Record<string, unknown>;

export type RescueSkipReason = 'read_only' | 'invalid' | 'unchanged' | 'missing_local' | 'unknown_path' | 'not_merged';

export type RescueDecision =
  | { kind: 'create'; data: Doc }
  | { kind: 'merge'; patch: Doc; changes: number; rest: boolean }
  | { kind: 'skip'; reason: 'unchanged' | 'not_merged' };

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const PROFILE_DAY_MAPS = ['days', 'xpDays', 'minutes'] as const;
const PROFILE_COUNTERS = ['xp', 'answers', 'vAnswers', 'gAnswers'] as const;

/** Zahlen je Schlüssel ergänzen, wenn sie fehlen oder kleiner sind. */
function maxMap(remote: unknown, local: unknown): Doc | null {
  if (!isObj(local)) return null;
  const r = isObj(remote) ? remote : {};
  const add: Doc = {};
  for (const [k, v] of Object.entries(local)) {
    const lv = num(v);
    if (lv === null) continue;
    const rv = Object.hasOwn(r, k) ? num(r[k]) : null;
    if (rv === null ? !Object.hasOwn(r, k) || r[k] === null || r[k] === undefined : lv > rv) add[k] = v;
  }
  return Object.keys(add).length ? add : null;
}

function mergeProfile(remote: Doc, local: Doc): Doc {
  const patch: Doc = {};
  for (const key of PROFILE_DAY_MAPS) {
    const add = maxMap(remote[key], local[key]);
    if (add) patch[key] = add;
  }
  if (isObj(local.act)) {
    const rAct = isObj(remote.act) ? remote.act : {};
    const act: Doc = {};
    for (const [d, o] of Object.entries(local.act)) {
      const add = maxMap(Object.hasOwn(rAct, d) ? rAct[d] : undefined, o);
      if (add) act[d] = add;
    }
    if (Object.keys(act).length) patch.act = act;
  }
  for (const key of PROFILE_COUNTERS) {
    const lv = num(local[key]);
    const rv = num(remote[key]);
    if (lv !== null && (rv === null || lv > rv)) patch[key] = lv;
  }
  return patch;
}

function mergeCourse(remote: Doc, local: Doc): Doc {
  if (!isObj(local.done)) return {};
  const r = isObj(remote.done) ? remote.done : {};
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

export function mergeLegacyLocal(path: string, remote: Doc | undefined, local: Doc): RescueDecision {
  if (!remote) return { kind: 'create', data: local };
  if (jsonEqual(remote, local)) return { kind: 'skip', reason: 'unchanged' };
  const patch = path === 'app/profile' ? mergeProfile(remote, local) : path === 'app/course' ? mergeCourse(remote, local) : {};
  const after = applyUpdate(remote, patch);
  const rest = !contained(local, after);
  if (Object.keys(patch).length) return { kind: 'merge', patch, changes: countLeaves(patch), rest };
  return { kind: 'skip', reason: rest ? 'not_merged' : 'unchanged' };
}

export type RescueItem = { path: string; markedAt: number; local: Doc; action: 'create' | 'merge'; changes: number; rest: boolean };
export type RescueClassification = { item: RescueItem; merged: Doc } | { skip: RescueSkipReason };

/** Prüft einen vorgemerkten Pfad der alten App gegen den bekannten Stand der Datenbank. */
export function classifyLegacyPath(path: string, markedAt: number, local: Doc | undefined, remote: Doc | undefined): RescueClassification {
  if (!isDocPath(path) || !schemaForPath(path)) return { skip: 'unknown_path' };
  if (!local) return { skip: 'missing_local' };
  if (isReadOnlyPath(path)) return { skip: 'read_only' };
  if (!validateDoc(path, local).ok) return { skip: 'invalid' };
  const d = mergeLegacyLocal(path, remote, local);
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
