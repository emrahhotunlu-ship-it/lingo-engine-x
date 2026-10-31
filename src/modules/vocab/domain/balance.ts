import { hash32, rng } from './rand';

// Lastausgleich im Korridor nach Anki (M11; Anki `load_balancer.rs`), gerechnet in ERWARTETEN MINUTEN statt in Karten (plan.md §4.2 Nr. 6).
//  - Gewicht je Tag: (1 / (Last + 1))² · (1 / Intervall), nur bis 90 Tage; darüber nur Fuzz (gleich verteilt).
//  - Geschwister (andere Spur, Verwechslungspartner, Kernwort ↔ Kollokation) meiden den Tag (Gewicht · 0,000001) und die Nachbartage
//    (± 1 Tag · 0,2; ± 2 Tage · 0,4), sofern ein anderer Tag im Korridor frei ist.
//  - Ruhetag (A7) als „Easy Day“ mit Faktor „Minimum“ (Anki: 0,0001).
//  - Die Wahl ist gewichteter Zufall mit festem Startwert aus Lexem und Wiederholungszahl: gleiche Eingabe → gleicher Tag.

export const BALANCE_MAX_DAYS = 90;
export const SIBLING_SAME = 0.000001;
export const SIBLING_NEAR: Readonly<Record<number, number>> = { 1: 0.2, 2: 0.4 };
export const REST_DAY_FACTOR = 0.0001;

export type BalanceInput = {
  /** Korridor in Tagen ab heute (1 = morgen). */
  lo: number;
  hi: number;
  /** Erwartete Minuten je Tag ab heute (`load(i)`, i = 1 = morgen). */
  load: (offset: number) => number;
  /** Tages-Offsets, an denen ein Geschwister fällig ist. */
  siblings: ReadonlySet<number>;
  /** Ist der Tag mit Offset `i` ein Ruhetag? */
  rest?: (offset: number) => boolean;
  /** Startwert: Lexem-Pfad und Wiederholungszahl. */
  seed: string;
};

export function dayWeight(i: number, x: BalanceInput): number {
  let w = i <= BALANCE_MAX_DAYS ? (1 / (x.load(i) + 1)) ** 2 * (1 / i) : 1;
  if (x.siblings.has(i)) w *= SIBLING_SAME;
  else {
    for (const [dist, f] of Object.entries(SIBLING_NEAR)) {
      const d = Number(dist);
      if (x.siblings.has(i - d) || x.siblings.has(i + d)) {
        w *= f;
        break;
      }
    }
  }
  if (x.rest?.(i)) w *= REST_DAY_FACTOR;
  return w;
}

/** Gewählter Tag (Offset ab heute) im Korridor. */
export function pickDay(x: BalanceInput): number {
  if (x.hi <= x.lo) return x.lo;
  const days: number[] = [];
  const ws: number[] = [];
  for (let i = x.lo; i <= x.hi; i++) {
    days.push(i);
    ws.push(dayWeight(i, x));
  }
  const sum = ws.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return x.lo;
  let r = rng(hash32(x.seed))() * sum;
  for (let k = 0; k < days.length; k++) {
    r -= ws[k] as number;
    if (r <= 0) return days[k] as number;
  }
  return days[days.length - 1] as number;
}
