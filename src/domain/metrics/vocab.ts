import { dayKey, daysBetween, isDayKey } from '../date';
import { histOf } from '../srs/flip';
import { retrievability } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';
import { isFest } from './definitions';

// Wortzahlen für „Fortschritt“ (Gesamtkonzept 3.5, K1 bis K3). Reine Funktionen, eine Quelle je Zahl:
// Fest, Zuwachs, Prognose, Erwartet gekonnt und Behaltensquote. Nichts wird gespeichert oder geschrieben.

const DAY_MS = 86_400_000;
/** Behaltensquote: Korridor 85 bis 93 Prozent; unter 30 Antworten zu wenig Daten (K3). */
export const RETENTION_BAND: readonly [number, number] = [0.85, 0.93];
export const RETENTION_MIN_ANSWERS = 30;
/** Pause vor einer Antwort, damit sie für die Behaltensquote zählt (Tage). */
export const RETENTION_GAP_DAYS = 7;
/** Zuwachs und Prognose brauchen mindestens so viele Tage Datenbasis (K1). */
export const GROWTH_MIN_DAYS = 21;
export const GROWTH_WINDOW_DAYS = 28;
/** Orientierungsziel für die Prognose (03-lernmodell K1: 1.500 aktiv feste Einträge). */
export const FEST_GOAL = 1500;

type CardLike = Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>;

export { isFest };

export function festCount(cards: readonly Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs'>[]): number {
  let n = 0;
  for (const c of cards) if (isFest(c)) n++;
  return n;
}

/** Erwartet gekonnt: Summe der Abrufwahrscheinlichkeiten aller gelernten Karten, gerundet. Sinkt bei Pausen. */
export function expectedKnown(cards: readonly Pick<TrainCard, 'hidden' | 'isNew' | 'fsrs'>[], nowMs: number): number {
  let sum = 0;
  for (const c of cards) if (!c.hidden && !c.isNew) sum += retrievability(c.fsrs, nowMs);
  return Math.round(sum);
}

export type Retention28 = {
  /** Anteil Note ≥ 2, `null` ohne Antworten. */
  rate: number | null;
  n: number;
  /** Mindestens 30 Antworten: erst dann wird die Zahl gezeigt. */
  enough: boolean;
  /** Lage zum Korridor (nur bei `enough`). */
  band: 'low' | 'in' | 'high' | null;
};

/**
 * Behaltensquote der letzten 28 Tage: erste Antwort je Karte und Lerntag, nur wenn die vorige Antwort
 * mindestens 7 Tage zurücklag (sonst misst sie Kurzzeitgedächtnis). Note ≥ 2 = behalten.
 */
export function retention28(cards: readonly CardLike[], nowMs: number): Retention28 {
  const from = nowMs - GROWTH_WINDOW_DAYS * DAY_MS;
  let ok = 0;
  let n = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    const hist = histOf(c.doc);
    const seen = new Set<string>();
    for (let i = 1; i < hist.length; i++) {
      const h = hist[i]!;
      if (h.t < from || h.t > nowMs || h.g === null) continue;
      if (h.t - hist[i - 1]!.t < RETENTION_GAP_DAYS * DAY_MS) continue;
      const d = dayKey(h.t);
      if (seen.has(d)) continue;
      seen.add(d);
      n++;
      if (h.g >= 2) ok++;
    }
  }
  const rate = n ? ok / n : null;
  const enough = n >= RETENTION_MIN_ANSWERS;
  const band = !enough || rate === null ? null : rate < RETENTION_BAND[0] ? 'low' : rate > RETENTION_BAND[1] ? 'high' : 'in';
  return { rate, n, enough, band };
}

type Doc = Readonly<Record<string, unknown>>;

export type FestGrowth = {
  /** Zuwachs an Fest-Karten seit dem Vergleichstag (kann negativ sein: Fest darf sinken). */
  delta: number;
  /** Tage zwischen Vergleichstag und heute. */
  days: number;
  /** Zuwachs auf 28 Tage hochgerechnet (für die Prognose). */
  per28: number;
};

/**
 * „+n in 28 Tagen“ aus den Tagesbildern (`profile.history[].va` = Fest-Zahl des Tages): der älteste Eintrag
 * der letzten 28 Tage. `null`, solange die Datenbasis kürzer als 21 Tage ist (K1: keine Prognose aus dünnen Daten).
 */
export function festGrowth28(festNow: number, history: unknown, today: string): FestGrowth | null {
  const rows = (Array.isArray(history) ? history : [])
    .filter((h): h is Doc => !!h && typeof h === 'object')
    .filter((h) => isDayKey(h.d) && typeof h.va === 'number' && Number.isFinite(h.va))
    .map((h) => ({ d: h.d as string, va: h.va as number }))
    .filter((h) => daysBetween(h.d, today) >= 0 && daysBetween(h.d, today) <= GROWTH_WINDOW_DAYS)
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const first = rows[0];
  if (!first) return null;
  const days = daysBetween(first.d, today);
  if (days < GROWTH_MIN_DAYS) return null;
  const delta = festNow - first.va;
  return { delta, days, per28: (delta * GROWTH_WINDOW_DAYS) / days };
}

export type FestForecast = { weeksLo: number; weeksHi: number } | null;

/**
 * Prognose als Zeitraum (Wochen bis `target` Fest-Karten): das aktuelle Tempo ±30 Prozent. Nur mit Zuwachs
 * ≥ 1 je 28 Tage und der Datenbasis aus `festGrowth28`; sonst `null` (keine Zahl ist besser als eine erfundene).
 */
export function festForecast(festNow: number, growth: FestGrowth | null, target: number): FestForecast {
  if (!growth || growth.per28 < 1 || festNow >= target) return null;
  const perWeek = growth.per28 / 4;
  const left = target - festNow;
  const lo = Math.max(1, Math.round(left / (perWeek * 1.3)));
  const hi = Math.max(lo, Math.round(left / (perWeek * 0.7)));
  return { weeksLo: lo, weeksHi: hi };
}
