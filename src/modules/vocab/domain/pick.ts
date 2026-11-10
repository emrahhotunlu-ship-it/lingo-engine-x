import { canonDe, meaningVariants } from './flow';
import { hash32 } from './rand';

// Großpaket WT (Emrah 10.11.2026: „erst lernen, dann abrufen, aus Multiple Choice auswählen, ergänzen, eintippen, frei verwenden“):
// Stufe „Wiedererkennen“ gleich nach der Einführung – die richtige deutsche Bedeutung aus vier wählen. Rein: keine Uhr, kein Zufall ohne Startwert.

export type PickCand = { path: string; de: string; pos: string | null; /** Stichwort (für „… heißt …“ bei falscher Wahl). */ head?: string };
/** `from[i]` = Stichwort, zu dem die Möglichkeit `i` gehört (`null` bei der richtigen). */
export type PickModel = { options: string[]; right: number; from: (string | null)[] };

/** Erste Bedeutung aus `de` (so steht sie auf der Karte), ohne Klammern. */
export const firstMeaning = (de: string): string =>
  de
    .replace(/\([^)]*\)/g, ' ')
    .split(/[;/]/)[0]!
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Vier Bedeutungen: die richtige und drei Ablenker aus anderen Lexemen (gleiche Wortart zuerst), keine mit gemeinsamer Bedeutungsvariante.
 * `null`, wenn es nicht genug passende gibt (dann entfällt die Auswahl).
 */
export function pickOptions(target: PickCand, pool: readonly PickCand[], seed: string): PickModel | null {
  const right = firstMeaning(target.de);
  if (!right) return null;
  const own = new Set(meaningVariants(target.de));
  const taken = new Set<string>([canonDe(right)]);
  const ok = pool
    .filter((c) => c.path !== target.path && c.de)
    .map((c) => ({ c, m: firstMeaning(c.de) }))
    .filter(({ c, m }) => m && m.length <= 40 && !meaningVariants(c.de).some((v) => own.has(v)))
    .sort((a, b) => Number(b.c.pos === target.pos) - Number(a.c.pos === target.pos) || hash32(`${seed}|${a.c.path}`) - hash32(`${seed}|${b.c.path}`));
  const dis: { m: string; head: string | null }[] = [];
  for (const { c, m } of ok) {
    if (dis.length >= 3) break;
    const k = canonDe(m);
    if (taken.has(k)) continue;
    taken.add(k);
    dis.push({ m, head: c.head ?? null });
  }
  if (dis.length < 3) return null;
  const at = hash32(`${seed}|at`) % 4;
  const options = dis.map((d) => d.m);
  const from = dis.map((d) => d.head);
  options.splice(at, 0, right);
  from.splice(at, 0, null);
  return { options, right: at, from };
}
