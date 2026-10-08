// Zuordnung der Wörter zwischen zwei Schritten eines Struktur-Films (P61), rein und testbar.
// 1. `move` aus den Daten gilt zuerst (auch bei neuer Form: hire → hired).
// 2. Dann die längste gemeinsame Teilfolge gleicher Wörter (Groß-/Kleinschreibung und Satzzeichen egal): sie bleiben in Reihenfolge stehen.
// 3. Übrige gleiche Wörter werden der Reihe nach verbunden: das sind die Wörter, die wandern (Never → vorn).
// Was danach übrig ist, kommt neu hinzu bzw. geht.

export const norm = (w: string): string => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

/** Für jedes Wort im neuen Schritt: Index im vorigen Schritt oder `null` (neu). */
export function planMorph(prev: readonly string[], next: readonly string[], move: readonly (readonly [number, number])[] = []): (number | null)[] {
  const from: (number | null)[] = next.map(() => null);
  const usedPrev = new Set<number>();
  for (const [a, b] of move) {
    if (a < 0 || a >= prev.length || b < 0 || b >= next.length || usedPrev.has(a) || from[b] !== null) continue;
    from[b] = a;
    usedPrev.add(a);
  }
  const pi = prev.map((_, i) => i).filter((i) => !usedPrev.has(i));
  const ni = next.map((_, i) => i).filter((i) => from[i] === null);
  const pw = pi.map((i) => norm(prev[i] ?? ''));
  const nw = ni.map((i) => norm(next[i] ?? ''));
  // Längste gemeinsame Teilfolge (klein: Sätze haben < 30 Wörter). Bei Gleichstand bevorzugt sie spätere Paare, damit „the system“ zusammenbleibt.
  const L: number[][] = Array.from({ length: pw.length + 1 }, () => new Array<number>(nw.length + 1).fill(0));
  for (let i = pw.length - 1; i >= 0; i--) {
    for (let j = nw.length - 1; j >= 0; j--) {
      L[i]![j] = pw[i] === nw[j] && pw[i] !== '' ? (L[i + 1]![j + 1] ?? 0) + 1 : Math.max(L[i + 1]![j] ?? 0, L[i]![j + 1] ?? 0);
    }
  }
  let i = 0;
  let j = 0;
  while (i < pw.length && j < nw.length) {
    if (pw[i] === nw[j] && pw[i] !== '' && L[i]![j] === (L[i + 1]![j + 1] ?? 0) + 1 && (L[i + 1]![j] ?? 0) < (L[i]![j] ?? 0)) {
      from[ni[j]!] = pi[i]!;
      usedPrev.add(pi[i]!);
      i++;
      j++;
    } else if ((L[i + 1]![j] ?? 0) >= (L[i]![j + 1] ?? 0)) i++;
    else j++;
  }
  // Übrige gleiche Wörter: wandern.
  for (let b = 0; b < next.length; b++) {
    if (from[b] !== null) continue;
    const w = norm(next[b] ?? '');
    if (!w) continue;
    const a = prev.findIndex((p, k) => !usedPrev.has(k) && norm(p) === w);
    if (a >= 0) {
      from[b] = a;
      usedPrev.add(a);
    }
  }
  return from;
}

export type MorphWord = { id: string; text: string; hi: boolean };

/**
 * Wörter aller Schritte mit stabiler Kennung: ein Wort, das von Schritt zu Schritt weiterlebt, behält seine `id` (darauf beruht die Bewegung).
 * `steps[i]` = Wörter von Schritt i.
 */
export function morphSteps(steps: readonly { en: string; hi?: readonly number[] | undefined; move?: readonly (readonly [number, number])[] | undefined }[]): MorphWord[][] {
  let seq = 0;
  const out: MorphWord[][] = [];
  steps.forEach((s, k) => {
    const ws = s.en.trim().split(/\s+/).filter(Boolean);
    const hi = new Set(s.hi ?? []);
    const prev = out[k - 1];
    const map = prev ? planMorph(prev.map((w) => w.text), ws, s.move ?? []) : ws.map(() => null);
    // Übernommene Wörter behalten ihre Kennung, neue bekommen eine fortlaufende.
    out.push(ws.map((text, i) => ({ id: map[i] !== null && prev ? (prev[map[i] as number] as MorphWord).id : `w${seq++}`, text, hi: hi.has(i) })));
  });
  return out;
}

/** Wörter ohne Hervorhebung: vor der Vorhersage dürfen Signalwörter die Lösung nicht verraten (P61/P62). */
export const withoutHi = (ws: readonly MorphWord[]): MorphWord[] => ws.map((w) => (w.hi ? { ...w, hi: false } : w));
