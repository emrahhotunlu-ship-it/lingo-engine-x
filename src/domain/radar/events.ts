import { validateDoc } from '../../data/validate';
import { TOPICS } from '../content';
import { sentenceSplit } from '../input/textStats';
import type { TextError } from '../input/types';

// Fehler-Radar `app/radar.events` im Altformat {c, s, t, q, g, a} (Plan §3.8, F10):
// c = Grammatikthema (eine der 16 Kennungen) bzw. Kategorie, s = Quelle ('w' Schreiben und
// Anwenden, 'r' Lesezusammenfassung), q = Satz mit der Stelle, g = gegeben, a = richtig.
// Britische Formen kommen nie hinein (usHints sind vorher abgetrennt, F11).

type Doc = Record<string, unknown>;
export type RadarEvent = { c: string; s: 'w' | 'r'; t: number; q: string; g: string; a: string };

export const RADAR_MAX = 400;
export const RADAR_MAX_BYTES = 200 * 1024;
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

const cut = (s: string, n: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n) : flat;
};

function sentenceAt(text: string, span: [number, number] | null, orig: string): string {
  if (span) {
    const s = sentenceSplit(text).find((x) => x.start <= span[0] && span[0] < x.end);
    if (s) return s.text;
  }
  return orig;
}

export function radarEvents(errors: readonly TextError[], text: string, s: 'w' | 'r', t0: number): RadarEvent[] {
  return errors
    .filter((e) => e.orig.trim() || e.fix.trim())
    .map((e, i) => ({
      c: e.cat === 'grammar' && e.topic && TOPIC_IDS.has(e.topic) ? e.topic : e.cat,
      s,
      t: t0 + i,
      q: cut(sentenceAt(text, e.span, e.orig), 160),
      g: cut(e.orig, 100),
      a: cut(e.fix, 100),
    }));
}

const keyOf = (e: unknown): string => {
  const r = (e && typeof e === 'object' ? e : {}) as Doc;
  return `${String(r.t)}|${String(r.q)}|${String(r.g)}`;
};
const tOf = (e: unknown): number => {
  const t = e && typeof e === 'object' ? (e as Doc).t : undefined;
  return typeof t === 'number' && Number.isFinite(t) ? t : 0;
};

/**
 * Neue Liste aus frischem Stand + neuen Ereignissen, ohne Doppelte (t|q|g), nach Zeit, die neuesten
 * 400, danach ≤ 200 KiB. Fehlt `app/radar`, wird es angelegt. Ungültiges Dokument → `null`
 * (nie überschreiben; der Aufrufer protokolliert).
 */
export function radarPatch(cur: Readonly<Doc> | undefined, add: readonly RadarEvent[]): { set: Doc } | { update: Doc } | null {
  if (!add.length) return null;
  if (cur && (!validateDoc('app/radar', cur).ok || (cur.events != null && !Array.isArray(cur.events)))) return null;
  const existing = cur && Array.isArray(cur.events) ? (cur.events as unknown[]) : [];
  const seen = new Set(existing.map(keyOf));
  const fresh = add.filter((e) => !seen.has(keyOf(e)));
  if (!fresh.length) return null;
  const all = [...existing, ...fresh]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => tOf(a.e) - tOf(b.e) || a.i - b.i)
    .map((x) => x.e);
  let events = all.slice(-RADAR_MAX);
  while (events.length > 1 && new TextEncoder().encode(JSON.stringify(events)).length > RADAR_MAX_BYTES) events = events.slice(1);
  return cur ? { update: { events } } : { set: { events } };
}
