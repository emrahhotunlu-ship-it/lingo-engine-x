import type { WordOp } from '../learn/types';

// Wort-für-Wort-Vergleich „Deine Antwort / Richtig" (phase2-plan §5.0, §5.4): Levenshtein auf
// Wortebene mit Rückverfolgung. Ergebnis in der Reihenfolge des Satzes:
// - eq:   gleich (nach Vereinheitlichung),
// - typo: Tippfehler (entscheidet `opt.typo`, z. B. Zeichen-Levenshtein im Budget),
// - sub:  anderes Wort an dieser Stelle,
// - ins:  Wort zu viel in der Antwort,
// - del:  Wort der Lösung fehlt in der Antwort.

const COST = { eq: 0, typo: 0.5, sub: 1, ins: 1, del: 1 } as const;

/** Wort zum Vergleichen: Kleinschreibung, typografische Apostrophe, Satzzeichen am Rand weg. */
export function alignKey(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/^[("“„'«]+|[)"”'».,!?;:…]+$/g, '');
}

export function splitWords(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

export function alignWords(given: string, expected: string, opt?: { typo?: (a: string, b: string) => boolean }): WordOp[] {
  const g = splitWords(given);
  const e = splitWords(expected);
  const gk = g.map(alignKey);
  const ek = e.map(alignKey);
  const n = g.length;
  const m = e.length;
  const pair = (i: number, j: number): 'eq' | 'typo' | 'sub' => {
    const a = gk[i] ?? '';
    const b = ek[j] ?? '';
    if (a === b) return 'eq';
    return opt?.typo?.(a, b) ? 'typo' : 'sub';
  };
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const at = (i: number, j: number) => (d[i] as number[])[j] ?? 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      (d[i] as number[])[j] = Math.min(at(i - 1, j - 1) + COST[pair(i - 1, j - 1)], at(i - 1, j) + COST.ins, at(i, j - 1) + COST.del);
    }
  }
  const out: WordOp[] = [];
  let i = n;
  let j = m;
  const eps = 1e-9;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const kind = pair(i - 1, j - 1);
      if (Math.abs(at(i, j) - (at(i - 1, j - 1) + COST[kind])) < eps && kind !== 'sub') {
        out.push({ op: kind, given: g[i - 1], expected: e[j - 1] });
        i--;
        j--;
        continue;
      }
    }
    if (j > 0 && Math.abs(at(i, j) - (at(i, j - 1) + COST.del)) < eps) {
      out.push({ op: 'del', expected: e[j - 1] });
      j--;
      continue;
    }
    if (i > 0 && Math.abs(at(i, j) - (at(i - 1, j) + COST.ins)) < eps) {
      out.push({ op: 'ins', given: g[i - 1] });
      i--;
      continue;
    }
    // Übrig bleibt die Ersetzung.
    out.push({ op: 'sub', given: g[i - 1], expected: e[j - 1] });
    i--;
    j--;
  }
  return out.reverse();
}

/** Zählt die Arten von Abweichungen (für Wertungen). */
export function countOps(ops: readonly WordOp[]): Record<WordOp['op'], number> {
  const c = { eq: 0, typo: 0, sub: 0, ins: 0, del: 0 };
  for (const o of ops) c[o.op]++;
  return c;
}
