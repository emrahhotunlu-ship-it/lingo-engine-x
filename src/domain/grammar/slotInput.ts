import { liveErrorsOf } from './errors';
import { chapters, patternById, patternsOf, topicsWithPatterns } from './patterns';
import { patsOf } from '../metrics/pattern';
import type { PatInfo } from './slotPlan';

// Rohdaten für `slotPlan()` aus den Grammatik-Dokumenten (P15): alle Muster des Pfads mit Kapitel und Eintrag, offene Fehlersätze je Muster.

type Doc = Readonly<Record<string, unknown>>;

/** Alle Muster aller Themen mit Musterdatei: Kapitel (Index in der Pfad-Reihenfolge, Themen ohne Kapitel hinten) und der Eintrag aus `pats`. */
export function patInfos(docs: ReadonlyMap<string, Doc>): PatInfo[] {
  const chs = chapters();
  const chapterOf = (topic: string): number => {
    const k = chs.findIndex((c) => c.topics.includes(topic));
    return k < 0 ? chs.length : k;
  };
  const out: PatInfo[] = [];
  for (const topic of topicsWithPatterns()) {
    const set = patsOf(docs.get(topic));
    for (const p of patternsOf(topic)?.patterns ?? []) out.push({ id: p.id, chapter: chapterOf(topic), entry: set[p.id] });
  }
  return out;
}

/** Offene Fehlersätze je Muster (Fehler-Radar der Muster, nur Einträge mit `pat`). */
export function errorsByPat(docs: ReadonlyMap<string, Doc>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [topic, doc] of docs) {
    for (const e of liveErrorsOf(doc, topic)) {
      const pat = typeof e.pat === 'string' ? e.pat : '';
      if (pat && patternById(pat)) out[pat] = (out[pat] ?? 0) + 1;
    }
  }
  return out;
}
