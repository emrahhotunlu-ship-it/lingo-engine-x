import { c1Schema } from '../../data/schemas';
import { getWriter } from '../../data';
import { logWarn } from '../../platform/diagnostics';
import { addDays, dayKey, dayKeyNoon } from '../date';
import { jsonEqual } from '../equal';
import { jsonBytes } from '../monthDoc';

// Das Dokument `app/c1` (Lernplattform 3.0 §4.8, P31): Einstufung, C1-Checks, Kapitelprüfungen, Produktionsmengen und gemeldete Aufgaben.
// Regeln: nur ergänzend, nie gelöscht, nie in ein ungültiges Dokument, nur bei Änderung, Lesen und Schreiben in EINEM Schritt (`writer.transform`).
// Der Kapitelstand steht hier NICHT (er wird aus den Mustern abgeleitet, `state.ts`); nur die WAHL des Kapitels (`ch`, Kapitel-Arbeiten 11.10.2026)
// und ihr Verlauf (`chh`, ≤ 20) stehen hier. Höchstwerte sichern die Größe (< 30 KB) auf Dauer.

export const C1_PATH = 'app/c1';

export const C1_LIMITS = {
  checks: 24,
  gates: 35,
  prod: 150,
  bad: 300,
  /** Einstufung: beantwortete Aufgaben (Paare Kennung/Ergebnis). */
  placeIt: 22,
  /** Verlauf der Kapitelwahl (`chh`). */
  chh: 20,
  /** Dokument insgesamt (Bytes, UTF-8). */
  maxBytes: 30 * 1024,
  /** Einträge von `prod`, die älter sind, werden zu Wochensummen verdichtet. */
  prodWeeks: 8,
} as const;

/** `th` = θ der Einstufung (Zusatzfeld zu §4.8, nur unter „Messwerte dahinter“ angezeigt). */
/** `vw` = Spanne bekannter Wörter unter den 6.000 häufigsten (Teil 1 der Einstufung, P34; Zusatzfeld, nur ergänzend). */
export type C1Place = { d: string; se: number; n: number; th?: number; skip: string[]; it?: Array<[string, 0 | 1]>; vw?: [number, number] };
export type C1Check = {
  d: string;
  f: string;
  inp: 'touch' | 'desk';
  p: [number, number, number, number];
  pts: number;
  max: 36;
  fc?: { from: string; to: string; late: string; inc?: string[]; out?: string[] } | { pause: string } | null;
  m?: Array<[string, number]>;
};
export type C1Gate = { d: string; ch: number; g: [number, number]; w: [number, number]; ok: boolean };
/** `wk: true` = Wochensumme (Tag `d` ist der Montag). */
/** `id` = Kennung des Textes (`out/<Monat>`-Eintrag; steht sie in `bad`, zählt der Eintrag nicht); `u: true` = unsicher (Nachzählung weicht stark ab oder Stelle gemeldet): zählt nie für „erfüllt“. Beide additiv. */
export type C1Prod = { d: string; s: 'mail' | 'clinic' | 'talk'; w: number; e: number; wk?: true; id?: string; u?: true };

/** Gewähltes Kapitel (Kapitel-Arbeiten, 11.10.2026): `n` = Nummer 1–7, `d` = Lerntag der Wahl. */
export type C1Choice = { n: number; d: string };

export type C1Doc = {
  v: 1;
  place?: C1Place;
  checks: C1Check[];
  gates: C1Gate[];
  prod: C1Prod[];
  bad: string[];
  /** Gewähltes Kapitel (nur ergänzend; fehlt = noch nie gewählt, dann gilt das abgeleitete Kapitel). */
  ch?: C1Choice;
  /** Verlauf der Wahl `[n, Lerntag]`, älteste zuerst, ≤ 20. */
  chh?: Array<[number, string]>;
};

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const emptyC1 = (): C1Doc => ({ v: 1, checks: [], gates: [], prod: [], bad: [] });

/** Kann das Dokument gelesen und ergänzt werden? Fehlt es, ja; hat es einen unerwarteten Aufbau oder eine neuere Fassung, nein. */
export function c1Readable(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (!isObj(raw)) return false;
  if (raw.v !== undefined && raw.v !== null && raw.v !== 1) return false;
  return c1Schema.safeParse(raw).success;
}

