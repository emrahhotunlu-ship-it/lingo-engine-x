import collocJson from '../content/bank/colloc.json';
import falseFriendsJson from '../content/bank/falsefriends.json';
import { hash32, mulberry32, shuffle } from '../domain/random';

// „Bunt gemischt" (docs/neustart.md §5): feste Verbindungen (make/do/take …, Business-Kollokationen)
// und falsche Freunde. Täglich je eine Aufgabe, am längsten nicht gesehene zuerst. Ohne KI.

export type MixItem = {
  key: string;
  type: 'colloc' | 'ff';
  prompt: string;
  options: string[];
  answer: string;
  /** Deutsche Übersetzung des Satzes bzw. Bedeutung der Verbindung. */
  de?: string;
  expl?: string;
  expl_en?: string;
};

type CollocJson = { p: string; a: string; o: string[]; de?: string; biz?: number };
type FalseFriendJson = { de: string; wrong: string; right: string; prompt: string; answer: string; options: string[]; expl: string; expl_en: string };

export const COLLOC: readonly MixItem[] = (collocJson as CollocJson[]).map((c) => ({
  key: `c-${hash32(c.p).toString(36)}`,
  type: 'colloc',
  prompt: c.p,
  options: c.o,
  answer: c.a,
  ...(c.de ? { de: c.de } : {}),
}));

export const FALSE_FRIENDS: readonly MixItem[] = (falseFriendsJson as FalseFriendJson[]).map((f) => ({
  key: `f-${hash32(f.prompt).toString(36)}`,
  type: 'ff',
  prompt: f.prompt,
  options: f.options,
  answer: f.answer,
  de: f.de,
  expl: f.expl,
  expl_en: f.expl_en,
}));

function leastSeen(items: readonly MixItem[], seen: Readonly<Record<string, number>>, seed: number): MixItem | undefined {
  return [...shuffle(items, mulberry32(seed))].sort((a, b) => (seen[a.key] ?? 0) - (seen[b.key] ?? 0))[0];
}

/** Die Mix-Aufgaben des Tages (fest je Tag). */
export function mixForDay(day: string, seen: Readonly<Record<string, number>>): MixItem[] {
  const seed = hash32(`mix-${day}`);
  const out = [leastSeen(COLLOC, seen, seed), leastSeen(FALSE_FRIENDS, seen, seed + 1)].filter((x): x is MixItem => !!x);
  return out.map((m) => ({ ...m, options: shuffle(m.options, mulberry32(seed + 7)) }));
}
