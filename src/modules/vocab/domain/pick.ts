import { damerau } from './check';
import { canonDe, meaningVariants } from './flow';
import { hash32 } from './rand';

// Großpaket WT (Emrah 10.11.2026: „erst lernen, dann abrufen, aus Multiple Choice auswählen, ergänzen, eintippen, frei verwenden“):
// Stufe „Wiedererkennen“ gleich nach der Einführung – die richtige deutsche Bedeutung aus vier wählen. Rein: keine Uhr, kein Zufall ohne Startwert.

export type PickCand = {
  path: string;
  de: string;
  pos: string | null;
  /** Stichwort (für „… heißt …“ bei falscher Wahl). */
  head?: string;
  /** Politur P2: schon eingeführt (Emrah kennt das Wort, die Wahl ist eine echte Entscheidung). */
  intro?: boolean;
  /** Politur P2: Verwechslungspartner (Paar, offene Verwechslung, Lehrer-Paar) – der stärkste Ablenker. */
  near?: boolean;
};
/** `from[i]` = Stichwort, zu dem die Möglichkeit `i` gehört (`null` bei der richtigen). */
export type PickModel = { options: string[]; right: number; from: (string | null)[] };

/** Erste Bedeutung aus `de` (so steht sie auf der Karte), ohne Klammern. */
export const firstMeaning = (de: string): string =>
  de
    .replace(/\([^)]*\)/g, ' ')
    .split(/[;/]/)[0]!
    .replace(/\s+/g, ' ')
    .trim();

/** Wortstücke einer Bedeutung zum Vergleich (≥ 5 Buchstaben, auf 5 gekürzt: „Lieferung“ ~ „Lieferant“). */
const stems = (de: string): Set<string> => new Set(meaningVariants(de).flatMap((v) => v.split(' ')).filter((w) => w.length >= 5).map((w) => w.slice(0, 5)));

/**
 * Ähnlich (Politur P2, Prüfbericht S6): die Bedeutungen teilen ein Wortstück (verwandte Bedeutung, ohne dieselbe zu sein) oder die englischen
 * Stichwörter sehen sich ähnlich (adapt – adopt, affect – effect: höchstens 2 Buchstaben anders oder dieselben ersten 4).
 */
export function looksClose(a: PickCand, b: PickCand): boolean {
  const sa = stems(a.de);
  for (const w of stems(b.de)) if (sa.has(w)) return true;
  const ha = (a.head ?? '').toLowerCase().trim();
  const hb = (b.head ?? '').toLowerCase().trim();
  if (ha.length < 4 || hb.length < 4 || ha === hb) return false;
  return ha.slice(0, 4) === hb.slice(0, 4) || (Math.min(ha.length, hb.length) >= 5 && damerau(ha, hb) <= 2);
}

/**
 * Rang eines Ablenkers (Politur P2): Verwechslungspartner vor gleicher Wortart vor schon eingeführt vor ähnlich. Ein Ablenker aus Wörtern,
 * die Emrah kennt und die ähnlich aussehen oder Ähnliches bedeuten, zwingt zum echten Wiedererkennen; ein beliebiges fremdes Wort nicht.
 */
const rank = (c: PickCand, target: PickCand): number => (c.near ? 8 : 0) + (c.pos === target.pos ? 4 : 0) + (c.intro ? 2 : 0) + (looksClose(c, target) ? 1 : 0);

/**
 * Vier Bedeutungen: die richtige und drei Ablenker aus anderen Lexemen (Rang `rank`, bei Gleichstand nach Startwert gemischt), keine mit
 * gemeinsamer Bedeutungsvariante. `null`, wenn es nicht genug passende gibt (dann entfällt die Auswahl).
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
    .map((x) => ({ ...x, r: rank(x.c, target) }))
    .sort((a, b) => b.r - a.r || hash32(`${seed}|${a.c.path}`) - hash32(`${seed}|${b.c.path}`));
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
