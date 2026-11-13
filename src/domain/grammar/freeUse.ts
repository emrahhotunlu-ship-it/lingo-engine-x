// „Frei verwendet“ je Grammatik-Muster (Großpaket P „Politur“, P4 „Anwenden als Brücke“, 13.11.2026). Rein.
//
// Ein eigener Beleg-Zähler: Emrah hat das Muster in einem EIGENEN Satz benutzt und Claude hat es als richtig beurteilt. Er steht bewusst NICHT in
// `pats[muster]` (dort zählen nur Aufgaben der Grammatikrunde; ein neuer `pats`-Eintrag würde den Musterzustand, den Themenzustand und das erste
// Anlegen aller Muster eines begonnenen Themas verändern), sondern daneben im selben Dokument:
//
//   grammar/<thema>.fu = { "<muster>": { n: 3, d: "2026-11-13" } }     n = gezählte Lerntage (≤ 99) · d = zuletzt gezählter Lerntag
//
// Regeln: nie ein BKT-Schritt, nie `p`, `n`, `c`, `last`, `due`, `pats`, `hist`; höchstens ein Beleg je Muster und Lerntag (idempotent über `d`, nur
// vorwärts); ein Thema-Dokument wird dafür nie angelegt (ohne Lernstand kein Beleg); ein Eintrag mit unerwartetem Aufbau wird nie überschrieben.

type Doc = Readonly<Record<string, unknown>>;

export const FREE_USE_MAX = 99;
/** Höchstens so viele Muster je Thema (ein Thema hat höchstens 8 Muster; Reserve für umbenannte). */
export const FREE_USE_KEYS = 16;

export type FreeUse = { n: number; d: string | null };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAT_RE = /^[a-z0-9]{2,6}\.[a-z0-9-]{2,32}$/;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** Ein Eintrag, tolerant gelesen; `null` = vorhanden, aber unerwarteter Aufbau (wird nie überschrieben). Fehlt er, gilt `{n: 0, d: null}`. */
export function readFreeUse(raw: unknown): FreeUse | null {
  if (raw === undefined || raw === null) return { n: 0, d: null };
  if (!isObj(raw) || typeof raw.n !== 'number' || !Number.isInteger(raw.n) || raw.n < 0) return null;
  const d = typeof raw.d === 'string' && DAY_RE.test(raw.d) ? raw.d : null;
  return { n: Math.min(FREE_USE_MAX, raw.n), d };
}

/** Alle lesbaren Zähler eines Thema-Dokuments (Muster-Kennung → Zähler). */
export function freeUsesOf(doc: Doc | null | undefined): Record<string, FreeUse> {
  const out: Record<string, FreeUse> = {};
  const fu = doc?.fu;
  if (!isObj(fu)) return out;
  for (const [id, raw] of Object.entries(fu)) {
    const e = readFreeUse(raw);
    if (e && e.n > 0) out[id] = e;
  }
  return out;
}

/** Zähler eines Musters (0 ohne Eintrag). */
export const freeUseOf = (doc: Doc | null | undefined, pat: string): FreeUse => freeUsesOf(doc)[pat] ?? { n: 0, d: null };

/**
 * Patch „Muster am Lerntag `day` frei richtig verwendet“ für `writer.transform` auf dem FRISCHEN Thema-Dokument. `null` = nichts zu schreiben:
 * Dokument fehlt, Kennung oder Tag ungültig, an diesem (oder einem späteren) Lerntag schon gezählt, Aufbau unerwartet oder Liste voll.
 * `update` verschmilzt verschachtelte Objekte: die anderen Muster in `fu` bleiben stehen.
 */
export function freeUsePatch(cur: Doc | null | undefined, pat: string, day: string): { fu: Record<string, { n: number; d: string }> } | null {
  if (!cur || !PAT_RE.test(pat) || !DAY_RE.test(day)) return null;
  if (cur.fu !== undefined && cur.fu !== null && !isObj(cur.fu)) return null;
  const fu = isObj(cur.fu) ? cur.fu : {};
  const e = readFreeUse(fu[pat]);
  if (!e) return null;
  // Nur vorwärts: ein späterer Abschluss eines früheren Lerntags (anderes Gerät) zählt nicht noch einmal und setzt `d` nie zurück.
  if (e.d !== null && day <= e.d) return null;
  if (!(pat in fu) && Object.keys(fu).length >= FREE_USE_KEYS) return null;
  return { fu: { [pat]: { n: Math.min(FREE_USE_MAX, e.n + 1), d: day } } };
}
