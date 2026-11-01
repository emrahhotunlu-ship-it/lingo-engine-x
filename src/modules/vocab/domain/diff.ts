// Wörter-Modul V3: Buchstaben-Vergleich für die Lösungszeile bei „Fast richtig“ (Bild s1-09): fehlt = gelb unterstrichen, zu viel = rot
// durchgestrichen. Längste gemeinsame Teilfolge, rein. Groß/klein zählt nicht als Unterschied.

export type DiffPart = { k: 'eq' | 'ins' | 'del'; s: string };

/** Höchstens so viele Zeichen je Seite (darüber kein Vergleich, nur „Du: x → Richtig: y“). */
export const DIFF_MAX = 80;

/**
 * Vergleich Eingabe → Lösung. `eq` gleich, `ins` fehlt in der Eingabe (aus der Lösung), `del` zu viel getippt (aus der Eingabe).
 * Benachbarte Teile gleicher Art werden zusammengefasst. `null`, wenn eine Seite zu lang ist.
 */
export function letterDiff(given: string, answer: string): DiffPart[] | null {
  const a = given.trim();
  const b = answer.trim();
  if (a.length > DIFF_MAX || b.length > DIFF_MAX) return null;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const m = a.length;
  const n = b.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i]![j] = al[i] === bl[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: DiffPart[] = [];
  const push = (k: DiffPart['k'], s: string) => {
    const last = out.at(-1);
    if (last && last.k === k) last.s += s;
    else out.push({ k, s });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (al[i] === bl[j]) {
      push('eq', b[j]!);
      i++;
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) push('del', a[i++]!);
    else push('ins', b[j++]!);
  }
  while (i < m) push('del', a[i++]!);
  while (j < n) push('ins', b[j++]!);
  return out;
}
