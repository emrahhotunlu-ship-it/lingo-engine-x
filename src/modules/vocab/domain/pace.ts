import { DEFAULT_FORM_MS, type Form, type FormStats } from './types';

// Echte Zeit je Karte (Emrah 07.11.2026, Wahl „A“: „Tageszeit 25 min, aber der erste Teil dauert schon 30 min“). Der Plan rechnete mit den
// Startwerten `DEFAULT_FORM_MS` (Lücke 14 s) – das ist nur die Antwortzeit. Wirklich kostet eine geplante Karte Antwort + Rückmeldung lesen +
// Nachtippen + Wiederholung in der Runde. Gemessen wird deshalb je geplantem Eintrag die GANZE Zeit, die er in der Runde kostet (alle
// Auftritte zusammen), je Form gleitend gemittelt (`vmod/pace`). Rein.

/** Ohne Messwerte: Startwerte × 3 (≈ 42 s je Lücke; Emrah brauchte am 07.11. rund 50 s je Wort). */
export const PLAN_START_FACTOR = 3;
/** Gewicht einer neuen Runde im gleitenden Mittel. */
export const PACE_ALPHA = 0.35;
/** Grenzen je Form (ms). */
export const PACE_MIN_MS = 5_000;
export const PACE_MAX_MS = 300_000;
/** Mindestzahl Einträge einer Form in einer Runde, damit sie zählt. */
export const PACE_MIN_N = 2;

const clamp = (ms: number): number => Math.round(Math.min(PACE_MAX_MS, Math.max(PACE_MIN_MS, ms)));

/** Planungszeiten je Form: gemessener Wert, sonst Startwert × {@link PLAN_START_FACTOR}. */
export function planMed(stored: FormStats | null | undefined): FormStats {
  const out: FormStats = {};
  for (const f of Object.keys(DEFAULT_FORM_MS) as Form[]) out[f] = stored?.[f] ?? clamp(DEFAULT_FORM_MS[f] * PLAN_START_FACTOR);
  return out;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/**
 * Neue Planungszeiten nach einer Runde: je Form der Median der beobachteten Kosten (≥ {@link PACE_MIN_N} Einträge), gleitend mit dem alten Wert
 * gemittelt. Formen ohne genug Beobachtung bleiben, wie sie waren. `null` = nichts Neues.
 */
export function nextPace(stored: FormStats | null | undefined, obs: ReadonlyMap<Form, readonly number[]>): { med: FormStats; n: Partial<Record<Form, number>> } | null {
  const med: FormStats = { ...(stored ?? {}) };
  const n: Partial<Record<Form, number>> = {};
  let changed = false;
  for (const [f, xs] of obs) {
    if (xs.length < PACE_MIN_N) continue;
    const o = clamp(median(xs));
    const old = stored?.[f];
    med[f] = old === undefined ? o : clamp(old * (1 - PACE_ALPHA) + o * PACE_ALPHA);
    n[f] = xs.length;
    changed = true;
  }
  return changed ? { med, n } : null;
}

/**
 * Zeitdeckel (Wahl „A“): Ist die Wörter-Zeit um, endet die Pflichtrunde. Der eingefrorene Plan behält nur, was heute erledigt ist – so sagen
 * Heute und Zähler „erledigt“ (Kap. 2 Nr. 2). Der Rest kommt morgen (die gefährdetsten zuerst, wie beim kurzen Tag). `null` = nichts wegzunehmen.
 */
export function capPlanToDone<E extends readonly [string, string, string]>(plan: readonly E[], isDone: (e: E) => boolean): { kept: E[]; dropped: number } | null {
  const kept = plan.filter(isDone);
  if (kept.length >= plan.length) return null;
  return { kept, dropped: plan.length - kept.length };
}
