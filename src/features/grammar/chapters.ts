import { chapters, patternsOf } from '../../domain/grammar/patterns';
import { patsOf, patternState, patternStateNo } from '../../domain/metrics/pattern';
import { topicState, type TopicState } from '../../domain/grammar/path';

// Lernweg in 7 Kapiteln (Lernplattform 2.0 §2.4, `content/grammar/path.json`): je Kapitel Zustand, „Muster sicher x/y“ je Thema,
// Fehlersätze als EINE Zahl am Kapitelkopf. Das aktuelle Kapitel („Du bist hier“) ist das erste, in dem noch nicht jedes Thema „Sicher“ ist.

type Doc = Readonly<Record<string, unknown>>;

export type TopicNode = { id: string; state: TopicState; patSafe: number; patTotal: number; due: number };
export type ChapterNode = { id: string; name: { de: string; en: string }; topics: TopicNode[]; safe: number; due: number };

const isSafe = (s: TopicState): boolean => s === 'safe' || s === 'firm';

export function chapterNodes(i: { docs: ReadonlyMap<string, Doc>; nowMs: number; today: string; dueByTopic: ReadonlyMap<string, number> }): { chapters: ChapterNode[]; current: number } {
  const list = chapters().map((c): ChapterNode => {
    const topics = c.topics.map((id): TopicNode => {
      const doc = i.docs.get(id);
      const ids = patternsOf(id)?.patterns.map((p) => p.id) ?? [];
      const entries = patsOf(doc);
      const patSafe = ids.filter((p) => patternStateNo(patternState(entries[p], i.today)) >= 2).length;
      // Zustand und Zähler aus derselben Quelle: ohne ein einziges sicheres Muster gilt das Thema nicht als „Sicher“.
      const raw = topicState(id, doc, i.nowMs);
      const state: TopicState = isSafe(raw) && ids.length > 0 && patSafe === 0 ? 'learning' : raw;
      return { id, state, patSafe, patTotal: ids.length, due: i.dueByTopic.get(id) ?? 0 };
    });
    return { id: c.id, name: c.name, topics, safe: topics.filter((x) => isSafe(x.state)).length, due: topics.reduce((s, x) => s + x.due, 0) };
  });
  const first = list.findIndex((c) => c.safe < c.topics.length);
  return { chapters: list, current: first < 0 ? Math.max(0, list.length - 1) : first };
}
