import { addDays, isoWeek } from '../domain/date';
import { GRAMMAR_TOPICS } from './grammar';
import { grammarSolid, pct, stageOf, stubborn, vocabNow } from './derived';
import { viewOf } from './cardView';
import type { CardRec, CheckRec, DayRec, InLog, ProfileDoc } from './types';

// Zahlen für den wöchentlichen Trainer-Brief (docs/neustart.md §6). Alles wird lokal berechnet,
// Claude formuliert daraus nur den kurzen Text. Eine Anfrage je Kalenderwoche, nur auf Knopfdruck.

export const briefWeekOf = (today: string): string => isoWeek(today);

export type BriefFacts = {
  level: string;
  stage: number;
  vocabSize: number;
  /** Letzte 7 Lerntage (ohne heute). */
  days: number;
  coreDays: number;
  minutes: number;
  answers: number;
  correctPct: number;
  newWords: number;
  lastWeekPct: number | null;
  stubbornWords: string[];
  weakGrammar: string[];
  solidTopics: number;
  totalTopics: number;
  inputMinutes: number;
  liked: string[];
  disliked: string[];
  tooHard: number;
  tooEasy: number;
  lastCheck: { month: string; size: number; level: string } | null;
};

function sumDays(days: Readonly<Record<string, DayRec>>, today: string, from: number, to: number) {
  const out = { n: 0, core: 0, min: 0, ans: 0, ok: 0, nw: 0 };
  for (let i = from; i <= to; i++) {
    const d = days[addDays(today, -i)];
    if (!d) continue;
    if (d.ans > 0 || d.min > 0) out.n++;
    if (d.core === 1) out.core++;
    out.min += d.min;
    out.ans += d.ans;
    out.ok += d.ok;
    out.nw += d.nw;
  }
  return out;
}

export function buildBriefFacts(
  profile: ProfileDoc | null,
  cards: ReadonlyMap<string, CardRec>,
  days: Readonly<Record<string, DayRec>>,
  inlog: InLog,
  grammarLive: Readonly<Record<string, { p: number }>> | undefined,
  checks: Readonly<Record<string, CheckRec>>,
  today: string,
): BriefFacts {
  const w = sumDays(days, today, 1, 7);
  const prev = sumDays(days, today, 8, 14);
  const g = grammarSolid(profile, grammarLive);
  const from = addDays(today, -7);
  let inputMinutes = 0;
  let tooHard = 0;
  let tooEasy = 0;
  const liked: Record<string, number> = {};
  const disliked: Record<string, number> = {};
  for (const e of Object.values(inlog.it)) {
    if (e.d <= from) continue;
    inputMinutes += e.m;
    if (e.l === 'hard') tooHard++;
    if (e.l === 'easy') tooEasy++;
    if (e.topic && e.r === 'great') liked[e.topic] = (liked[e.topic] ?? 0) + 1;
    if (e.topic && e.r === 'boring') disliked[e.topic] = (disliked[e.topic] ?? 0) + 1;
  }
  for (const [d, m] of Object.entries(inlog.own)) if (d > from) inputMinutes += m;
  const top = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 2);
  const month = Object.keys(checks).sort().pop();
  const last = month ? checks[month] : undefined;
  const name = (id: string) => GRAMMAR_TOPICS.find((t) => t.id === id)?.name_en ?? id;
  return {
    level: profile?.placement?.level ?? 'B2',
    stage: stageOf(profile?.planStart, today),
    vocabSize: vocabNow(profile, cards),
    days: w.n,
    coreDays: w.core,
    minutes: Math.round(w.min),
    answers: w.ans,
    correctPct: pct(w.ok, w.ans),
    newWords: w.nw,
    lastWeekPct: prev.ans > 0 ? pct(prev.ok, prev.ans) : null,
    stubbornWords: stubborn(cards, 4).map((id) => viewOf(id, cards.get(id))?.word ?? '').filter(Boolean),
    weakGrammar: g.weakest.slice(0, 3).map(name),
    solidTopics: g.solid,
    totalTopics: g.total,
    inputMinutes: Math.round(inputMinutes),
    liked: top(liked),
    disliked: top(disliked),
    tooHard,
    tooEasy,
    lastCheck: month && last ? { month, size: last.size, level: last.level } : null,
  };
}

/** Genug Daten für einen Brief? Sonst gäbe es nichts Echtes zu sagen. */
export const briefHasData = (f: BriefFacts): boolean => f.answers >= 10;
