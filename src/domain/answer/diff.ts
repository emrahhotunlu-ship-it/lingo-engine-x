// Damerau-Levenshtein (mit Vertauschung) und Markierung abweichender Zeichen.

export function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      let v = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ((d[i - 2] as number[])[j - 2] ?? 0) + 1);
      row[j] = v;
    }
  }
  return (d[n] as number[])[m] ?? 0;
}

/** Je Zeichen von `given`: weicht es von `expected` ab? (Levenshtein-Rückverfolgung) */
export function markDiff(given: string, expected: string): boolean[] {
  const n = given.length;
  const m = expected.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = given[i - 1] === expected[j - 1] ? 0 : 1;
      (d[i] as number[])[j] = Math.min(((d[i - 1] as number[])[j] ?? 0) + 1, ((d[i] as number[])[j - 1] ?? 0) + 1, ((d[i - 1] as number[])[j - 1] ?? 0) + cost);
    }
  }
  const marks = new Array<boolean>(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cur = (d[i] as number[])[j] ?? 0;
    if (i > 0 && j > 0 && cur === ((d[i - 1] as number[])[j - 1] ?? 0) + (given[i - 1] === expected[j - 1] ? 0 : 1)) {
      if (given[i - 1] !== expected[j - 1]) marks[i - 1] = true;
      i--;
      j--;
    } else if (i > 0 && cur === ((d[i - 1] as number[])[j] ?? 0) + 1) {
      marks[i - 1] = true;
      i--;
    } else {
      j--;
    }
  }
  return marks;
}