/** Dokument lesen (tolerant, mit Vorgabewerten). Ein unlesbares Dokument liefert das leere. */
export function readC1(raw: unknown): C1Doc {
  const out = emptyC1();
  if (!isObj(raw) || !c1Readable(raw)) return out;
  if (isObj(raw.place)) out.place = structuredClone(raw.place) as C1Place;
  out.checks = structuredClone(arr<C1Check>(raw.checks));
  out.gates = structuredClone(arr<C1Gate>(raw.gates));
  out.prod = structuredClone(arr<C1Prod>(raw.prod));
  out.bad = arr<string>(raw.bad).filter((x) => typeof x === 'string');
  const ch = readChoice(raw.ch);
  if (ch) out.ch = ch;
  const chh = arr<unknown>(raw.chh).filter((e): e is [number, string] => Array.isArray(e) && isChapterNo(e[0]) && isDay(e[1]));
  if (chh.length) out.chh = chh.map((e) => [e[0], e[1]]);
  return out;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v);
const isChapterNo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7;

/** Gewähltes Kapitel tolerant lesen: nur `{n: 1–7, d: Lerntag}`, sonst `null`. */
export function readChoice(v: unknown): C1Choice | null {
  if (!isObj(v) || !isChapterNo(v.n) || !isDay(v.d)) return null;
  return { n: v.n, d: v.d };
}

/** Gewähltes Kapitel aus dem Roh-Dokument `app/c1` (unlesbares Dokument: `null`). */
export const chosenChapterOf = (raw: unknown): C1Choice | null => (isObj(raw) && c1Readable(raw) ? readChoice(raw.ch) : null);

/**
 * Hat das C1-Programm begonnen? Früher reichte „`app/c1` ist da“. Seit der Kapitelwahl kann das Dokument nur `ch`/`chh` tragen: das zählt NICHT
 * (die erste Wahl darf keinen C1-Check-Tag auslösen, K0). Ohne `ch`/`chh` gilt wie bisher „Dokument da = begonnen“; mit Wahl zählt nur Einstufung,
 * Check, Kapitelprüfung, Produktion oder gemeldete Aufgabe.
 */
export function programStartedOf(raw: unknown): boolean {
  if (!isObj(raw)) return false;
  if (!c1Readable(raw)) return true;
  const d = readC1(raw);
  // Ohne Kapitelwahl gilt wie bisher: das Dokument ist da, also hat das Programm begonnen.
  if (!d.ch && !d.chh) return true;
  return !!d.place || d.checks.length > 0 || d.gates.length > 0 || d.prod.length > 0 || d.bad.length > 0;
}

/** Kapitel wählen (rein): `ch` setzen und an `chh` anhängen (≤ 20, die ältesten fallen weg). `null`, wenn dasselbe Kapitel schon gewählt ist. */
export function chooseChapter(doc: C1Doc, n: number, day: string): C1Doc | null {
  if (!isChapterNo(n) || !isDay(day)) return null;
  if (doc.ch?.n === n) return null;
  const chh: Array<[number, string]> = [...(doc.chh ?? []), [n, day]];
  return { ...doc, ch: { n, d: day }, chh: chh.slice(-C1_LIMITS.chh) };
}

/** Montag der Woche eines Tagesschlüssels. */
export function weekStart(day: string): string {
  const dow = new Date(dayKeyNoon(day)).getDay();
  return addDays(day, -((dow + 6) % 7));
}

/** Einträge von `prod`, die älter als `prodWeeks` Wochen sind, zu Wochensummen (je Woche und Art) verdichten. Rein. */
export function compactProd(prod: readonly C1Prod[], today: string, bad: readonly string[] = []): C1Prod[] {
  const cutoff = addDays(today, -C1_LIMITS.prodWeeks * 7);
  const keep: C1Prod[] = [];
  const sums = new Map<string, C1Prod>();
  const gone = new Set(bad);
  for (const e of prod) {
    if (e.d >= cutoff) {
      keep.push(e);
      continue;
    }
    const wk = weekStart(e.d);
    const key = `${wk}|${e.s}`;
    const cur = sums.get(key);
    // Gemeldete Texte (Kennung in `bad`) gehen in die Wochensumme ein, die Summe wird unsicher (`u`): sie zählt nie für „erfüllt“. Nichts wird verworfen.
    const unsure = e.u === true || (!!e.id && gone.has(e.id));
    if (cur) {
      cur.w += e.w;
      cur.e += e.e;
      if (unsure) cur.u = true;
    } else sums.set(key, { d: wk, s: e.s, w: e.w, e: e.e, wk: true, ...(unsure ? { u: true as const } : {}) });
  }
  // Nichts Altes zu verdichten und nichts zu gewinnen: Liste unverändert zurück (keine unnötige Umformung).
  if (!sums.size) return [...prod];
  return [...sums.values(), ...keep].sort((a, b) => a.d.localeCompare(b.d));
}

