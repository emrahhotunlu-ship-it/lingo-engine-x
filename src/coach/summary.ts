import { GRAMMAR_TOPICS } from './grammar';
import { grammarSolid, stageOf, vocabNow } from './derived';
import { DEFAULT_INTERESTS, DEFAULT_FORMATS } from './defaults';
import type { CardRec, InLog, ProfileDoc } from './types';

// Zusammenfassung für den schlanken Tagesauftrag (docs/neustart.md §8): EIN kleines Dokument statt
// der ganzen Datenbank. Daraus wählt der Tagesauftrag Themen, Formate und Niveau des Inputs.

/** `weakCats`: die häufigsten Fehlerarten der letzten 30 Tage (englisch, höchstens 3; aus coach/stumble). */
export function buildSummary(profile: ProfileDoc | null, cards: ReadonlyMap<string, CardRec>, inlog: InLog, today: string, weakCats: readonly string[] = []): Record<string, unknown> {
  const entries = Object.values(inlog.it).sort((a, b) => b.d.localeCompare(a.d));
  const liked: Record<string, number> = {};
  const disliked: Record<string, number> = {};
  for (const e of entries.slice(0, 40)) {
    if (!e.topic) continue;
    if (e.r === 'great') liked[e.topic] = (liked[e.topic] ?? 0) + 1;
    if (e.r === 'boring') disliked[e.topic] = (disliked[e.topic] ?? 0) + 1;
  }
  const levelVotes = { easy: 0, right: 0, hard: 0 };
  for (const e of entries.slice(0, 10)) if (e.l) levelVotes[e.l] += 1;
  const sources: Record<string, number> = {};
  for (const e of entries.slice(0, 40)) if (e.s && e.r === 'great') sources[e.s] = (sources[e.s] ?? 0) + 1;
  const g = grammarSolid(profile);
  const name = (id: string) => GRAMMAR_TOPICS.find((t) => t.id === id)?.name_en ?? id;
  return {
    v: 1,
    updated: today,
    level: profile?.placement?.level ?? profile?.imported?.level ?? 'B2',
    vocabSize: vocabNow(profile, cards),
    stage: stageOf(profile?.planStart, today),
    interests: profile?.interests ?? [...DEFAULT_INTERESTS],
    formats: profile?.formats ?? [...DEFAULT_FORMATS],
    liked,
    disliked,
    likedSources: sources,
    levelVotes,
    recent: entries.slice(0, 20).map((e) => e.t),
    weakGrammar: g.weakest.map(name),
    weakCats: weakCats.slice(0, 3),
  };
}
