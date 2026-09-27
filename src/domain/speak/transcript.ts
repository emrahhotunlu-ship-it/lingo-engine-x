import { cut, LINE_MAX, LINES_MAX } from './talkDoc';
import type { AnalysisSlot, Lang, SceneView, TalkLine, TalkRun, Turn } from './types';
import { reportStats } from './reportStats';

// Gesprächsverlauf → gespeicherter Lauf (Plan §3.4). Rein und testbar.

/** Indizes der eigenen Züge in der Zugliste. */
export function myTurnIndexes(turns: readonly Turn[]): number[] {
  const out: number[] = [];
  turns.forEach((t, i) => {
    if (t.role === 'me') out.push(i);
  });
  return out;
}

/** Verdichtete Zeilen: eigener Satz, C1-Fassung, Urteil, Fehlerkategorien (höchstens 16). */
export function talkLines(turns: readonly Turn[], analyses: Readonly<Record<number, AnalysisSlot>>): TalkLine[] {
  return myTurnIndexes(turns)
    .slice(-LINES_MAX)
    .map((i) => {
      const a = analyses[i];
      const d = a?.state === 'done' ? a.data : undefined;
      return {
        u: cut((turns[i] as Turn).text, LINE_MAX),
        up: d ? cut(d.upgraded, LINE_MAX) : '',
        v: d ? d.verdict : 'na',
        c: d ? [...new Set(d.errors.map((e) => e.cat))].slice(0, 4) : [],
      };
    });
}

export type RunInput = {
  id: string;
  startedAt: number;
  endedAt: number;
  day: string;
  scene: SceneView;
  turns: readonly Turn[];
  analyses: Readonly<Record<number, AnalysisSlot>>;
  taken: readonly string[];
  lang: Lang;
  tier: string;
};

/** Laufkennung aus dem Beginn (Basis 36) – je Gespräch fest, auch nach „Fortsetzen". */
export const runId = (startedAt: number): string => `r${Math.max(0, Math.floor(startedAt)).toString(36)}`;

export function buildRun(i: RunInput): TalkRun {
  const stats = reportStats(i.turns, i.analyses, i.taken, i.startedAt, i.endedAt);
  return {
    id: i.id,
    t: i.startedAt,
    day: i.day,
    scene: i.scene.id,
    title: cut(i.scene.titleEn, 160),
    src: i.scene.src,
    turns: stats.turns,
    ms: stats.ms,
    end: 'user',
    goal: null,
    clean: stats.clean,
    errs: stats.errs,
    taken: [...new Set(i.taken)].slice(0, 20),
    lines: talkLines(i.turns, i.analyses),
    report: null,
    lang: i.lang,
    tier: i.tier,
    v: 1,
  };
}
