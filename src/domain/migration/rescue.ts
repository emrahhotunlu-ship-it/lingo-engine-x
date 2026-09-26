import { collectionOf, isDocPath, isReadOnlyPath, schemaForPath } from '../../data/paths';
import { validateDoc } from '../../data/validate';
import { jsonEqual } from '../equal';

// Noch nicht übertragene Kopien der alten App (sw2:__dirty) werden ERGÄNZT, nie übergestülpt
// (Kap. 9, Regel 1): Die Datenbank kann neuer sein (anderes Gerät, Änderungen seit dem
// Trockenlauf). Grundsätze, für jedes Feld der lokalen Kopie:
// - fehlt es in der Datenbank → ergänzen;
// - Listen → vereinigen, nichts entfernen, nichts kappen (Einträge mit `q` – Fehlersätze –
//   und `d` – Tageswerte – werden über diesen Schlüssel zusammengeführt, sonst über den
//   ganzen Inhalt; nach `t` bzw. `d` sortiert);
// - Objekte → rekursiv nach denselben Regeln (db `update` verschmilzt Objekte);
// - Zähler und Tageswerte (`days`, `xpDays`, `minutes`, `act`, `xp`, `answers`, …, `n`) → Maximum;
// - andere Einzelwerte → Datenbank gewinnt; nur bei Karten und Themen, deren lokale Kopie
//   nachweislich neuer ist (`last`), gewinnt die Kopie (dann auch bei `q`/`d`-Einträgen).
// Ergebnis ist ein Patch für db `update`, der nie ein Feld entfernt.

type Doc = Record<string, unknown>;

export type RescueSkipReason = 'read_only' | 'invalid' | 'unchanged' | 'missing_local' | 'unknown_path' | 'db_newer';

export type RescueDecision =
  | { kind: 'create'; data: Doc }
  | { kind: 'merge'; patch: Doc; changes: number }
  | { kind: 'skip'; reason: 'unchanged' | 'db_newer' };

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Felder, deren Zahlen nur wachsen: hier gewinnt das Maximum. */
const MAX_FIELDS = new Set(['days', 'xpDays', 'minutes', 'act', 'xp', 'answers', 'vAnswers', 'gAnswers', 'n']);
/** Folgen ohne Schlüssel (z. B. die letzten 10 Ergebnisse): als Ganzes, nur wenn die Kopie neuer ist. */
const SEQUENCE_FIELDS = new Set(['recent']);

type Ctx = { localNewer: boolean; max: boolean };

function itemKey(item: unknown): string {
  if (isObj(item)) {
    if (typeof item.q === 'string') return `q:${item.q}`;
    if (typeof item.d === 'string' && !Object.hasOwn(item, 't')) return `d:${item.d}`;
  }
  return `j:${JSON.stringify(item)}`;
}

function itemOrder(item: unknown): number | string | null {
  if (!isObj(item)) return null;
  if (typeof item.t === 'number') return item.t;
  if (typeof item.d === 'string') return item.d;
  return null;
}

function unionArrays(remote: unknown[], local: unknown[], localWins: boolean): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const x of remote) byKey.set(itemKey(x), x);
  for (const x of local) {
    const k = itemKey(x);
    if (!byKey.has(k) || localWins) byKey.set(k, x);
  }
  const out = [...byKey.values()];
  if (out.length && out.every((x) => itemOrder(x) !== null)) {
    out.sort((a, b) => {
      const oa = itemOrder(a) ?? 0;
      const ob = itemOrder(b) ?? 0;
      return oa < ob ? -1 : oa > ob ? 1 : 0;
    });
  }
  return out;
}

/** Patch für ein Objekt: nur, was sich nach den Regeln ändert. Gibt `null` zurück, wenn nichts. */
function mergeObject(remote: Doc, local: Doc, ctx: Ctx): Doc | null {
  const patch: Doc = {};
  for (const [k, l] of Object.entries(local)) {
    if (l === undefined) continue;
    const r = remote[k];
    const max = ctx.max || MAX_FIELDS.has(k);
    if (!Object.hasOwn(remote, k) || r === undefined || r === null) {
      if (l !== null) patch[k] = l;
      continue;
    }
    if (Array.isArray(r) && Array.isArray(l)) {
      if (SEQUENCE_FIELDS.has(k)) {
        if (ctx.localNewer && !jsonEqual(r, l)) patch[k] = l;
        continue;
      }
      const merged = unionArrays(r, l, ctx.localNewer);
      if (!jsonEqual(merged, r)) patch[k] = merged;
      continue;
    }
    if (isObj(r) && isObj(l)) {
      const sub = mergeObject(r, l, { ...ctx, max });
      if (sub) patch[k] = sub;
      continue;
    }
    if (max && typeof l === 'number' && typeof r === 'number') {
      if (l > r) patch[k] = l;
      continue;
    }
    if (ctx.localNewer && !jsonEqual(r, l)) patch[k] = l;
  }
  return Object.keys(patch).length ? patch : null;
}

function countLeaves(patch: Doc): number {
  return Object.values(patch).reduce<number>((sum, v) => sum + (isObj(v) ? countLeaves(v) : 1), 0);
}

export function mergeLegacyLocal(path: string, remote: Doc | undefined, local: Doc): RescueDecision {
  if (!remote) return { kind: 'create', data: local };
  if (jsonEqual(remote, local)) return { kind: 'skip', reason: 'unchanged' };
  const c = collectionOf(path);
  const isCard = c === 'vocab' || c === 'chunk' || c === 'grammar';
  const localNewer = isCard && n(local.last) > n(remote.last);
  const patch = mergeObject(remote, local, { localNewer, max: false });
  if (patch) return { kind: 'merge', patch, changes: countLeaves(patch) };
  return { kind: 'skip', reason: isCard && n(remote.last) > n(local.last) ? 'db_newer' : 'unchanged' };
}

export type RescueItem = { path: string; markedAt: number; local: Doc; action: 'create' | 'merge'; changes: number };
export type RescueClassification = { item: RescueItem; merged: Doc } | { skip: RescueSkipReason };

/** Prüft einen vorgemerkten Pfad der alten App gegen den bekannten Stand der Datenbank. */
export function classifyLegacyPath(path: string, markedAt: number, local: Doc | undefined, remote: Doc | undefined): RescueClassification {
  if (!isDocPath(path) || !schemaForPath(path)) return { skip: 'unknown_path' };
  if (!local) return { skip: 'missing_local' };
  if (isReadOnlyPath(path)) return { skip: 'read_only' };
  if (!validateDoc(path, local).ok) return { skip: 'invalid' };
  const d = mergeLegacyLocal(path, remote, local);
  if (d.kind === 'skip') return { skip: d.reason };
  if (d.kind === 'create') return { item: { path, markedAt, local, action: 'create', changes: 1 }, merged: local };
  return { item: { path, markedAt, local, action: 'merge', changes: d.changes }, merged: applyUpdate(remote ?? {}, d.patch) };
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
