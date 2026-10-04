import { TRAPS, type Trap } from '../../content/nb/traps';

// Deutsch-Fallen im eigenen Text finden (Plan N43, Prüfung M4b): lokal, ohne KI, über `Trap.detect`.

export type TrapHit = { id: string; at: number; match: string };
type Detectable = Pick<Trap, 'id' | 'detect'>;

const cache = new Map<string, RegExp[]>();

function patterns(t: Detectable): RegExp[] {
  const key = `${t.id}\u0000${t.detect.join('\u0001')}`;
  let res = cache.get(key);
  if (!res) {
    res = t.detect.map((src) => new RegExp(src, 'giu'));
    cache.set(key, res);
  }
  return res;
}

const clean = (s: string): string => s.normalize('NFKC').replace(/[’‘`´]/g, "'");

/** Alle Treffer, nach Stelle im Text sortiert (je Falle und Stelle höchstens einer). */
export function matchTraps(text: string, list: readonly Detectable[] = TRAPS): TrapHit[] {
  const s = clean(text);
  if (!s.trim()) return [];
  const out: TrapHit[] = [];
  for (const t of list) {
    const seen = new Set<number>();
    for (const re of patterns(t)) {
      re.lastIndex = 0;
      for (const m of s.matchAll(re)) {
        const at = m.index;
        if (seen.has(at)) continue;
        seen.add(at);
        out.push({ id: t.id, at, match: m[0].trim() });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** Die erste Falle im Text (oder null) – z. B. für `Fix.trapId`. */
export function matchTrap(text: string, list: readonly Detectable[] = TRAPS): TrapHit | null {
  return matchTraps(text, list)[0] ?? null;
}
