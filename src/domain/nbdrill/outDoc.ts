import { validateDoc } from '../../data/validate';
import { logWarn } from '../../platform/diagnostics';
import { jsonBytes, monthOf, upsertById } from '../monthDoc';

// Ergebnisse der neuen Übungen als Monatsdokument `out/<JJJJ-MM>` (Plan §4.10, A6.6): ein Eintrag
// je beendeter Übung (Kollokationen-Runde, Umformungen, Einwand-Serie, Posteingang, Nachsprechen),
// idempotent über `id`. Grenzen (data-guard, plan.md §8 00:35):
// - höchstens 400 Einträge (die ältesten fallen weg, nie still),
// - `text` und `fb` je höchstens 2 KB,
// - das Dokument bleibt unter 200 KiB: verdichtet wird zuerst `fb`, dann `text` der ältesten,
// - der Monat kommt aus dem Lerntag (`d.slice(0, 7)`, Tagesgrenze 04:00),
// - in ein ungültiges Dokument wird nie geschrieben (Regel 6).

type Doc = Record<string, unknown>;

export const OUT_DOC_MAX_BYTES = 200 * 1024;
export const OUT_MAX_ITEMS = 400;
export const OUT_FIELD_MAX_BYTES = 2048;

export type OutKind = 'colloc' | 'transform' | 'wordform' | 'register' | 'phrasal' | 'transition' | 'objection' | 'hotseat' | 'buytime' | 'inbox' | 'shadow' | 'stress' | 'numbers'
  // Lernplattform 3.0 (§3.4): Verlauf der Lexik-Arten des Aufgabensystems c1x.
  | 'mcc' | 'wf' | 'cnet';

export type OutItem = {
  id: string;
  /** Art der Übung. */
  k: OutKind;
  /** Lerntag (`JJJJ-MM-TT`). */
  d: string;
  /** Beginn (ms) – Reihenfolge im Dokument. */
  t: number;
  theme?: string;
  ok?: boolean;
  text?: string;
  fb?: unknown;
  ms?: number;
};

const encoder = new TextEncoder();
const bytes = (s: string) => encoder.encode(s).length;

/** Text auf höchstens `max` Bytes (UTF-8) kürzen, mit „…“. */
export function clipBytes(s: string, max = OUT_FIELD_MAX_BYTES): string {
  if (bytes(s) <= max) return s;
  const chars = Array.from(s);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (bytes(chars.slice(0, mid).join('')) + 3 <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`;
}

/** Rückmeldung auf ≤ 2 KB: zu groß → nur die kurzen Felder (Urteil, Wirkung) bleiben. */
export function clipFb(fb: unknown): unknown {
  if (fb === undefined || fb === null) return undefined;
  if (jsonBytes(fb) <= OUT_FIELD_MAX_BYTES) return fb;
  const o = fb && typeof fb === 'object' && !Array.isArray(fb) ? (fb as Doc) : {};
  const small: Doc = {};
  for (const k of ['verdict', 'ok', 'score', 'moves', 'tone', 'gist']) if (k in o) small[k] = o[k];
  if (typeof o.effect === 'string') small.effect = clipBytes(o.effect, 400);
  return jsonBytes(small) <= OUT_FIELD_MAX_BYTES ? small : undefined;
}

/** Eintrag in Speicherform: Felder gekappt, leere weggelassen. */
export function outEntry(i: OutItem): Doc {
  const e: Doc = { id: i.id, k: i.k, d: i.d, t: Math.max(0, Math.floor(i.t)) };
  if (i.theme) e.theme = i.theme;
  if (typeof i.ok === 'boolean') e.ok = i.ok;
  if (i.text) e.text = clipBytes(i.text);
  const fb = clipFb(i.fb);
  if (fb !== undefined) e.fb = fb;
  if (typeof i.ms === 'number' && Number.isFinite(i.ms)) e.ms = Math.max(0, Math.round(i.ms));
  return e;
}

const dropField =
  (key: 'fb' | 'text') =>
  (i: Doc): Doc | null => {
    if (!(key in i)) return null;
    const next = { ...i };
    delete next[key];
    return next;
  };
const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [dropField('fb'), dropField('text')];

const objOf = (x: unknown): Doc => (x && typeof x === 'object' && !Array.isArray(x) ? { ...(x as Doc) } : {});

/**
 * Verdichtet die Liste (älteste zuerst): höchstens 400 Einträge, dann `fb`, dann `text` leeren, bis
 * das Dokument unter 200 KiB liegt. Der Eintrag `keepId` (der gerade geschriebene) bleibt immer
 * vollständig. Größen werden je Eintrag einmal gemessen (kein Neuserialisieren des ganzen Dokuments
 * je Schritt – das wäre bei 400 Einträgen ein Long Task).
 */
export function compactOut(items: readonly unknown[], month = '0000-00', keepId?: string): unknown[] {
  let list = items.map(objOf);
  if (list.length > OUT_MAX_ITEMS) {
    logWarn('compact:drop', new Error(`${list.length - OUT_MAX_ITEMS} oldest out entries removed (max ${OUT_MAX_ITEMS})`), month);
    list = list.slice(list.length - OUT_MAX_ITEMS);
  }
  const sizes = list.map((x) => jsonBytes(x));
  const base = jsonBytes({ v: 1, month, items: [] });
  let total = base + sizes.reduce((a, b) => a + b, 0) + Math.max(0, list.length - 1);
  for (const step of STEPS) {
    for (let i = 0; i < list.length && total > OUT_DOC_MAX_BYTES; i++) {
      const cur = list[i];
      if (!cur || (keepId !== undefined && cur.id === keepId)) continue;
      const next = step(cur);
      if (!next) continue;
      const size = jsonBytes(next);
      total += size - (sizes[i] ?? 0);
      sizes[i] = size;
      list[i] = next;
    }
  }
  // Letzte Rettung: älteste Einträge entfernen (nie den neuen) – nie still.
  let dropped = 0;
  while (total > OUT_DOC_MAX_BYTES && list.length > 1) {
    const i = list.findIndex((x) => keepId === undefined || x.id !== keepId);
    if (i < 0) break;
    total -= (sizes[i] ?? 0) + 1;
    list.splice(i, 1);
    sizes.splice(i, 1);
    dropped++;
  }
  if (dropped) logWarn('compact:drop', new Error(`${dropped} oldest out entries removed to stay under ${OUT_DOC_MAX_BYTES} bytes`), month);
  return list;
}

/** Pfad des Monatsdokuments eines Lerntags. */
export const outPath = (day: string): string => `out/${monthOf(day)}`;

/** Kennung eines Eintrags: Art + Beginn (Basis 36). */
export const outId = (k: OutKind, t: number): string => `${k}-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Verweis für `UnitTaskResult.ref`: Monatsdokument + Eintrag. */
export const outRef = (item: Pick<OutItem, 'id' | 'd'>): string => `${outPath(item.d)}#${item.id}`;

/** Schreibvorgang für `out/<Monat>` aus dem frischen Stand (writer.transform). `null` = nichts schreiben. */
export function upsertOut(cur: Doc | undefined, item: OutItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.d);
  const entry = outEntry(item);
  if (!cur) return { set: { v: 1, month, items: compactOut([entry], month, item.id) } };
  if (!validateDoc(outPath(item.d), cur).ok) return null;
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactOut(upsertById(list, { ...entry, id: item.id, t: entry.t as number }), month, item.id) } };
}
