import { TOPICS } from '../content';
import { readAssess } from '../assessment/envelope';
import { radarSources } from '../assessment/sources';
import type { LessonMeta } from '../learn/types';
import { nextUnitN, type ExtCatalog } from './extension';

// Eingaben der Vorlage course-extend (Kap. 6.2): Einschätzung (Stufe, Fokus, Blocker),
// schwächste Grammatikthemen (Beherrschung `p`, sonst Voreinstellung p0, dazu Häufigkeit im
// Fehlerradar) und die häufigsten Fehlerkategorien. Rein und deterministisch.

type Doc = Record<string, unknown>;

export type ExtendInput = {
  assess: unknown;
  grammar: ReadonlyMap<string, Readonly<Doc>>;
  radar: Readonly<Doc> | null | undefined;
  ext: ExtCatalog;
  lessons: readonly LessonMeta[];
};

export type ExtendFacts = {
  unitN: number;
  level: string | null;
  focus: string | null;
  blockers: string[];
  weakTopics: string[];
  radar: string[];
  topics: Array<{ id: string; name: string }>;
  existing: string[];
};

export function extendFacts(i: ExtendInput): ExtendFacts {
  const a = readAssess(i.assess);
  const events = radarSources(i.radar, 80);
  const byCat = new Map<string, number>();
  for (const e of events) byCat.set(e.c, (byCat.get(e.c) ?? 0) + 1);
  const topicIds = new Set(TOPICS.map((t) => t.id));
  // Schwäche je Thema: niedrige Beherrschung plus 0,05 Abzug je Radar-Ereignis (höchstens 0,3).
  const weak = TOPICS.map((t) => {
    const d = i.grammar.get(t.id);
    const p = typeof d?.p === 'number' && Number.isFinite(d.p) ? d.p : t.p0;
    return { id: t.id, score: p - Math.min(0.3, 0.05 * (byCat.get(t.id) ?? 0)) };
  }).sort((x, y) => x.score - y.score || x.id.localeCompare(y.id));
  const focusTopic = /^grammar:([a-z0-9-]+)$/.exec(a?.data.focus?.action?.trim() ?? '')?.[1] ?? null;
  const weakTopics = [...new Set([...(focusTopic && topicIds.has(focusTopic) ? [focusTopic] : []), ...weak.slice(0, 4).map((w) => w.id)])].slice(0, 4);
  const radar = [...byCat.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, 5)
    .map(([c, n]) => `${c} ×${n}`);
  return {
    unitN: nextUnitN(i.ext),
    level: a?.data.cefr ?? a?.data.level ?? null,
    focus: a?.data.focus ? a.data.focus.title : null,
    blockers: (a?.data.blockers ?? []).slice(0, 3).map((b) => b.title),
    weakTopics,
    radar,
    topics: TOPICS.map((t) => ({ id: t.id, name: t.name_en ?? t.name })),
    existing: i.lessons.map((l) => l.en),
  };
}
