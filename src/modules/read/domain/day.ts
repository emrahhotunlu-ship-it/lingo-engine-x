import type { TransformOp } from '../shared';
import type { ArticleItem, IndexItem, ReadState } from '../schemas';
import { parseDayDoc, parseMonthDoc } from './docs';
import { checkDayFits, checkMonthFits, MAX_ARTICLES_PER_DAY } from './size';
import { countWords, minutesFor } from './text';

// Schreibpläne für `read/d-<Tag>` und `read/m-<Monat>` (docs/umbau/lesen-plan.md §4.4). Rein: jede Funktion bekommt den FRISCHEN
// Stand (writer.transform) und liefert, was zu tun ist. Nichts wird gelöscht; `set` nur für ein fehlendes Dokument,
// sonst `update` aus dem frischen Stand. Ein Dokument mit unerwartetem Aufbau wird nie angefasst.

type Doc = Record<string, unknown>;

export type AppendOutcome = 'created' | 'appended' | 'exists' | 'invalid_doc' | 'article_too_big' | 'doc_too_big' | 'day_full';
export type Plan = { op: TransformOp | null; outcome: AppendOutcome };

/** Artikel an das Tagesdokument hängen (nur wenn die Kennung fehlt und alles passt). */
export function appendArticlePlan(cur: Doc | undefined, day: string, item: ArticleItem, perDayMax = MAX_ARTICLES_PER_DAY): Plan {
  const parsed = parseDayDoc(cur);
  if (!parsed.ok) return { op: null, outcome: 'invalid_doc' };
  // Alle bisherigen Einträge bleiben unverändert erhalten (auch die ausgeblendeten): aus dem Rohstand übernehmen.
  const rawItems = Array.isArray(cur?.items) ? (cur.items as unknown[]) : [];
  if (rawItems.some((x) => (x as { id?: unknown } | null)?.id === item.id)) return { op: null, outcome: 'exists' };
  const fit = checkDayFits(rawItems, item, day, perDayMax);
  if (!fit.ok) return { op: null, outcome: fit.reason };
  if (!cur) return { op: { set: { v: 1, day, items: [item] } }, outcome: 'created' };
  // Dokument ist da (auch ein leeres, z. B. nach acquire): v und day nur ergänzen, wenn sie fehlen.
  const patch: Doc = { items: [...rawItems, item] };
  if (cur.v == null) patch.v = 1;
  if (cur.day == null) patch.day = day;
  return { op: { update: patch }, outcome: rawItems.length === 0 && cur.items == null ? 'created' : 'appended' };
}

/** Eintrag des Monatsindex zu einem Artikel (Anzeige ohne den Text zu laden). */
export function indexEntryOf(item: ArticleItem, day: string): IndexItem {
  const words = item.paras.reduce((a, p) => a + p.reduce((b, s) => b + countWords(s.e), 0), 0);
  return { id: item.id, day, title: item.title, topic: item.topic ?? 'custom', mins: minutesFor(words), words, st: { done: false, sec: 0, pos: 0, open: 0, saved: 0 } };
}

/** Eintrag im Monatsindex anlegen (bestehende Einträge, auch mit Lesezustand, bleiben unverändert). */
export function upsertIndexPlan(cur: Doc | undefined, month: string, entry: IndexItem): Plan {
  const parsed = parseMonthDoc(cur);
  if (!parsed.ok) return { op: null, outcome: 'invalid_doc' };
  const rawItems = Array.isArray(cur?.items) ? (cur.items as unknown[]) : [];
  if (rawItems.some((x) => (x as { id?: unknown } | null)?.id === entry.id)) return { op: null, outcome: 'exists' };
  const fit = checkMonthFits(rawItems, entry, month);
  if (!fit.ok) return { op: null, outcome: fit.reason };
  if (!cur) return { op: { set: { v: 1, items: [entry] } }, outcome: 'created' };
  const patch: Doc = { items: [...rawItems, entry] };
  if (cur.v == null) patch.v = 1;
  return { op: { update: patch }, outcome: 'appended' };
}

const maxNum = (a: unknown, b: unknown): number => Math.max(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0);

/**
 * Lesezustand zusammenführen (zwei Geräte): `sec`, `open`, `saved` nur nach oben (Maximum), `done` nur von falsch auf wahr,
 * `pos` folgt dem Neueren (`patch`), gemeldete Sätze werden vereinigt, `t0` bleibt der erste Beginn.
 */
export function mergeState(old: ReadState | null | undefined, patch: ReadState): ReadState {
  const o: ReadState = old ?? {};
  const out: ReadState = { ...o, ...patch };
  out.sec = maxNum(o.sec, patch.sec);
  out.open = maxNum(o.open, patch.open);
  out.saved = maxNum(o.saved, patch.saved);
  out.done = o.done === true || patch.done === true;
  const t0 = [o.t0, patch.t0].filter((x): x is number => typeof x === 'number' && x > 0);
  if (t0.length) out.t0 = Math.min(...t0);
  if (patch.pos == null) out.pos = o.pos ?? 0;
  const rep = [...(o.rep ?? []), ...(patch.rep ?? [])];
  if (rep.length) out.rep = [...new Set(rep)];
  if (patch.q || o.q) out.q = { n: maxNum(o.q?.n, patch.q?.n), ok: maxNum(o.q?.ok, patch.q?.ok) };
  return out;
}

/**
 * Lesezustand eines Artikels im Monatsindex fortschreiben (nur dieses Feld; der Rest des Dokuments bleibt).
 * `seed`: nur für Routine-Artikel. Ihr Indexeintrag entsteht erst hier, beim ersten gespeicherten Lesestand (die App legt ihn selbst an,
 * die Routine schreibt nie in App-Dokumente). Ohne `seed` bleibt ein fehlender Eintrag `missing`.
 */
export function stateUpdatePlan(cur: Doc | undefined, id: string, patch: ReadState, seed?: IndexItem, month = '0000-00'): { op: TransformOp | null; outcome: 'updated' | 'created' | 'missing' | 'invalid_doc' } {
  if (!cur) {
    if (!seed) return { op: null, outcome: 'missing' };
    return { op: { set: { v: 1, items: [{ ...seed, st: mergeState(seed.st, patch) }] } }, outcome: 'created' };
  }
  const parsed = parseMonthDoc(cur);
  if (!parsed.ok) return { op: null, outcome: 'invalid_doc' };
  const rawItems = Array.isArray(cur.items) ? (cur.items as unknown[]) : [];
  let hit = false;
  const next = rawItems.map((x) => {
    if (!x || typeof x !== 'object' || (x as { id?: unknown }).id !== id) return x;
    hit = true;
    const e = x as IndexItem;
    return { ...e, st: mergeState(e.st, patch) };
  });
  if (hit) return { op: { update: { items: next } }, outcome: 'updated' };
  if (!seed) return { op: null, outcome: 'missing' };
  const entry: IndexItem = { ...seed, st: mergeState(seed.st, patch) };
  if (!checkMonthFits(rawItems, entry, month).ok) return { op: null, outcome: 'missing' };
  return { op: { update: { items: [...rawItems, entry], ...(cur.v == null ? { v: 1 } : {}) } }, outcome: 'created' };
}
