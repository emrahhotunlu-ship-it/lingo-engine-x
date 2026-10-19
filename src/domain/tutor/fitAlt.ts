import { fitAltHash, readFitAlt, type FitAltEntry } from './judge';

// Gelernte „Auch richtig“-Antworten je Thema (Tutor-Engine v3 §3.2): `grammar/<topic>.fitAlt = {[taskKey]: {[hash]: {a, t, by, pv}}}`.
// Rein. Ausgeführt im Schreibweg `grammar/<topic>` (writer.transform auf dem frischen Stand, Datenregel 9 der Aktivierung):
//   - Objekt-Map mit festen Schlüsseln (Aufgabe, Hash der normalisierten Antwort): zwei Geräte schreiben verschiedene Schlüssel,
//     `update` führt verschachtelte Objekte zusammen – beide Einträge bleiben.
//   - Idempotent: derselbe Hash mit derselben oder schwächeren Herkunft ergibt keinen Patch.
//   - Deckel: höchstens 8 je Aufgabe, 60 je Thema. Der älteste Eintrag fällt beim Schreiben heraus. Weil `update` verschachtelt
//     zusammenführt und Schlüssel nie entfernt (contract/db.d.ts), steht ein verdrängter Eintrag danach als `null` (Grabstein, ~12 B).
//   - Größenwächter: über 8 KB wird nicht mehr geschrieben (Grabsteine eingerechnet). Lernstände werden nie gelöscht.

export const FITALT_PER_TASK = 8;
export const FITALT_PER_TOPIC = 60;
export const FITALT_MAX_BYTES = 8192;
/** Antworttext höchstens 80 Zeichen (wie `fitAskable`), Prompt-Version höchstens 24. */
const A_MAX = 80;
const PV_MAX = 24;

type Doc = Readonly<Record<string, unknown>>;
export type FitAltPatch = { fitAlt: Record<string, Record<string, FitAltEntry | null>> };
export type FitAltSkip = 'same' | 'empty' | 'too_big' | 'bad_type';

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v ?? {})).length;

/**
 * Patch für eine neue gelernte Antwort oder der Grund, warum nichts geschrieben wird. `by:'me'` (Emrahs Einspruch) darf ein `ai`-Urteil
 * aufwerten; ein `ai`-Urteil überschreibt nie ein `me`. Zeitstempel `t` ist der der Antwort (deterministisch, kein `Date.now()`).
 */
export function fitAltPatch(cur: Doc | undefined, taskKey: string, given: string, by: FitAltEntry['by'], pv: string, t: number): FitAltPatch | FitAltSkip {
  const a = given.trim().replace(/\s+/g, ' ').slice(0, A_MAX);
  if (!a || !taskKey) return 'empty';
  // Typprüfung vor dem Schreiben: steht dort etwas anderes als ein Objekt (Text, Liste, Zahl), wird es nie überschrieben.
  if (cur?.fitAlt !== undefined && cur.fitAlt !== null && !obj(cur.fitAlt)) return 'bad_type';
  const h = fitAltHash(a);
  const index = readFitAlt(cur);
  const old = index[taskKey]?.[h];
  if (old && (old.by === by || old.by === 'me')) return 'same';
  const entry: FitAltEntry = { a, t, by, pv: pv.slice(0, PV_MAX) };
  const patch: Record<string, Record<string, FitAltEntry | null>> = { [taskKey]: { [h]: entry } };

  if (!old) {
    // Je Aufgabe: lebende Einträge plus der neue höchstens 8 – der älteste fällt heraus.
    const mine = Object.entries(index[taskKey] ?? {}).sort((x, y) => x[1].t - y[1].t || x[0].localeCompare(y[0]));
    const evicted = new Set<string>();
    while (mine.length + 1 > FITALT_PER_TASK) {
      const [k] = mine.shift() as [string, FitAltEntry];
      (patch[taskKey] as Record<string, FitAltEntry | null>)[k] = null;
      evicted.add(`${taskKey}\u0000${k}`);
    }
    // Je Thema: höchstens 60 lebende Einträge.
    const all: Array<[string, string, number]> = [];
    for (const [tk, m] of Object.entries(index)) for (const [k, e] of Object.entries(m)) if (!evicted.has(`${tk}\u0000${k}`)) all.push([tk, k, e.t]);
    all.sort((x, y) => x[2] - y[2] || x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]));
    while (all.length + 1 > FITALT_PER_TOPIC) {
      const [tk, k] = all.shift() as [string, string, number];
      (patch[tk] ??= {})[k] = null;
    }
  }

  // Größenwächter über das Ergebnis (wie `update` es zusammenführt).
  const merged: Record<string, Record<string, unknown>> = {};
  const raw = obj(cur?.fitAlt) ?? {};
  for (const [tk, m] of Object.entries(raw)) merged[tk] = { ...(obj(m) ?? {}) };
  for (const [tk, m] of Object.entries(patch)) merged[tk] = { ...(merged[tk] ?? {}), ...m };
  if (bytes(merged) > FITALT_MAX_BYTES) return 'too_big';
  return { fitAlt: patch };
}

export const isFitAltPatch = (r: FitAltPatch | FitAltSkip): r is FitAltPatch => typeof r === 'object';

/** Eine Zeile der Liste für den Englischlehrer (Diagnose-Ansicht): Thema, Aufgabe, Antwort, Herkunft, Zeitpunkt, Prompt-Version. */
export type FitAltRow = { topic: string; task: string; a: string; by: FitAltEntry['by']; t: number; pv: string };

/** Alle lebenden Einträge aller Grammatik-Dokumente, neueste zuerst. */
export function fitAltRows(docs: ReadonlyMap<string, Doc> | Iterable<readonly [string, Doc]>): FitAltRow[] {
  const out: FitAltRow[] = [];
  for (const [topic, doc] of docs) {
    for (const [task, m] of Object.entries(readFitAlt(doc))) for (const e of Object.values(m)) out.push({ topic, task, a: e.a, by: e.by, t: e.t, pv: e.pv });
  }
  return out.sort((x, y) => y.t - x.t || x.topic.localeCompare(y.topic) || x.a.localeCompare(y.a));
}

/** Klartext für die Gegenlesung (eine Zeile je Eintrag, Tab-getrennt). */
export function fitAltText(rows: readonly FitAltRow[]): string {
  return ['topic\ttask\tanswer\tby\tt\tpv', ...rows.map((r) => [r.topic, r.task, r.a, r.by, new Date(r.t).toISOString(), r.pv].join('\t'))].join('\n');
}
