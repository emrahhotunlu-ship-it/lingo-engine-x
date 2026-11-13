// Brücken-Sätze (Großpaket P „Politur“, P4; Entscheidung E2 vom 13.11.2026): Satzzahl und ehrliche Minuten von Schritt 3. Rein, ohne Importe
// (der Tagesplan `domain/unit/planFor.ts` und Heute lesen diese Datei früh).
//
// Die Minuten von Schritt 3 nennen, was die Aufgabe wirklich braucht – nicht das 10-%-Budget des Tagesziels: zwei Sätze mit Prüfung und Rückmeldung
// dauern rund 3 Minuten. Sobald genug echte Sätze gemessen sind, gilt der Messwert (`app/profile.abm`):
//
//   app/profile.abm = { n: 12, ms: 84000 }     n = gemessene Sätze (≤ 99) · ms = gleitender Mittelwert je Satz in Millisekunden
//
// Geschrieben einmal je beendeter Runde (`bridgeStatPatch`), gelesen beim Einfrieren des Tagesplans (`bridgeMinutesOf`). Additiv und tolerant:
// fehlt das Feld oder ist es unlesbar, gilt der Standard; ein unerwarteter Aufbau wird nie überschrieben.

type Doc = Readonly<Record<string, unknown>>;

/** Sätze der Pflicht (E2: „täglich 2 Brücken-Sätze“), am kurzen Tag einer. */
export const BRIDGE_N = 2;
export const BRIDGE_SHORT_N = 1;
/** Minuten von Schritt 3 ohne Messwert (E2: „≈ 3 Min.“). */
export const BRIDGE_MIN = 3;
/** Grenzen der angezeigten Minuten. */
export const BRIDGE_MIN_RANGE = [2, 6] as const;
/** Ab so vielen gemessenen Sätzen gilt der Messwert. */
export const BRIDGE_STAT_MIN = 4;
export const BRIDGE_STAT_MAX = 99;
/** Gewicht eines neuen Satzes im gleitenden Mittel (die letzten rund 8 Sätze prägen den Wert). */
const WINDOW = 8;
/** Ein Satz unter 10 s oder über 10 min ist keine Messung (Abbruch, liegen gelassen). */
export const BRIDGE_MS_RANGE = [10_000, 600_000] as const;

export type BridgeStat = { n: number; ms: number };

const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** `abm` lesen; `null` = vorhanden, aber unerwarteter Aufbau (wird nie überschrieben). Fehlt es, gilt `{n: 0, ms: 0}`. */
export function readBridgeStat(profile: Doc | null | undefined): BridgeStat | null {
  const raw = profile?.abm;
  if (raw === undefined || raw === null) return { n: 0, ms: 0 };
  if (!isObj(raw) || typeof raw.n !== 'number' || !Number.isInteger(raw.n) || raw.n < 0) return null;
  if (typeof raw.ms !== 'number' || !Number.isFinite(raw.ms) || raw.ms < 0) return null;
  return { n: Math.min(BRIDGE_STAT_MAX, raw.n), ms: Math.round(raw.ms) };
}

/** Minuten für `n` Sätze aus der gemessenen Zeit je Satz (2 bis 6); ohne Messwert der Standard. */
export function bridgeMinutes(msPerSentence: number | null | undefined, n: number = BRIDGE_N): number {
  if (typeof msPerSentence !== 'number' || !Number.isFinite(msPerSentence) || msPerSentence <= 0) return BRIDGE_MIN;
  return Math.min(BRIDGE_MIN_RANGE[1], Math.max(BRIDGE_MIN_RANGE[0], Math.round((n * msPerSentence) / 60_000)));
}

/** Minuten von Schritt 3 für einen NEUEN Tagesplan: der Messwert, sobald genug Sätze gemessen sind; sonst `undefined` (dann gilt der Standard). */
export function bridgeMinutesOf(profile: Doc | null | undefined): number | undefined {
  const s = readBridgeStat(profile);
  return s && s.n >= BRIDGE_STAT_MIN ? bridgeMinutes(s.ms) : undefined;
}

/**
 * Profil-Patch nach einer Runde: jede gültige Satzdauer geht in das gleitende Mittel. `null` = nichts zu schreiben (keine gültige Messung, oder
 * `abm` hat einen unerwarteten Aufbau).
 */
export function bridgeStatPatch(cur: Doc | null | undefined, durations: readonly number[]): { abm: BridgeStat } | null {
  const s = readBridgeStat(cur);
  if (!s) return null;
  let { n, ms } = s;
  let took = 0;
  for (const d of durations) {
    if (typeof d !== 'number' || !Number.isFinite(d) || d < BRIDGE_MS_RANGE[0] || d > BRIDGE_MS_RANGE[1]) continue;
    const w = Math.min(n + 1, WINDOW);
    ms = n === 0 ? d : ms + (d - ms) / w;
    n = Math.min(BRIDGE_STAT_MAX, n + 1);
    took++;
  }
  return took ? { abm: { n, ms: Math.round(ms) } } : null;
}
