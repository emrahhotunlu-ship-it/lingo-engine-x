import { hash32, mulberry32, shuffle } from '../random';
import { ORDER_TOPICS, poolNorm, type PoolEntry } from './orderPool';

// Satzbau zum Tagesthema (Lernplattform 2.0 §3.6, §5.8): Die Sätze der Pflichtrunde gehören zum eingefrorenen
// Grammatikthema des Tages (`u.gt` = { intro, pats, topics }). Fehlen Sätze, gilt der Rückfall in dieser Reihenfolge:
// 1. gleiches Muster (`pat` ∈ `gt.pats`) · 2. gleiches Thema · 3. Thema derselben Kontrastfamilie (`familyOf`) ·
// 4. die C1-Werkzeuge · 5. alles Übrige (nur damit eine Runde nie leer bleibt).
// Rein: kein Zugriff auf Datenbank oder Uhr. Die Statuszeile nennt immer das Thema des Satzes, nicht das Tagesthema.

export type GrammarDayLike = { intro: string | null; pats: readonly string[]; topics: readonly string[] };

/** Stufe, aus der ein Satz gewählt wurde (1 = gleiches Muster … 5 = Rest). */
export type OrderTier = 1 | 2 | 3 | 4 | 5;

export type OrderPick = { entry: PoolEntry; tier: OrderTier };

/** Das Thema des Tages: das Einführungsthema, sonst das erste Rundenthema; `null`, wenn der Plan keines nennt. */
export function dayTopic(gt: GrammarDayLike | null | undefined): string | null {
  if (!gt) return null;
  return gt.intro ?? gt.topics[0] ?? null;
}

/**
 * Wählt `n` verschiedene Sätze zum Tagesthema. Näher am Tagesthema steht vorn; innerhalb einer Stufe sind ungesehene
 * Sätze (`seen`) zuerst, die Reihenfolge mischt `seed`. `family` liefert die Themen der Kontrastfamilie.
 */
export function pickOrderForDay(
  pool: readonly PoolEntry[],
  gt: GrammarDayLike,
  o: { n: number; seed: string; seen?: ReadonlySet<string>; family: (topic: string) => readonly string[] },
): OrderPick[] {
  const main = dayTopic(gt);
  if (!main) return [];
  const rng = mulberry32(hash32(o.seed));
  const seen = o.seen ?? new Set<string>();
  const fam = new Set(o.family(main));
  const c1 = new Set<string>(ORDER_TOPICS);
  const tierOf = (e: PoolEntry): OrderTier =>
    e.pat && gt.pats.includes(e.pat) ? 1 : e.topic === main ? 2 : fam.has(e.topic) ? 3 : c1.has(e.topic) ? 4 : 5;
  const out: OrderPick[] = [];
  const taken = new Set<string>();
  const take = (tiers: readonly OrderTier[], allowSeen: boolean): void => {
    for (const tier of tiers) {
      const cands = shuffle(
        pool.filter((e) => tierOf(e) === tier && !taken.has(poolNorm(e.en)) && (allowSeen || !seen.has(poolNorm(e.en)))),
        rng,
      );
      for (const e of cands) {
        if (out.length >= o.n) return;
        taken.add(poolNorm(e.en));
        out.push({ entry: e, tier });
      }
    }
  };
  // Erst alles, was zum Thema gehört (auch schon Gesehenes), dann erst die entfernteren Stufen.
  take([1, 2, 3], false);
  take([1, 2, 3], true);
  take([4, 5], false);
  take([4, 5], true);
  // Das Tagesthema zuerst (Stufe 1 vor 2 …), unabhängig davon, ob die Sätze neu oder gesehen waren.
  return out.sort((a, b) => a.tier - b.tier);
}
