import { TOPICS } from '../content';

// Fehler-Radar `app/radar.events` (Plan D7): Fehler aus Sprechen (`s:'k'`) und Business
// (`s:'b'`) als Belege für Phase 6. Nur Kategorien aus den 16 Grammatikthemen, Format der alten
// App `{c, s, t, q ≤ 160, g ≤ 100, a ≤ 100}`, höchstens 400 Einträge (die neuesten bleiben).
// `grammar/<topic>` wird NICHT verändert (gedämpftes BKT bleibt unberührt).

type Doc = Record<string, unknown>;

export const RADAR_MAX = 400;
const GRAMMAR_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id));

export type RadarError = { cat: string; wrong: string; right: string; sentence: string };
export type RadarEvent = { c: string; s: 'k' | 'b'; t: number; q: string; g: string; a: string };

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

export const isGrammarCat = (c: string): boolean => GRAMMAR_IDS.has(c);

/** Nur Grammatik-Kategorien; Zeitstempel je Fehler um 1 ms versetzt (eindeutig). */
export function radarEvents(errors: readonly RadarError[], source: 'k' | 'b', t0: number): RadarEvent[] {
  return errors
    .filter((e) => isGrammarCat(e.cat))
    .map((e, i) => ({ c: e.cat, s: source, t: t0 + i, q: cut(e.sentence, 160), g: cut(e.wrong, 100), a: cut(e.right, 100) }));
}

/** Schreibvorgang aus dem frischen Stand von `app/radar`. `null` = nichts zu tun. */
export function radarOp(cur: Doc | undefined, add: readonly RadarEvent[]): { set: Doc } | { update: Doc } | null {
  if (!add.length) return null;
  if (!cur) return { set: { events: add.slice(-RADAR_MAX) } };
  if (cur.events != null && !Array.isArray(cur.events)) return null;
  const list: unknown[] = Array.isArray(cur.events) ? cur.events : [];
  const seen = new Set(list.map((e) => (e && typeof e === 'object' ? `${String((e as Doc).t)}|${String((e as Doc).c)}` : '')));
  const fresh = add.filter((e) => !seen.has(`${e.t}|${e.c}`));
  if (!fresh.length) return null;
  return { update: { events: [...list, ...fresh].slice(-RADAR_MAX) } };
}
