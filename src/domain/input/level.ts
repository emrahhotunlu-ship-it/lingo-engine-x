import type { Cefr } from './types';

// Zielniveau i+1 (Plan F3): gelesen aus `app/assess` (Hülle `data.cefr`/`data.level` oder flach,
// A6.10), eine Stufe höher auf der Skala B1 … C1+, gedeckelt bei C1+. Ohne Einschätzung: B2+.

export const CEFR_SCALE: readonly Cefr[] = ['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'];
export const DEFAULT_TARGET: Cefr = 'B2+';

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

const TOKEN = /\b([ABC])\s?([12])(\s?\+)?(?![\w])/i;

/** Niveau aus einem Text („B2", „b2+", „Solides B2 mit …"); A-Stufen → B1, C2 → C1+. `null` ohne Treffer. */
export function parseCefr(v: unknown): Cefr | null {
  if (typeof v !== 'string') return null;
  const m = TOKEN.exec(v);
  if (!m) return null;
  const letter = (m[1] ?? '').toUpperCase();
  const digit = m[2] ?? '';
  const plus = !!m[3];
  if (letter === 'A') return 'B1';
  if (letter === 'C' && digit === '2') return 'C1+';
  const base = `${letter}${digit}` as 'B1' | 'B2' | 'C1';
  const out: Cefr = plus ? `${base}+` : base;
  return out;
}

export function levelIndex(level: Cefr): number {
  return CEFR_SCALE.indexOf(level);
}

/** Aktuelles Niveau laut Einschätzung (Hülle vor flach, `cefr` vor `level`) oder `null`. */
export function assessLevel(assess: unknown): Cefr | null {
  const a = obj(assess);
  const data = obj(a.data);
  return parseCefr(data.cefr) ?? parseCefr(a.cefr) ?? parseCefr(data.level) ?? parseCefr(a.level);
}

/** Zielniveau: eine Stufe über der Einschätzung, höchstens C1+; ohne Einschätzung B2+. */
export function targetLevel(assess: unknown): Cefr {
  const cur = assessLevel(assess);
  if (!cur) return DEFAULT_TARGET;
  const i = Math.min(CEFR_SCALE.length - 1, levelIndex(cur) + 1);
  return CEFR_SCALE[i] ?? DEFAULT_TARGET;
}

/** Liegt `level` im Band Ziel ± 1 Stufe? Unbekanntes Niveau liegt nie im Band. */
export function inBand(level: unknown, target: Cefr): boolean {
  const l = typeof level === 'string' ? parseCefr(level) : null;
  if (!l) return false;
  return Math.abs(levelIndex(l) - levelIndex(target)) <= 1;
}

/** Niveau eines Inhalts, notfalls das Ziel selbst (für die Anzeige „etwa B2+"). */
export function levelOr(level: unknown, fallback: Cefr): Cefr {
  return parseCefr(level) ?? fallback;
}
