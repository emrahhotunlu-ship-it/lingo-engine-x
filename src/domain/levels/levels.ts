// Lernpfad-Stufen für Produktionsaufgaben (docs/lernpfad-plan.md, Emrah 03.10.2026: „kein Pfad, wie so etwas gemacht werden
// muss“). Jede Aufgabenart hat eine Stufe 1–5: 1 Vorbild · 2 gelenkt · 3 Satzanfänge · 4 frei · 5 unter Zeitdruck.
// Die Stufe folgt dem Erfolg: Aufstieg nach mindestens 6 Versuchen mit Mittel ≥ 0,85 (höchstens eine Stufe je Lerntag),
// Abstieg bei Mittel der letzten 5 < 0,6 oder drei Fehlschlägen in Folge. Rein, ohne Seiteneffekte; gespeichert wird in
// `app/levels` (ein zusammengefasstes Dokument, A6.6).

export type LevelKind = 'nb-objection';
export type Level = 1 | 2 | 3 | 4 | 5;
export type LevelEntry = { l: Level; w: number[]; n: number; ch: string };

/** Startstufen (Lernwissenschaft 03.10.2026): Einwände beginnen gelenkt. */
export const START_LEVEL: Readonly<Record<LevelKind, Level>> = { 'nb-objection': 2 };

export const WINDOW = 8;
export const UP_MIN_TRIES = 6;
export const UP_MEAN = 0.85;
export const DOWN_MEAN = 0.6;

const clampLevel = (v: number): Level => Math.min(5, Math.max(1, Math.round(v))) as Level;
const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Wert eines Versuchs: richtig ohne Hilfe 1 · Hilfe 1 0,6 · Hilfe 2 0,3 · falsch 0. Teilerfolge (0..1) werden ebenso gedeckelt. */
export function attemptScore(part: number, hint: 0 | 1 | 2 = 0): number {
  const p = Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : 0;
  const cap = hint >= 2 ? 0.3 : hint === 1 ? 0.6 : 1;
  return Math.round(Math.min(p, cap) * 100) / 100;
}

/** Gespeicherter Eintrag, tolerant gelesen; fehlt er, die Startstufe. */
export function readEntry(doc: Readonly<Record<string, unknown>> | null | undefined, kind: LevelKind): LevelEntry {
  const k = doc && typeof doc.k === 'object' && doc.k ? (doc.k as Record<string, unknown>)[kind] : undefined;
  const e = k && typeof k === 'object' ? (k as Record<string, unknown>) : {};
  const l = typeof e.l === 'number' && Number.isFinite(e.l) ? clampLevel(e.l) : START_LEVEL[kind];
  const w = Array.isArray(e.w) ? e.w.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).map((x) => Math.min(1, Math.max(0, x))).slice(-WINDOW) : [];
  const n = typeof e.n === 'number' && Number.isFinite(e.n) ? Math.max(0, Math.floor(e.n)) : 0;
  const ch = typeof e.ch === 'string' ? e.ch : '';
  return { l, w, n, ch };
}

/** Ein Versuch mehr: Fenster fortschreiben, dann Auf- oder Abstieg prüfen. */
export function applyAttempt(e: LevelEntry, score: number, day: string): LevelEntry {
  const w = [...e.w, Math.min(1, Math.max(0, score))].slice(-WINDOW);
  const n = e.n + 1;
  const last5 = w.slice(-5);
  const failsInRow = (() => {
    let c = 0;
    for (let i = w.length - 1; i >= 0 && (w[i] ?? 0) < 0.3; i--) c++;
    return c;
  })();
  const sinceChange = w.slice(-Math.min(n, WINDOW));
  const up = e.l < 5 && n >= UP_MIN_TRIES && mean(sinceChange) >= UP_MEAN && w.slice(-2).every((x) => x >= 0.6) && e.ch !== day;
  if (up) return { l: clampLevel(e.l + 1), w: [], n: 0, ch: day };
  const down = e.l > 1 && ((last5.length >= 5 && mean(last5) < DOWN_MEAN) || failsInRow >= 3);
  if (down) return { l: clampLevel(e.l - 1), w: [], n: 0, ch: day };
  return { ...e, w, n };
}

/** Stufe für den nächsten Eintrag einer Runde: nach zwei Fehlschlägen in Folge eine Stufe leichter (nur in dieser Runde). */
export function roundLevel(base: Level, recent: readonly number[]): Level {
  const two = recent.slice(-2);
  return two.length === 2 && two.every((x) => x < 0.5) ? clampLevel(base - 1) : base;
}

/** Patch für `app/levels`: nur den einen Eintrag ersetzen, alles andere bleibt. */
export function levelsPatch(cur: Readonly<Record<string, unknown>> | undefined, kind: LevelKind, scores: readonly number[], day: string): Record<string, unknown> {
  let e = readEntry(cur, kind);
  for (const s of scores) e = applyAttempt(e, s, day);
  const k = cur && typeof cur.k === 'object' && cur.k ? { ...(cur.k as Record<string, unknown>) } : {};
  return { v: 1, k: { ...k, [kind]: e } };
}
