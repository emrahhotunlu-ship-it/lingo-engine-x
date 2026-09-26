import { topicById } from '../content';
import type { GrammarTaskType } from '../learn/types';

// Gedämpftes BKT je Grammatikthema (phase2-plan §4.3, Kap. 5). Werte der alten App bleiben
// lesbar und werden in derselben Form geschrieben (`p`, `anchor`, `anchorD`, `due`, `hist`).
//
// - slip .10; guess = 1/Zahl der Optionen bei mc, sonst .05; transit .08 (bei falsch ×.4 wie alt).
// - Δ = clamp(post − p, ±.06); leichter ratbare Aufgaben wiegen weniger (Faktor (1 − guess)/(1 − .05)),
//   mit Hilfe ×0,5. So ist ein Treffer im Multiple Choice nie so viel wert wie eine getippte Lücke.
// - Tagesanker: an einem Lerntag bewegt sich p höchstens ±.12 um den Stand vom Tagesbeginn.
// - p ∈ [.02, .99].

export const SLIP = 0.1;
export const GUESS_TYPED = 0.05;
export const TRANSIT = 0.08;
export const STEP_MAX = 0.06;
export const DAY_BAND = 0.12;
export const P_MIN = 0.02;
export const P_MAX = 0.99;
/** Verfall der Anzeige zur Startbeherrschung (Tage). */
export const DECAY_DAYS = 45;
const DAY_MS = 86_400_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function guessOf(type: GrammarTaskType, nOptions: number | null | undefined): number {
  if (type === 'mc') return 1 / Math.max(2, nOptions ?? 4);
  return GUESS_TYPED;
}

/** Startbeherrschung eines Themas (`p0`), unbekannte Themen .5. */
export const p0Of = (topic: string): number => topicById(topic)?.p0 ?? 0.5;

/** Anzeige-Beherrschung: sinkt ohne Übung langsam Richtung p0 (`p0 + (p − p0)·exp(−Tage/45)`). */
export function displayP(p: number, p0: number, last: number | null | undefined, nowMs: number): number {
  if (!last || p <= p0) return p;
  const days = Math.max(0, (nowMs - last) / DAY_MS);
  return p0 + (p - p0) * Math.exp(-days / DECAY_DAYS);
}

/** Anzeige-Beherrschung direkt aus einem `grammar/<topic>`-Dokument (fehlt es: p0). */
export function topicP(topic: string, doc: Readonly<Record<string, unknown>> | undefined, nowMs: number): number {
  const p0 = p0Of(topic);
  if (!doc) return p0;
  return displayP(num(doc.p, p0), p0, typeof doc.last === 'number' ? doc.last : null, nowMs);
}

export type BktInput = {
  /** Anzeige-Beherrschung vor der Antwort (displayP). */
  p: number;
  anchor: number | null | undefined;
  anchorD: string | null | undefined;
  day: string;
  /** Richtig oder fast richtig (`near` zählt als richtig). */
  ok: boolean;
  type: GrammarTaskType;
  nOptions?: number | null;
  helpLevel: number;
};

export type BktOut = { p: number; anchor: number; anchorD: string; anchorChanged: boolean; delta: number };

export function bktStep(i: BktInput): BktOut {
  const p = clamp(i.p, P_MIN, P_MAX);
  const g = guessOf(i.type, i.nOptions);
  const s = SLIP;
  const post0 = i.ok ? (p * (1 - s)) / (p * (1 - s) + (1 - p) * g) : (p * s) / (p * s + (1 - p) * (1 - g));
  const post = post0 + (1 - post0) * TRANSIT * (i.ok ? 1 : 0.4);
  const weight = (1 - g) / (1 - GUESS_TYPED);
  let delta = clamp(post - p, -STEP_MAX, STEP_MAX) * weight;
  if (i.helpLevel >= 1) delta *= 0.5;
  const anchorChanged = i.anchorD !== i.day || typeof i.anchor !== 'number';
  const anchor = anchorChanged ? p : (i.anchor as number);
  const next = clamp(clamp(p + delta, anchor - DAY_BAND, anchor + DAY_BAND), P_MIN, P_MAX);
  return { p: next, anchor, anchorD: i.day, anchorChanged, delta: next - p };
}

/** Nächste Fälligkeit des Themas: richtig → 1–21 Tage je nach p, falsch → 1 Tag. */
export function nextDue(ok: boolean, p: number, nowMs: number): number {
  const days = ok ? clamp(Math.round(1 + 18 * p * p), 1, 21) : 1;
  return nowMs + days * DAY_MS;
}

export type Certainty = { dots: 0 | 1 | 2 | 3 | 4 | 5; word: 0 | 1 | 2 | 3 | 4 | 5 };

/**
 * Sicherheit 0–5 für die Statuszeile (i18n `certainty0..5`: neu · wackelig · im Aufbau · solide ·
 * sicher · gefestigt). Wie `masteryStep` der alten App: unter 4 Aufgaben „wackelig", danach aus p,
 * aber nie im Widerspruch zur Quote der letzten Aufgaben.
 */
export function certainty(p: number, stats?: { n?: number | null; recent?: readonly number[] | null }): Certainty {
  const n = stats?.n ?? null;
  let k: number;
  if (n === 0) k = 0;
  else if (n !== null && n < 4) k = 1;
  else {
    k = clamp(Math.ceil(p * 5), 1, 5);
    const r = stats?.recent ?? [];
    if (r.length >= 4) {
      const acc = r.reduce((a, b) => a + b, 0) / r.length;
      const cap = acc < 0.4 ? 2 : acc < 0.7 ? 3 : acc < 0.85 ? 4 : 5;
      const floor = r.length >= 6 && acc >= 0.85 ? 4 : 2;
      k = clamp(k, floor, cap);
    }
  }
  const v = clamp(Math.round(k), 0, 5) as Certainty['word'];
  return { dots: v, word: v };
}
