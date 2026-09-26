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

export type DiffPart = { text: string; ok: boolean };

const normWord = (w: string) => w.toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:]+$/, '');

/**
 * Deine Antwort, markiert gegen die Lösung: bei einem Wort Buchstabe für Buchstabe, bei
 * mehreren Wörtern Wort für Wort (längste gemeinsame Folge). Aufeinanderfolgende gleiche
 * Zustände werden zusammengefasst.
 */
export function answerDiff(givenRaw: string, expectedRaw: string): DiffPart[] {
  const given = givenRaw.trim().replace(/\s+/g, ' ');
  const expected = expectedRaw.trim().replace(/\s+/g, ' ');
  if (!given) return [];
  const parts: DiffPart[] = [];
  const push = (text: string, ok: boolean) => {
    const last = parts[parts.length - 1];
    if (last && last.ok === ok) last.text += text;
    else parts.push({ text, ok });
  };
  if (!given.includes(' ') && !expected.includes(' ')) {
    const marks = markDiff(given.toLowerCase(), expected.toLowerCase());
    Array.from(given).forEach((ch, i) => push(ch, !marks[i]));
    return parts;
  }
  const g = given.split(' ');
  const e = expected.split(' ');
  const n = g.length;
  const m = e.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = L[i] as number[];
      row[j] = normWord(g[i] ?? '') === normWord(e[j] ?? '') ? ((L[i + 1] as number[])[j + 1] ?? 0) + 1 : Math.max((L[i + 1] as number[])[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const ok = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (normWord(g[i] ?? '') === normWord(e[j] ?? '')) {
      ok[i] = true;
      i++;
      j++;
    } else if (((L[i + 1] as number[])[j] ?? 0) >= ((L[i] as number[])[j + 1] ?? 0)) i++;
    else j++;
  }
  g.forEach((w, k) => {
    if (k > 0) push(' ', ok[k - 1] === true && ok[k] === true);
    push(w, ok[k] === true);
  });
  return parts;
}

export type CharPart = { text: string; kind: 'ok' | 'off' | 'missing' };

/**
 * Buchstabenvergleich für „fast richtig" (Kap. 4: gold markiert): abweichende oder überzählige
 * Zeichen der Eingabe `off`, fehlende Zeichen der Lösung als eingefügtes `missing`
 * („strugle" → strug·g·le). Vertauschungen erscheinen als zwei abweichende Zeichen.
 */
export function charDiff(givenRaw: string, expectedRaw: string): CharPart[] {
  const given = Array.from(givenRaw.trim());
  const expected = Array.from(expectedRaw.trim());
  const a = given.map((c) => c.toLowerCase());
  const b = expected.map((c) => c.toLowerCase());
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      (d[i] as number[])[j] = Math.min(((d[i - 1] as number[])[j] ?? 0) + 1, ((d[i] as number[])[j - 1] ?? 0) + 1, ((d[i - 1] as number[])[j - 1] ?? 0) + cost);
    }
  }
  const rev: CharPart[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cur = (d[i] as number[])[j] ?? 0;
    if (i > 0 && j > 0 && cur === ((d[i - 1] as number[])[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      rev.push({ text: given[i - 1] ?? '', kind: a[i - 1] === b[j - 1] ? 'ok' : 'off' });
      i--;
      j--;
    } else if (i > 0 && cur === ((d[i - 1] as number[])[j] ?? 0) + 1) {
      rev.push({ text: given[i - 1] ?? '', kind: 'off' });
      i--;
    } else {
      rev.push({ text: expected[j - 1] ?? '', kind: 'missing' });
      j--;
    }
  }
  const out: CharPart[] = [];
  for (const p of rev.reverse()) {
    const last = out[out.length - 1];
    if (last && last.kind === p.kind) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}
