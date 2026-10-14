import { z } from 'zod';
import { validateDoc } from '../../data/validate';
import { logWarn } from '../../platform/diagnostics';
import { hash32 } from '../random';
import { jsonBytes, monthOf } from '../monthDoc';

// Sammelakte der Aktivierungen je Monat (`act/<JJJJ-MM>`, Wörter aktivieren, Stufe 2; Datenregeln in docs/umbau/aktivierung.md, data-guard 14.10.2026):
//  - Einträge als Objekt-Map `{ e: { "<Kennung>": {…} } }` mit deterministischer Kennung – nie als Liste (Listen ersetzt `update` ganz).
//  - Schreiben nur über `writer.transform` (frisch lesen → prüfen → ergänzen), idempotent (existiert die Kennung, wird nichts geschrieben), nie aus dem Render.
//  - Größenwächter vor dem Schreiben (UTF-8-Bytes, 200 KiB): ein volles Dokument bekommt `nx: 1`, der Eintrag geht in die Fortsetzung `-b`, `-c` …
//  - Monat aus dem Lerntag (`dayKey`, Wechsel 04:00), nicht aus `new Date()`.
//  - Felder gekürzt (Satz 300, C1-Fassung 400, Begründung 300 Zeichen); nie gelöscht; ungültige Einträge melden und auslassen.
// Der Kartenzähler `na` ist daraus abgeleitet (`deriveNa`), nicht umgekehrt.

type Doc = Record<string, unknown>;

export const ACT_DOC_MAX_BYTES = 200 * 1024;
/** Höchstens so viele Dokumente je Monat (Fortsetzungen `-b` … `-z`); mehr gäbe 5.000 Einträge je Monat, weit über jeder Nutzung. */
export const ACT_MAX_PARTS = 26;
export const SENTENCE_MAX = 300;
export const BETTER_MAX = 400;
export const WHY_MAX = 300;

export type ActVerdict = 'c' | 'm' | 'w';
/** Ergebnis je Zielwort: c richtig, m kleiner Fehler, w falsch benutzt oder fehlt, x nicht geprüft. */
export type TargetVerdict = ActVerdict | 'x';

export type ActEntry = {
  /** Kennung: Zeitstempel (Basis 36) + Hash der Karte. */
  id: string;
  /** Zeitstempel der Antwort (ms) – zugleich die Kennung der Antwort der Karte. */
  t: number;
  /** Lerntag (04:00-Grenze). */
  d: string;
  /** Karte der Aufgabe (`vocab/<id>`). */
  c: string;
  /** Schritt des Fahrplans 1–5. */
  st: 1 | 2 | 3 | 4 | 5;
  /** Format: `pr` Eigener Satz, sonst `sc`, `tw`, `rw`, `ex`, `im`, `lg`, `kb`, `ml`. */
  f: string;
  /** Code der Vorgabe (`hist[].a`). */
  a: string;
  /** Der eigene Satz (≤ 300 Zeichen). */
  s: string;
  /** C1-Fassung (≤ 400). */
  b?: string;
  /** Begründung, richtig/falsch (≤ 300). */
  w?: string;
  /** Note der Karte 1–3. */
  g: 1 | 2 | 3;
  /** Urteil über den Satz. */
  v: ActVerdict;
  /** 1 = von Claude geprüft (sonst „ungeprüft“). */
  k: 0 | 1;
  /** 1 = geprüft richtig und natürlich: darf als „Dein Satz vom …“ wiederverwendet werden. */
  r?: 1;
  /** 1 = das Zielwort war nicht genannt (A4). */
  ns?: 1;
  /** Zielwörter mit Urteil `[Karte, Urteil]` (bei mehreren Zielwörtern; das erste ist die Karte der Aufgabe). */
  ts?: Array<[string, TargetVerdict]>;
  /** Fehlerklasse des wichtigsten Fehlers. */
  et?: string;
};

export const actEntrySchema = z.looseObject({
  id: z.string().min(3).max(40),
  t: z.number().int().positive(),
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  c: z.string().min(3).max(120),
  st: z.number().int().min(1).max(5),
  f: z.string().min(1).max(8),
  a: z.string().max(40),
  s: z.string().max(SENTENCE_MAX + 2),
  b: z.string().max(BETTER_MAX + 2).optional(),
  w: z.string().max(WHY_MAX + 2).optional(),
  g: z.number().int().min(1).max(3),
  v: z.enum(['c', 'm', 'w']),
  k: z.number().int().min(0).max(1),
  r: z.literal(1).optional(),
  ns: z.literal(1).optional(),
  ts: z.array(z.tuple([z.string(), z.enum(['c', 'm', 'w', 'x'])])).max(3).optional(),
  et: z.string().max(24).optional(),
});

/** Kennung: deterministisch aus Zeitstempel (eindeutig je Gerät) und Karte. Ohne Punkte (Feldnamen). */
export const actId = (t: number, cardKey: string): string => `${Math.max(0, Math.floor(t)).toString(36)}-${hash32(cardKey).toString(36)}`;

