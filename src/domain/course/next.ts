import { LESSONS } from '../content';
import type { Lang } from '../srs/types';
import { isLessonDone } from './courseDone';

// Nächste Lektion (phase2-plan D18): die nächste offene in Kursreihenfolge. Nennt die
// KI-Einschätzung (`app/assess`, Sprache passt) als Fokus `grammar:<topic>`, wird die nächste
// offene Lektion mit diesem Thema in der aktuellen oder nächsten Einheit vorgezogen (`whyFocus`).
// Deterministisch; das Ergebnis wird im Tagesplan eingefroren (`plan.lesson`).

type Doc = Record<string, unknown>;

export type LessonPick = { lid: string; why: 'whyFocus' | null };

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

/** Fokus-Thema aus `app/assess` (Hülle `{lang, data:{focus}}` oder flach), nur bei passender Sprache. */
export function assessFocusTopic(assess: Readonly<Doc> | null | undefined, lang: Lang): string | null {
  if (!assess) return null;
  const aLang = typeof assess.lang === 'string' ? assess.lang : null;
  if (aLang && aLang !== lang) return null;
  const data = obj(assess.data);
  const focus = obj(Object.keys(data).length ? data.focus : assess.focus);
  const action = typeof focus.action === 'string' ? focus.action : '';
  const m = /^grammar:([a-z0-9-]+)$/.exec(action.trim());
  return m ? (m[1] ?? null) : null;
}

export function pickLesson(i: { course: Readonly<Doc> | null | undefined; assess?: Readonly<Doc> | null; lang: Lang }): LessonPick | null {
  const open = LESSONS.filter((l) => !isLessonDone(i.course, l.id));
  const first = open[0];
  if (!first) return null;
  const topic = assessFocusTopic(i.assess, i.lang);
  if (topic && first.grammar === topic) return { lid: first.id, why: 'whyFocus' };
  if (topic) {
    const unitIdx = (u: string) => Number(u.replace(/\D/g, '')) || 0;
    const cur = unitIdx(first.unit);
    const hit = open.find((l) => l.grammar === topic && unitIdx(l.unit) <= cur + 1);
    if (hit) return { lid: hit.id, why: 'whyFocus' };
  }
  return { lid: first.id, why: null };
}
