import { collectionOf } from '../../data/paths';
import { jsonEqual } from '../equal';

// Noch nicht übertragene Kopien der alten App (sw2:__dirty) werden ERGÄNZT, nie übergestülpt:
// Die Datenbank kann neuer sein (anderes Gerät, Änderungen seit dem Trockenlauf). Deshalb:
// - fehlt das Dokument in der Datenbank → lokale Kopie anlegen,
// - Profil: Lerntage, Minuten und Aktivitäten je Tag mit dem höheren Wert; Zähler nur nach oben,
// - Kurs: nur Lektionen ergänzen, die in der Datenbank noch nicht als erledigt stehen,
// - Tagesprotokoll: Einträge vereinigen (höchstens 300, die neuesten),
// - Karten und Grammatikthemen: nur übernehmen, wenn die lokale Kopie nachweislich neuer ist (`last`),
// - alles andere: nur Felder ergänzen, die in der Datenbank fehlen.
// Ergebnis ist ein Patch für db `update` (verschmilzt Objekte, entfernt nie ein Feld).

type Doc = Record<string, unknown>;

export type RescueDecision =
  | { kind: 'create'; data: Doc }
  | { kind: 'merge'; patch: Doc; changes: number }
  | { kind: 'skip'; reason: 'unchanged' | 'db_newer' };

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const LOG_CAP = 300;

function addMissingFields(remote: Doc, local: Doc, patch: Doc): number {
  let changes = 0;
  for (const [k, v] of Object.entries(local)) {
    if (!(k in remote) && v !== undefined) {
      patch[k] = v;
      changes++;
    }
  }
  return changes;
}

function mergeProfile(remote: Doc, local: Doc): { patch: Doc; changes: number } {
  const patch: Doc = {};
  let changes = 0;
  for (const key of ['days', 'xpDays', 'minutes']) {
    const l = isObj(local[key]) ? local[key] : {};
    const r = isObj(remote[key]) ? remote[key] : {};
    const add: Doc = {};
    for (const [d, v] of Object.entries(l)) if (n(v) > n(r[d])) add[d] = v;
    if (Object.keys(add).length) {
      patch[key] = add;
      changes += Object.keys(add).length;
    }
  }
  const lAct = isObj(local.act) ? local.act : {};
  const rAct = isObj(remote.act) ? remote.act : {};
  const actPatch: Doc = {};
  for (const [d, o] of Object.entries(lAct)) {
    if (!isObj(o)) continue;
    const r = isObj(rAct[d]) ? rAct[d] : {};
    const add: Doc = {};
    for (const [a, v] of Object.entries(o)) if (n(v) > n(r[a])) add[a] = v;
    if (Object.keys(add).length) {
      actPatch[d] = add;
      changes++;
    }
  }
  if (Object.keys(actPatch).length) patch.act = actPatch;
  for (const key of ['xp', 'answers', 'vAnswers', 'gAnswers']) {
    if (n(local[key]) > n(remote[key])) {
      patch[key] = local[key];
      changes++;
    }
  }
  changes += addMissingFields(remote, local, patch);
  return { patch, changes };
}

function mergeCourse(remote: Doc, local: Doc): { patch: Doc; changes: number } {
  const patch: Doc = {};
  const l = isObj(local.done) ? local.done : {};
  const r = isObj(remote.done) ? remote.done : {};
  const add: Doc = {};
  for (const [k, v] of Object.entries(l)) if (!(k in r)) add[k] = v;
  let changes = Object.keys(add).length;
  if (changes) patch.done = add;
  const rest: Doc = { ...local };
  delete rest.done;
  changes += addMissingFields(remote, rest, patch);
  return { patch, changes };
}

function mergeLog(remote: Doc, local: Doc): { patch: Doc; changes: number } {
  const r: unknown[] = Array.isArray(remote.entries) ? (remote.entries as unknown[]) : [];
  const l: unknown[] = Array.isArray(local.entries) ? (local.entries as unknown[]) : [];
  const merged: unknown[] = [...r];
  let changes = 0;
  for (const e of l) {
    if (!merged.some((x) => jsonEqual(x, e))) {
      merged.push(e);
      changes++;
    }
  }
  const patch: Doc = {};
  if (changes) {
    merged.sort((a, b) => n(isObj(a) ? a.t : 0) - n(isObj(b) ? b.t : 0));
    patch.entries = merged.slice(-LOG_CAP);
  }
  const rest: Doc = { ...local };
  delete rest.entries;
  changes += addMissingFields(remote, rest, patch);
  return { patch, changes };
}

function mergeIfNewer(remote: Doc, local: Doc): RescueDecision {
  if (n(local.last) <= n(remote.last)) return { kind: 'skip', reason: 'db_newer' };
  const patch: Doc = {};
  for (const [k, v] of Object.entries(local)) if (v !== undefined && !jsonEqual(remote[k], v)) patch[k] = v;
  const changes = Object.keys(patch).length;
  return changes ? { kind: 'merge', patch, changes } : { kind: 'skip', reason: 'unchanged' };
}

export function mergeLegacyLocal(path: string, remote: Doc | undefined, local: Doc): RescueDecision {
  if (!remote) return { kind: 'create', data: local };
  if (jsonEqual(remote, local)) return { kind: 'skip', reason: 'unchanged' };
  const c = collectionOf(path);
  let res: { patch: Doc; changes: number };
  if (path === 'app/profile') res = mergeProfile(remote, local);
  else if (path === 'app/course') res = mergeCourse(remote, local);
  else if (c === 'log') res = mergeLog(remote, local);
  else if (c === 'vocab' || c === 'chunk' || c === 'grammar') return mergeIfNewer(remote, local);
  else {
    const patch: Doc = {};
    res = { patch, changes: addMissingFields(remote, local, patch) };
  }
  return res.changes ? { kind: 'merge', patch: res.patch, changes: res.changes } : { kind: 'skip', reason: 'unchanged' };
}
