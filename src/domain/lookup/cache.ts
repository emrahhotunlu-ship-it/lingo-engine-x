import type { WordLookupOut } from '../../prompts/wordLookup';

// Zwischenspeicher der KI-Nachschlagungen in `app/lookup.items` im Format der alten App
// (docs/altapp-analyse.md: kleingeschriebenes Wort → {lemma, pos, de, def, level, note_de}),
// höchstens 400 gefüllte Einträge (Plan §3.9). Neu und nur ergänzend: note_en, ipa, ex, t, pv.

export const LOOKUP_MAX = 400;
/** Alle Schlüssel zusammen (gefüllte und verdrängte `null`) – darüber wird verdichtet. */
export const LOOKUP_MAX_KEYS = 600;
/** Größe von `app/lookup` in UTF-8-Bytes, darüber wird verdichtet (Grenze laut db.d.ts: 256 KiB). */
export const LOOKUP_MAX_BYTES = 200_000;
/** Ziel beim Verdichten: so viele neueste Einträge bzw. höchstens so viele Bytes. */
export const LOOKUP_COMPACT_KEEP = 300;
export const LOOKUP_COMPACT_BYTES = 150_000;

const encoder = new TextEncoder();
export const jsonBytes = (v: unknown): number => encoder.encode(JSON.stringify(v) ?? '').length;
export const LOOKUP_PV = 'word-lookup@2';

export type LookupEntry = {
  lemma: string;
  pos: string;
  de: string;
  def: string;
  level: string;
  note_de?: string;
  note_en?: string;
  ipa?: string;
  ex?: string;
  t: number;
  pv: string;
};

type Doc = Readonly<Record<string, unknown>>;

/** Schlüssel wie in der alten App (kleingeschrieben); unpassende Wörter bekommen keinen Eintrag. */
export function lookupKey(w: string): string | null {
  const k = w.trim().toLowerCase().replace(/’/g, "'");
  return /^[a-z][a-z' -]{0,59}$/.test(k) ? k : null;
}

/** Eintrag aus einer KI-Antwort; die Notiz nur in der Sprache der Anfrage. */
export function cacheEntry(out: WordLookupOut, uiLang: 'de' | 'en', nowMs: number): LookupEntry {
  const e: LookupEntry = { lemma: out.lemma, pos: out.pos, de: out.de, def: out.def, level: out.level, t: nowMs, pv: LOOKUP_PV };
  if (out.ipa) e.ipa = out.ipa;
  if (out.ex) e.ex = out.ex;
  if (out.note) e[uiLang === 'de' ? 'note_de' : 'note_en'] = out.note;
  return e;
}

const itemsOf = (cur: Doc | undefined): Record<string, unknown> =>
  cur && cur.items && typeof cur.items === 'object' && !Array.isArray(cur.items) ? (cur.items as Record<string, unknown>) : {};

/** Gültiger Eintrag aus dem Zwischenspeicher (tolerant gelesen) oder `null`. */
export function readEntry(cur: Doc | undefined, key: string): Partial<LookupEntry> | null {
  const raw = itemsOf(cur)[key];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<LookupEntry> = {};
  for (const f of ['lemma', 'pos', 'de', 'def', 'level', 'note_de', 'note_en', 'ipa', 'ex', 'pv'] as const) {
    const v = r[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim();
  }
  if (typeof r.t === 'number') out.t = r.t;
  return out.de || out.def ? out : null;
}

/**
 * Was zu schreiben ist (für `writer.transform`):
 * - Dokument fehlt → anlegen mit genau diesem Eintrag,
 * - Schlüssel vorhanden → nur fehlende Felder ergänzen (Vorhandenes bleibt),
 * - neu → Eintrag plus `null` für die ältesten, sobald es mehr als 400 gefüllte wären.
 * `null` = nichts zu tun.
 */
export function cachePatch(
  cur: Doc | undefined,
  key: string,
  entry: LookupEntry,
): { set: Record<string, unknown> } | { update: Record<string, unknown> } | { replace: Record<string, unknown> } | null {
  if (!cur) return { set: { items: { [key]: { ...entry } } } };
  const items = itemsOf(cur);
  const existing = items[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const ex = existing as Record<string, unknown>;
    const add: Record<string, unknown> = {};
    for (const [f, v] of Object.entries(entry)) {
      const have = ex[f];
      if (have === undefined || have === null || have === '') add[f] = v;
    }
    return Object.keys(add).length ? { update: { items: { [key]: add } } } : null;
  }
  const filled = Object.entries(items)
    .map(([k, v], order) => ({ k, order, t: v && typeof v === 'object' && typeof (v as Record<string, unknown>).t === 'number' ? ((v as Record<string, unknown>).t as number) : 0, v }))
    .filter((x) => x.v !== null && x.v !== undefined && x.k !== key);
  const patch: Record<string, unknown> = { [key]: { ...entry } };
  const over = filled.length + 1 - LOOKUP_MAX;
  if (over > 0) {
    filled.sort((a, b) => a.t - b.t || a.order - b.order);
    for (const x of filled.slice(0, over)) patch[x.k] = null;
  }
  // Größe NACH dem Schreiben: alle Schlüssel (auch `null`) und Bytes zählen mit. Zu groß →
  // einmal verdichten: nur gefüllte Einträge, die neuesten zuerst, alles andere am Dokument bleibt.
  const keysAfter = Object.keys(items).length + (key in items ? 0 : 1);
  const bytesAfter = jsonBytes(cur) + jsonBytes({ [key]: entry }) + 8;
  if (keysAfter > LOOKUP_MAX_KEYS || bytesAfter > LOOKUP_MAX_BYTES) return { replace: compactLookup(cur, key, entry) };
  return { update: { items: patch } };
}

/**
 * Verdichtete Fassung von `app/lookup`: ohne `null`-Schlüssel, höchstens LOOKUP_COMPACT_KEEP
 * gefüllte Einträge und LOOKUP_COMPACT_BYTES (die neuesten bleiben, der neue Eintrag immer).
 * Andere Felder des Dokuments bleiben unverändert.
 */
export function compactLookup(cur: Doc, key: string, entry: LookupEntry): Record<string, unknown> {
  const items = itemsOf(cur);
  const filled = Object.entries(items)
    .map(([k, v], order) => ({ k, order, v, t: v && typeof v === 'object' && typeof (v as Record<string, unknown>).t === 'number' ? ((v as Record<string, unknown>).t as number) : 0 }))
    .filter((x) => x.v !== null && x.v !== undefined && typeof x.v === 'object' && x.k !== key)
    .sort((a, b) => b.t - a.t || b.order - a.order);
  const kept: Record<string, unknown> = { [key]: { ...entry } };
  let bytes = jsonBytes(kept);
  let n = 1;
  for (const x of filled) {
    if (n >= LOOKUP_COMPACT_KEEP) break;
    const add = jsonBytes({ [x.k]: x.v });
    if (bytes + add > LOOKUP_COMPACT_BYTES) break;
    kept[x.k] = x.v;
    bytes += add;
    n++;
  }
  return { ...cur, items: kept };
}
