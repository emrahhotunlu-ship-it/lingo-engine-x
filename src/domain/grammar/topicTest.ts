// Themen-Test (Kapitel-Arbeit K4, `docs/umbau/kapitel-plan.md`): 6 Aufgaben über alle Muster eines Themas, bestanden ab 5 richtig.
// Gibt es weniger als 4 passende Aufgaben, ist der Test „in Vorbereitung“ (kein Test, nichts gesperrt). Mit 4 oder 5 Aufgaben gilt
// dieselbe Strenge: höchstens eine falsch. Nicht bestanden heißt: schwache Stellen üben, morgen noch einmal; weiter geht es immer.

/** `grammar/<thema>.tt`: der letzte Themen-Test. */
export type TopicTest = {
  /** Lerntag des letzten Versuchs. */
  d: string;
  /** Richtige im letzten Versuch. */
  c: number;
  /** Gestellte Aufgaben im letzten Versuch. */
  n: number;
  /** Je bestanden (bleibt `true`, wenn ein späterer Versuch scheitert). */
  ok: boolean;
  /** Zahl der Versuche. */
  k: number;
  /** Lerntag von „Nächstes Thema trotzdem beginnen“ (nur nach einem nicht bestandenen Test). */
  s?: string;
  /** Muster, die im letzten Versuch falsch oder nur mit Hilfe gelöst waren (eindeutig, ≤ 12): danach wird genau das geübt. Fehlt in alten Daten. */
  w?: string[];
};

type Doc = Readonly<Record<string, unknown>>;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** `grammar/<thema>.tt` tolerant lesen; `null`, wenn es fehlt oder unlesbar ist. */
export function readTt(doc: Doc | undefined): TopicTest | null {
  const v = doc?.tt;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.d !== 'string' || !DAY_RE.test(o.d)) return null;
  const out: TopicTest = { d: o.d, c: Math.max(0, Math.floor(num(o.c))), n: Math.max(0, Math.floor(num(o.n))), ok: o.ok === true, k: Math.max(0, Math.floor(num(o.k))) };
  if (typeof o.s === 'string' && DAY_RE.test(o.s)) out.s = o.s;
  const w = ttWeak(o.w);
  if (w.length) out.w = w;
  return out;
}

/** Aufgaben im Themen-Test. */
export const TT_N = 6;
/** Bestanden ab so vielen richtigen (bei 6 Aufgaben). */
export const TT_PASS = 5;
/** Weniger passende Aufgaben: der Test ist „in Vorbereitung“. */
export const TT_MIN = 4;

/** Bestanden? Bei `n` Aufgaben höchstens eine falsch (6 → 5, 5 → 4, 4 → 3). */
export const ttPassed = (c: number, n: number): boolean => n >= TT_MIN && c >= n - (TT_N - TT_PASS);

/** Höchstzahl der gemerkten schwachen Muster (`tt.w`). */
export const TT_W_MAX = 12;

/** Schwache Muster tolerant lesen: nur nichtleere Zeichenketten, eindeutig, höchstens `TT_W_MAX`. */
export function ttWeak(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) if (typeof x === 'string' && x && x.length <= 80 && !out.includes(x) && out.length < TT_W_MAX) out.push(x);
  return out;
}

/**
 * Neuer Stand von `grammar/<thema>.tt` nach einem Versuch: `ok` bleibt, wenn es einmal bestanden war; `k` zählt die Versuche; `w` = die schwachen
 * Muster dieses Versuchs (nur, wenn es welche gibt).
 */
export function nextTt(prev: TopicTest | null, r: { day: string; c: number; n: number; w?: readonly string[] }): TopicTest {
  const ok = ttPassed(r.c, r.n);
  const out: TopicTest = { d: r.day, c: r.c, n: r.n, ok: (prev?.ok ?? false) || ok, k: (prev?.k ?? 0) + 1 };
  const w = ttWeak(r.w);
  if (w.length) out.w = w;
  return out;
}
