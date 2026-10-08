import { kindEnabled } from '../../app/flags';
import { itemsFor, trainable } from '../c1x/select';
import { toTask } from '../c1x/runtime';
import type { GrammarTask } from '../learn/types';
import { patternById } from '../grammar/patterns';
import { allSeedTasks } from '../grammar/tasks';
import { hash32 } from '../random';

// Kontrast-Runde (Lernplattform 3.0 P49, KI-Tutor T5): 8 Aufgaben zu zwei verwechselten Mustern A und B gemischt (aus dem Startwert, ausgewogen), nie mehr als zwei gleiche hintereinander.
// Begründung: Abwechselndes Üben hilft bei ähnlichen Kategorien (Brunmair & Richter 2019). Zuerst feste, ungesehene Aufgaben mit Muster-Kennung
// (c1x, dann die Aufgaben des Lehrplans), erst danach auch schon gesehene; Claude erzeugt hier nichts (kein Hintergrundaufruf). Kontext `xtra`, nie Pflicht.
// Gibt es auf einer Seite weniger als `MIN_SIDE` Aufgaben, wird keine Runde angeboten (der Aufrufer sagt das ehrlich).

type Doc = Readonly<Record<string, unknown>>;

export const CONTRAST_SIDE = 4;
export const MIN_SIDE = 3;

const seenOf = (doc: Doc | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);

/** Aufgaben eines Musters: ungesehene zuerst, dann gesehene; je Gruppe stabil gemischt (Startwert). */
function sideTasks(pat: string, docs: ReadonlyMap<string, Doc>, seed: string, bad: ReadonlySet<string> | undefined): GrammarTask[] {
  const topic = patternById(pat)?.topic ?? '';
  const seen = seenOf(docs.get(topic));
  const c1 = itemsFor(pat)
    .filter((it) => kindEnabled(it.kind) && trainable(it, bad))
    .map((it) => toTask(it, { ref: `grammar/${topic}` }) as GrammarTask);
  const fixed = allSeedTasks().filter((t) => t.pat === pat);
  const all: GrammarTask[] = [];
  const keys = new Set<string>();
  for (const t of [...c1, ...fixed]) {
    if (keys.has(t.key)) continue;
    keys.add(t.key);
    all.push(t);
  }
  // Auswahlaufgaben zeigen beide Formen nebeneinander und passen deshalb am besten zum Kontrast: sie kommen innerhalb ihrer Gruppe zuerst.
  const rank = (t: GrammarTask): number => (t.type === 'mc' ? 0 : 1) * 1e10 + hash32(`${seed}|${pat}|${t.key}`);
  const unseen = all.filter((t) => !seen.has(t.key)).sort((x, y) => rank(x) - rank(y));
  const old = all.filter((t) => seen.has(t.key)).sort((x, y) => rank(x) - rank(y));
  return [...unseen, ...old];
}

/** Anzahl der angebotenen Aufgaben je Seite, ohne die Runde zu bauen. */
export function contrastSideCounts(a: string, b: string, docs: ReadonlyMap<string, Doc>, bad?: ReadonlySet<string>): [number, number] {
  return [sideTasks(a, docs, 'count', bad).length, sideTasks(b, docs, 'count', bad).length];
}

/** Reihenfolge der Seiten: `n` × A und `n` × B, aus dem Startwert gemischt, nie mehr als zwei gleiche hintereinander. */
export function mixOrder(n: number, seed: string): Array<'A' | 'B'> {
  const out: Array<'A' | 'B'> = [];
  let a = n;
  let b = n;
  for (let k = 0; k < 2 * n; k++) {
    const last = out.slice(-2);
    const run = (s: 'A' | 'B'): boolean => last.length === 2 && last[0] === s && last[1] === s;
    const canA = a > 0 && !run('A');
    const canB = b > 0 && !run('B');
    if (!canA && !canB) return Array.from({ length: 2 * n }, (_, j) => (j % 2 === 0 ? 'A' : 'B'));
    const pick: 'A' | 'B' = canA && canB ? (a - b >= 2 ? 'A' : b - a >= 2 ? 'B' : ((hash32(`${seed}|mix|${k}`) >>> 9) & 1) === 0 ? 'A' : 'B') : canA ? 'A' : 'B';
    out.push(pick);
    if (pick === 'A') a--;
    else b--;
  }
  return out;
}

/**
 * Die Runde: A und B gemischt, bis zu 8 Aufgaben (je Seite höchstens 4, auf beiden Seiten gleich viele). Weniger als `MIN_SIDE` auf einer Seite → leer.
 * Stabil für denselben Startwert.
 */
export function contrastTasks(pair: { a: string; b: string }, i: { grammarDocs: ReadonlyMap<string, Doc>; seed: string; bad?: ReadonlySet<string> }): GrammarTask[] {
  if (pair.a === pair.b) return [];
  const A = sideTasks(pair.a, i.grammarDocs, i.seed, i.bad);
  const B = sideTasks(pair.b, i.grammarDocs, i.seed, i.bad);
  const n = Math.min(CONTRAST_SIDE, A.length, B.length);
  if (n < MIN_SIDE) return [];
  const out: GrammarTask[] = [];
  let ia = 0;
  let ib = 0;
  for (const side of mixOrder(n, i.seed)) out.push(side === 'A' ? (A[ia++] as GrammarTask) : (B[ib++] as GrammarTask));
  return out;
}
