import { z } from 'zod';
import { clip } from './common';
import { normWs } from '../domain/tutor/edits';

// Gemeinsame Bausteine der Anwenden-Vorlagen (F3, docs/umbau/fokus2/anwenden-plan.md, Nachtrag learning-scientist Muss 1/2/5). Rein.
// - `keepPoints`: Pflicht- bzw. Kernpunkte einzeln: je Punkt `yes`/`partly`/`no` mit Zitat. Ein Zitat, das nicht WÖRTLICH im Text steht, macht den
//   Punkt zu `no` (wie `keepUsed`): die App glaubt nur Belegtes. Fehlende Punkte gelten als `no`. Bei `partly`/`no` dazu `why` (ein kurzer Satz in der
//   Erklärsprache: was fehlt oder unklar ist; Pflichtfrage „Warum“, Prüfbefund T2); bei `yes` leer.
// - `keepGood`: „Das sitzt“ – eine gelungene Stelle mit Grund, nur mit wörtlichem Zitat (sonst `null`, die Oberfläche nimmt dann ein anderes Zitat).

export type Covered = 'yes' | 'partly' | 'no';
export type PointCheck = { i: number; covered: Covered; quote: string; why: string };
export type Good = { quote: string; why: string };

export const POINT_QUOTE_MAX = 200;
export const GOOD_WHY_MAX = 200;
export const POINT_WHY_MAX = 160;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const COVERED_ALIASES: ReadonlyArray<[RegExp, Covered]> = [
  [/^(yes|y|true|covered|full|fully|done|ok)$/, 'yes'],
  [/^(partly|partial|partially|some|half|somewhat)$/, 'partly'],
  [/^(no|n|false|missing|not covered|none|absent)$/, 'no'],
];

/** `covered` tolerant lesen; Unbekanntes zählt vorsichtig als `no`. */
export function coveredOf(v: unknown): Covered {
  if (v === true) return 'yes';
  if (typeof v !== 'string') return 'no';
  const s = v.trim().toLowerCase();
  for (const [re, out] of COVERED_ALIASES) if (re.test(s)) return out;
  return 'no';
}

/**
 * Je Punkt (`n` Stück, Nummern 1 bis n in der Antwort) ein Ergebnis in fester Reihenfolge. `yes`/`partly` nur mit einem Zitat, das wörtlich
 * (Leerraum und typografische Anführungszeichen normalisiert) im Text steht; sonst `no`. Doppelte Nummern: die erste gilt.
 */
export function keepPoints(xs: readonly unknown[], text: string, n: number): PointCheck[] {
  const hay = normWs(text);
  const byI = new Map<number, { covered: Covered; quote: string; why: string }>();
  for (const x of xs) {
    if (!isObj(x)) continue;
    const raw = typeof x.i === 'number' ? x.i : typeof x.i === 'string' ? Number(x.i) : NaN;
    if (!Number.isInteger(raw) || raw < 1 || raw > n || byI.has(raw)) continue;
    const quote = typeof x.quote === 'string' ? normWs(x.quote) : '';
    let covered = coveredOf(x.covered);
    if (covered !== 'no' && (!quote || !hay.includes(quote))) covered = 'no';
    const why = covered !== 'yes' && typeof x.why === 'string' ? clip(x.why.trim(), POINT_WHY_MAX) : '';
    byI.set(raw, { covered, quote: covered === 'no' ? '' : clip(quote, POINT_QUOTE_MAX), why });
  }
  return Array.from({ length: Math.max(0, n) }, (_, k) => ({ i: k + 1, ...(byI.get(k + 1) ?? { covered: 'no' as const, quote: '', why: '' }) }));
}

/** Gelungene Stelle: nur mit wörtlichem Zitat und Grund. */
export function keepGood(v: unknown, text: string): Good | null {
  if (!isObj(v)) return null;
  const quote = typeof v.quote === 'string' ? normWs(v.quote) : '';
  const why = typeof v.why === 'string' ? clip(v.why, GOOD_WHY_MAX) : '';
  if (!quote || !why || !normWs(text).includes(quote)) return null;
  return { quote: clip(quote, POINT_QUOTE_MAX), why };
}

/** Liste tolerant: fehlt sie oder ist sie ein Text, gilt eine leere Liste. */
export const asList = (v: unknown): unknown => (v === undefined || v === null ? [] : typeof v === 'string' ? [] : v);

/** Punkte-Liste: muss vorhanden und nicht leer sein (sonst Neuversuch nach A6.3), dann `keepPoints`. */
export const pointsField = (text: string, n: number) =>
  z
    .array(z.unknown())
    .min(1)
    .transform((xs) => keepPoints(xs, text, n));

/** Bewertungsstufen der Punkte und `why` (gleich für Antwort und Zusammenfassung, Prüfbefund T2). */
export const POINT_SCALE = 'yes = clearly there; partly = mentioned but vague, incomplete or slightly wrong; no = missing.';
export const POINT_WHY_RULE = 'why: only for "partly" or "no", one short sentence in the explanation language saying what is missing or vague; empty for "yes".';

/** Sprachtreue der Begründungen je Punkt (wie die anderen Erklärfelder). */
export const pointWhyIssues = (points: readonly PointCheck[], wrong: (s: string) => boolean): number[] => points.flatMap((p, k) => (p.why && wrong(p.why) ? [k] : []));

/** Zahl der getroffenen Punkte: `yes` zählt 1, `partly` ½. */
export function pointsScore(points: readonly PointCheck[]): number {
  return points.reduce((s, p) => s + (p.covered === 'yes' ? 1 : p.covered === 'partly' ? 0.5 : 0), 0);
}