/** Verdichten und kappen. Die ältesten Einträge fallen zuerst weg (mit Protokoll, nie still). Rein. */
export function compactC1(doc: C1Doc, today: string): C1Doc {
  const out: C1Doc = { ...doc };
  const cap = <T>(name: string, list: T[], max: number): T[] => {
    if (list.length <= max) return list;
    logWarn('c1:compact', new Error(`${list.length - max} oldest ${name} entries removed (max ${max})`), C1_PATH);
    return list.slice(list.length - max);
  };
  out.prod = cap('prod', compactProd(doc.prod, today, doc.bad), C1_LIMITS.prod);
  out.checks = cap('checks', doc.checks, C1_LIMITS.checks);
  out.gates = cap('gates', doc.gates, C1_LIMITS.gates);
  out.bad = cap('bad', doc.bad, C1_LIMITS.bad);
  if (out.place?.it && out.place.it.length > C1_LIMITS.placeIt) out.place = { ...out.place, it: out.place.it.slice(0, C1_LIMITS.placeIt) };
  return out;
}

const FIELDS = ['place', 'checks', 'gates', 'prod', 'bad', 'ch', 'chh'] as const;

/**
 * Schreibvorgang für `writer.transform('app/c1', …)` aus dem frischen Stand. `change` bekommt eine Kopie des gelesenen Dokuments und liefert das
 * neue (oder `null` = nichts tun). Geschrieben werden nur die Felder, die sich ändern; fremde Felder bleiben unangetastet. `null`, wenn das Dokument
 * einen unerwarteten Aufbau hat (nie angefasst), nichts zu schreiben ist oder das Ergebnis über 30 KB läge (dann bleibt der alte Stand stehen).
 */
export function c1Update(
  cur: Record<string, unknown> | undefined,
  change: (doc: C1Doc) => C1Doc | null,
  today: string,
): { set: Record<string, unknown> } | { update: Record<string, unknown> } | null {
  if (cur !== undefined && !c1Readable(cur)) {
    logWarn('c1:write', new Error('app/c1 hat einen unerwarteten Aufbau, nichts geschrieben'), C1_PATH);
    return null;
  }
  const base = readC1(cur);
  const proposed = change(structuredClone(base));
  if (!proposed) return null;
  const next = compactC1(proposed, today);
  if (jsonBytes(next) > C1_LIMITS.maxBytes) {
    logWarn('c1:write', new Error(`app/c1 wäre ${jsonBytes(next)} Bytes groß (max ${C1_LIMITS.maxBytes}), nichts geschrieben`), C1_PATH);
    return null;
  }
  if (cur === undefined) {
    if (jsonEqual(next, base)) return null;
    return { set: next as unknown as Record<string, unknown> };
  }
  const upd: Record<string, unknown> = {};
  for (const k of FIELDS) {
    const a = (next as Record<string, unknown>)[k];
    if (a !== undefined && !jsonEqual(a, (base as Record<string, unknown>)[k])) upd[k] = a;
  }
  // Fehlt das Feld `v` im bestehenden Dokument, bleibt es fehlen (nur ergänzen, wenn sich sonst etwas ändert).
  if (!Object.keys(upd).length) return null;
  if (cur.v === undefined || cur.v === null) upd.v = 1;
  return { update: upd };
}

export type PatchResult = 'created' | 'updated' | 'unchanged' | 'unavailable' | 'failed';

/** Dokument ergänzen: Lesen, Rechnen, Schreiben in einem Schritt der Warteschlange. Nie geworfen: Fehler stehen im Protokoll. */
export async function patchC1(change: (doc: C1Doc) => C1Doc | null, now: number = Date.now()): Promise<PatchResult> {
  const writer = getWriter();
  if (!writer) return 'unavailable';
  try {
    return await writer.transform(C1_PATH, (cur) => c1Update(cur, change, dayKey(now)));
  } catch (err) {
    logWarn('c1:write', err, C1_PATH);
    return 'failed';
  }
}

/** Aufgabe als gemeldet vermerken (Ring von 300). Doppelte Meldungen ändern nichts. */
export const markBad = (doc: C1Doc, id: string): C1Doc | null => (doc.bad.includes(id) ? null : { ...doc, bad: [...doc.bad, id] });
