import { addDays } from '../domain/date';
import { addedDay, type RepairDoc } from './repair';
import { topicById } from './grammar';
import type { WritingMonths } from './writing';
import { WRITE_CATS } from './writing';

// Stolpersteine (docs/neustart.md §6 „je Fehlerart“): die häufigsten Fehlerarten der letzten 30 Tage,
// verglichen mit den 30 Tagen davor. Quellen sind genau zwei, damit nichts doppelt zählt:
// - Schreiben: jeder Fehler der Korrektur nach seiner Art (`cat`),
// - Grammatik: jede falsch beantwortete getippte Aufgabe nach Thema (die Einträge in coach/repair
//   mit `src: 'grammar'`; ihr Anlegedatum ist der Fehlertag).
// Die Reparatur-Einträge aus dem Schreiben zählen nicht noch einmal.

export const STUMBLE_WINDOW = 30;

/** Grammatik-Themen, die genau einer Fehlerart des Schreibens entsprechen (zählen zusammen). */
const TOPIC_AS_CAT: Readonly<Record<string, string>> = { articles: 'articles', prepositions: 'prepositions' };

export type StumbleStat = { key: string; n: number; prev: number; trend: 'up' | 'down' | 'same' };

export const stumbleKeyOfTopic = (topic: string): string => TOPIC_AS_CAT[topic] ?? `topic:${topic}`;

function keyOfCat(cat: string): string {
  return (WRITE_CATS as readonly string[]).includes(cat) ? cat : 'other';
}

/** Top-Fehlerarten (höchstens `limit`), häufigste zuerst. Gleiche Anzahl: alphabetisch (fest). */
export function stumbleStats(writing: WritingMonths, repair: RepairDoc, today: string, limit = 5): StumbleStat[] {
  const nowFrom = addDays(today, -(STUMBLE_WINDOW - 1));
  const prevFrom = addDays(today, -(2 * STUMBLE_WINDOW - 1));
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  const count = (day: string, key: string): void => {
    if (day >= nowFrom && day <= today) cur.set(key, (cur.get(key) ?? 0) + 1);
    else if (day >= prevFrom && day < nowFrom) prev.set(key, (prev.get(key) ?? 0) + 1);
  };
  for (const slots of Object.values(writing)) {
    for (const entry of Object.values(slots)) for (const err of entry.e) count(entry.d, keyOfCat(err.cat));
  }
  for (const rec of Object.values(repair)) {
    if (rec.src === 'grammar' && rec.topic) count(addedDay(rec), stumbleKeyOfTopic(rec.topic));
  }
  return [...cur]
    .map(([key, n]) => {
      const p = prev.get(key) ?? 0;
      return { key, n, prev: p, trend: n > p ? ('up' as const) : n < p ? ('down' as const) : ('same' as const) };
    })
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, 'en'))
    .slice(0, limit);
}

/** Englische Bezeichnungen der häufigsten Fehlerarten (für `coach/summary`, schlank). */
export function weakCatsOf(stats: readonly StumbleStat[], n = 3): string[] {
  return stats.slice(0, n).map((s) => (s.key.startsWith('topic:') ? (topicById(s.key.slice(6))?.name_en ?? s.key.slice(6)) : s.key));
}
