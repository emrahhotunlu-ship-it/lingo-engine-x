import { TOPICS } from '../content';
import { CAT_IDS, topicCat } from '../grammar/radar';

// Fehler-Radar für „Dein Stand" (Plan §7.1): Ereignisse `app/radar.events` je Kategorie der
// letzten 30 Tage gegen die 30 Tage davor, mit Quellen und bis zu zwei Beispielen. Nur lesend:
// geschrieben wird das Radar von den Übungen (features/progress/persist.ts, `mergeRadar`).
// Kategorien sind die der alten App (`CAT_IDS`); ältere Einträge tragen Grammatik-Kennungen.

const DAY = 86_400_000;
export const RADAR_READ_MAX = 400;

export type RadarRowKind = 'cat' | 'topic' | 'raw';
export type RadarRow = {
  c: string;
  kind: RadarRowKind;
  n30: number;
  nPrev30: number;
  /** Veränderung der Fehlerzahl: `more` (mehr Fehler), `same`, `fewer`. */
  trend: 'more' | 'same' | 'fewer';
  sources: string[];
  examples: Array<{ g: string; a: string; q: string }>;
  /** „Üben": Grammatikthema → `errors:<topic>`, Kategorie mit eindeutigem Thema ebenso, sonst `null`. */
  action: string | null;
};

type Ev = { c: string; s: string; t: number; g: string; a: string; q: string };
const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function kindOf(c: string): RadarRowKind {
  if ((CAT_IDS as readonly string[]).includes(c)) return 'cat';
  if (TOPIC_IDS.has(c)) return 'topic';
  return 'raw';
}

/** Thema einer Kategorie, wenn genau eines dazu gehört (z. B. `passive`); `tense` hat viele → null. */
export function catTopic(c: string): string | null {
  if (TOPIC_IDS.has(c)) return c;
  const ts = TOPICS.filter((t) => topicCat(t.id) === c);
  return ts.length === 1 ? (ts[0]?.id ?? null) : null;
}

export function radarView(events: unknown, nowMs: number): RadarRow[] {
  const list: Ev[] = (Array.isArray(events) ? events : [])
    .slice(-RADAR_READ_MAX)
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .map((e) => ({ c: str(e.c), s: str(e.s), t: num(e.t), g: str(e.g), a: str(e.a), q: str(e.q) }))
    .filter((e) => e.c && e.t > 0);
  const rows = new Map<string, { n30: number; nPrev30: number; sources: Set<string>; examples: Ev[] }>();
  for (const e of list) {
    const age = nowMs - e.t;
    if (age < 0 || age >= 60 * DAY) continue;
    const r = rows.get(e.c) ?? { n30: 0, nPrev30: 0, sources: new Set<string>(), examples: [] };
    if (age < 30 * DAY) {
      r.n30++;
      if (e.s) r.sources.add(e.s);
      if (e.g || e.a) r.examples.push(e);
    } else r.nPrev30++;
    rows.set(e.c, r);
  }
  return [...rows.entries()]
    .map(([c, r]): RadarRow => {
      const trend = r.n30 > r.nPrev30 ? 'more' : r.n30 < r.nPrev30 ? 'fewer' : 'same';
      const topic = catTopic(c);
      const examples = r.examples
        .sort((a, b) => b.t - a.t)
        .filter((e, i, a) => a.findIndex((x) => x.g === e.g && x.a === e.a) === i)
        .slice(0, 2)
        .map((e) => ({ g: e.g, a: e.a, q: e.q }));
      return { c, kind: kindOf(c), n30: r.n30, nPrev30: r.nPrev30, trend, sources: [...r.sources].sort(), examples, action: topic ? `errors:${topic}` : null };
    })
    .filter((r) => r.n30 > 0 || r.nPrev30 > 0)
    .sort((a, b) => b.n30 - a.n30 || b.nPrev30 - a.nPrev30 || a.c.localeCompare(b.c));
}

/** Summen für den Can-Do-Beleg `errors` (Plan §7.2). */
export function radarTotals(events: unknown, nowMs: number): { n30: number; nPrev30: number } {
  let n30 = 0;
  let nPrev30 = 0;
  for (const r of radarView(events, nowMs)) {
    n30 += r.n30;
    nPrev30 += r.nPrev30;
  }
  return { n30, nPrev30 };
}
