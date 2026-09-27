import { hash32, mulberry32 } from '../random';
import { inBand, levelIndex, parseCefr } from './level';
import type { Cefr, Domain, WritingPrompt } from './types';

// Deterministische Auswahl je Lerntag (Plan F1/F2, Kap. 15 „würfelt sich nicht neu"):
// (1) ungenutzter gespeicherter Inhalt im Band → (2) ungenutzter Startbestand im Band →
// (3) Rückfall: ungenutzter Inhalt mit dem kleinsten Abstand zum Ziel → `null` (dann erzeugt
// Claude auf Klick). Innerhalb einer Stufe wird die passende Domäne bevorzugt. Gleiche Daten
// ergeben auf jedem Gerät dieselbe Wahl.

type Pickable = { id: string; level: Cefr; domain: Domain };

export type PickInput<T extends Pickable> = {
  day: string;
  kind: string;
  db: readonly T[];
  legacy: readonly T[];
  /** Kennungen bereits genutzter Inhalte (vor heute). */
  done: ReadonlySet<string>;
  target: Cefr;
  domain: Domain;
  /** Zusatz für eine zweite Wahl am selben Tag (z. B. „#2"). */
  salt?: string;
};

function choose<T extends Pickable>(items: readonly T[], domain: Domain, rng: () => number): T | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const preferred = sorted.filter((x) => x.domain === domain);
  const list = preferred.length ? preferred : sorted;
  return list[Math.floor(rng() * list.length)] ?? null;
}

export function pickItem<T extends Pickable>(i: PickInput<T>): T | null {
  const rng = mulberry32(hash32(`${i.day}|${i.kind}${i.salt ?? ''}`));
  const fresh = (pool: readonly T[]) => pool.filter((x) => !i.done.has(x.id));
  for (const pool of [i.db, i.legacy]) {
    const hit = choose(
      fresh(pool).filter((x) => inBand(x.level, i.target)),
      i.domain,
      rng,
    );
    if (hit) return hit;
  }
  // Rückfall: kleinster Abstand zum Ziel, gespeicherte Inhalte zuerst.
  const t = levelIndex(i.target);
  for (const pool of [i.db, i.legacy]) {
    const open = fresh(pool);
    if (!open.length) continue;
    const dist = (x: T) => Math.abs(levelIndex(parseCefr(x.level) ?? i.target) - t);
    const min = Math.min(...open.map(dist));
    const hit = choose(
      open.filter((x) => dist(x) === min),
      i.domain,
      rng,
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Schreibaufgabe des Tages aus dem Startbestand: ungenutzte im Band → ungenutzte beliebig →
 * notfalls die am längsten nicht mehr genutzte (Schreiben ist immer ausführbar, Plan §4.6).
 */
export function pickPrompt(i: { day: string; prompts: readonly WritingPrompt[]; usedAt: ReadonlyMap<string, number>; target: Cefr; domain: Domain }): WritingPrompt | null {
  const hit = pickItem({ day: i.day, kind: 'write', db: [], legacy: i.prompts, done: new Set(i.usedAt.keys()), target: i.target, domain: i.domain });
  if (hit) return hit;
  const sorted = [...i.prompts].sort((a, b) => (i.usedAt.get(a.id) ?? 0) - (i.usedAt.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1));
  return sorted[0] ?? null;
}