/** Pfad des Monatsdokuments eines Lerntags; `part` 0 = Hauptdokument, 1 = `-b`, 2 = `-c` … */
export const actPath = (day: string, part = 0): string => `act/${monthOf(day)}${part > 0 ? `-${String.fromCharCode(97 + part)}` : ''}`;

/** Kurzes Datum für die Anzeige: '2026-10-12' → '12.10.' */
export const dayLabel = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Text auf höchstens `max` Zeichen kürzen (an einer Wortgrenze, wenn eine nah genug liegt), mit „…“. */
export function clipChars(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Eintrag in Speicherform: Felder gekürzt, leere weggelassen. */
export function normalizeEntry(e: ActEntry): ActEntry {
  const out: ActEntry = { ...e, s: clipChars(e.s, SENTENCE_MAX) };
  if (e.b?.trim()) out.b = clipChars(e.b, BETTER_MAX);
  else delete out.b;
  if (e.w?.trim()) out.w = clipChars(e.w, WHY_MAX);
  else delete out.w;
  if (!e.r) delete out.r;
  if (!e.ns) delete out.ns;
  if (!e.ts || !e.ts.length) delete out.ts;
  if (!e.et) delete out.et;
  return out;
}

export type ActPlan =
  | { state: 'written'; op: { update: Doc } }
  /** Das Dokument fehlte und wurde nur als Gerüst `{v, month}` angelegt; der Eintrag folgt im nächsten Schritt (zwei Geräte legen so dasselbe Gerüst an, keines überschreibt den Eintrag des anderen). */
  | { state: 'created'; op: { set: Doc } }
  /** Die Kennung steht schon in diesem Dokument: nichts zu schreiben. */
  | { state: 'exists'; op: null }
  /** Dieses Dokument ist voll (oder als voll markiert): der Eintrag geht in die Fortsetzung. `op` markiert es mit `nx: 1`. */
  | { state: 'full'; op: { update: Doc } | null }
  /** Das Dokument hat einen unerwarteten Aufbau: nie anfassen. */
  | { state: 'invalid'; op: null };

/** Platz für Feldnamen und Kommas, die der Größenwächter zusätzlich zählt. */
const ENTRY_OVERHEAD = 16;

/**
 * Was mit dem Dokument `path` geschieht, wenn `entry` hineinsoll – aus dem frischen Stand `cur` (`writer.transform`). Rein.
 * Reihenfolge: fehlt (nur Gerüst anlegen) → ungültig → Kennung schon da → als voll markiert → würde über 200 KiB gehen (dann `nx: 1`) → ergänzen.
 */
export function planAct(path: string, cur: Doc | undefined, entry: ActEntry): ActPlan {
  const e = normalizeEntry(entry);
  const month = monthOf(e.d);
  if (!cur) return { state: 'created', op: { set: { v: 1, month } } };
  if (!validateDoc(path, cur).ok) return { state: 'invalid', op: null };
  const map = cur.e;
  if (map != null && (typeof map !== 'object' || Array.isArray(map))) return { state: 'invalid', op: null };
  if (map && Object.hasOwn(map, e.id)) return { state: 'exists', op: null };
  if (cur.nx === 1) return { state: 'full', op: null };
  if (jsonBytes(cur) + jsonBytes(e) + ENTRY_OVERHEAD > ACT_DOC_MAX_BYTES) return { state: 'full', op: { update: { nx: 1 } } };
  return { state: 'written', op: { update: { e: { [e.id]: e } } } };
}

/** Einträge eines Dokuments, einzeln geprüft: ungültige werden gemeldet und ausgelassen (nie das ganze Dokument verworfen). */
export function entriesOf(path: string, doc: Doc | undefined): ActEntry[] {
  const map = doc?.e;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  const out: ActEntry[] = [];
  let bad = 0;
  for (const [key, raw] of Object.entries(map as Record<string, unknown>)) {
    const r = actEntrySchema.safeParse(raw);
    if (r.success && r.data.id === key) out.push(r.data as unknown as ActEntry);
    else bad++;
  }
  if (bad) logWarn('data:act', new Error(`${bad} ungültige Einträge ausgelassen`), path);
  return out.sort((a, b) => a.t - b.t);
}

/** Geschaffte Aktivierungen einer Karte aus der Sammelakte (Note ≥ 2): daraus lässt sich `na` jederzeit neu berechnen. */
export const deriveNa = (entries: readonly ActEntry[], cardKey: string): number => entries.filter((x) => x.c === cardKey && x.g >= 2).length;

/** Lerntage mit Aktivierungen, die der Fahrplan als Beleg zählt: alle Einträge einer Karte. */
export const entriesOfCard = (entries: readonly ActEntry[], cardKey: string): ActEntry[] => entries.filter((x) => x.c === cardKey || x.ts?.some(([k]) => k === cardKey));
