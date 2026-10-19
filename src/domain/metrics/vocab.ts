import { dayKey, daysBetween, isDayKey } from '../date';
import { histOf } from '../srs/flip';
import { retrievability } from '../srs/scheduler';
import { FREE_ANSWER } from '../srs/variety';
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
/**
 * Erster Lerntag mit der strengeren Fest-Regel (Paket ST: Stufe 5, 21 Tage, im neuen Satz gekonnt). Tagesbilder (`history[].va`/`vu`) davor
 * wurden nach der alten Regel gezählt: Ein Unterschied zwischen alt und neu ist kein Rückgang. Zuwachs und Wochenzahl vergleichen deshalb nur
 * Werte ab diesem Tag (kein neues Speicherfeld nötig). Die Erklärzeile zur neuen Zählung steht `FEST_NOTE_DAYS` Tage lang.
 */
export const FEST_RULE_FROM = '2026-10-20';
export const FEST_NOTE_DAYS = 42;
/** Die Grenze gilt erst, wenn der Tag selbst nach ihr liegt (vor dem Stichtag gibt es noch keine Werte der neuen Regel; so bleiben Testwelten und Vorabstände unverändert). */
export const ruleCut = (day: string, ruleFrom: string = FEST_RULE_FROM): string => (day >= ruleFrom ? ruleFrom : '');
export const festNoteActive = (today: string): boolean => daysBetween(FEST_RULE_FROM, today) <= FEST_NOTE_DAYS;

type CardLike = Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>;
type FestLike = Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>;

export { isFest };

export function festCount(cards: readonly FestLike[], nowMs?: number): number {
  let n = 0;
  for (const c of cards) if (isFest(c, nowMs)) n++;
  return n;
}

/** Erwartet gekonnt: Summe der Abrufwahrscheinlichkeiten aller gelernten Karten, gerundet. Sinkt bei Pausen. */
export function expectedKnown(cards: readonly Pick<TrainCard, 'hidden' | 'isNew' | 'fsrs'>[], nowMs: number): number {
  let sum = 0;
  for (const c of cards) if (!c.hidden && !c.isNew) sum += retrievability(c.fsrs, nowMs);
  return Math.round(sum);
}

export type RetentionPart = {
  /** Anteil Note ≥ 2, `null` ohne Antworten. */
  rate: number | null;
  n: number;
};

export type Retention28 = {
  /** Behalten bei FREIEM Abruf (getippt, ohne Auswahl und ohne Stütze): Anteil Note ≥ 2, `null` ohne Antworten. Diese Zahl wird gezeigt. */
  rate: number | null;
  n: number;
  /** Mindestens 30 freie Antworten: erst dann wird die Zahl gezeigt. */
  enough: boolean;
  /** Lage zum Korridor (nur bei `enough`). */
  band: 'low' | 'in' | 'high' | null;
  /** Getrennt gerechnet: Behalten beim Erkennen (Auswahl, Aufdecken). Liegt fast immer höher; wird nur eingeklappt gezeigt. */
  recognition: RetentionPart;
};

/** Erkennen: Antworten mit Auswahl oder Aufdecken. Frei: `FREE_ANSWER` (ohne ungeprüfte Sätze). Alles andere (Stütze, alter Verlauf ohne Art) zählt in keinem von beiden. */
const RECOGNITION: ReadonlySet<string> = new Set(['mc_en', 'ctx_mc', 'listen_mc', 'mc_de', 'match', 'contrast', 'flip', 'spot', 'find_trap']);

/**
 * Behaltensquote der letzten 28 Tage: erste Antwort je Karte, Lerntag und Art (Erkennen oder frei), nur wenn die vorige Antwort
 * mindestens 7 Tage zurücklag (sonst misst sie Kurzzeitgedächtnis). Note ≥ 2 = behalten. Erkennen und frei werden getrennt gezählt
 * (Auswertung 15.10.2026: Auswahl 95 % richtig, frei 68 %); die Hauptzahl ist die freie.
 */
export function retention28(cards: readonly CardLike[], nowMs: number): Retention28 {
  const from = nowMs - GROWTH_WINDOW_DAYS * DAY_MS;
  const free = { ok: 0, n: 0 };
  const rec = { ok: 0, n: 0 };
  for (const c of cards) {
    if (c.hidden) continue;
    const hist = histOf(c.doc);
    const raw = Array.isArray(c.doc.hist) ? (c.doc.hist as unknown[]) : [];
    const unchecked = new Set<number>();
    for (const h of raw) if (h && typeof h === 'object' && (h as Record<string, unknown>).u === 1 && typeof (h as Record<string, unknown>).t === 'number') unchecked.add((h as Record<string, number>).t as number);
    const seen = new Set<string>();
    for (let i = 1; i < hist.length; i++) {
      const h = hist[i]!;
      if (h.t < from || h.t > nowMs || h.g === null) continue;
      if (h.t - hist[i - 1]!.t < RETENTION_GAP_DAYS * DAY_MS) continue;
      const isFree = h.x !== null && FREE_ANSWER.has(h.x) && !unchecked.has(h.t);
      const isRec = h.x !== null && RECOGNITION.has(h.x);
      if (!isFree && !isRec) continue;
      const key = `${dayKey(h.t)}:${isFree ? 'f' : 'r'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const part = isFree ? free : rec;
      part.n++;
      if (h.g >= 2) part.ok++;
    }
  }
  const rate = free.n ? free.ok / free.n : null;
  const enough = free.n >= RETENTION_MIN_ANSWERS;
  const band = !enough || rate === null ? null : rate < RETENTION_BAND[0] ? 'low' : rate > RETENTION_BAND[1] ? 'high' : 'in';
  return { rate, n: free.n, enough, band, recognition: { rate: rec.n ? rec.ok / rec.n : null, n: rec.n } };
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
export function festGrowth28(festNow: number, history: unknown, today: string, ruleFrom: string = FEST_RULE_FROM): FestGrowth | null {
  const cut = ruleCut(today, ruleFrom);
  const rows = (Array.isArray(history) ? history : [])
    .filter((h): h is Doc => !!h && typeof h === 'object')
    .filter((h) => isDayKey(h.d) && h.d >= cut && typeof h.va === 'number' && Number.isFinite(h.va))
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

/**
 * Wörter UND Wendungen fest (Motivation §4.6, I7): `cards` = Vokabel- und Wendungskarten zusammen. Kopf des Fortschritts, Marken,
 * Ziel und Wochenrückblick lesen nur diese Funktion. `festNow` (nur `vocab/*`, Tagesbild `va`) bleibt unverändert.
 */
export function festUnits(cards: readonly FestLike[], nowMs?: number): number {
  return festCount(cards, nowMs);
}

/** Tagesbild-Feld, aus dem der Zuwachs gerechnet wird: `va` (nur Vokabeln, alt) oder `vu` (Wörter und Wendungen, neu). */
type GrowthKey = 'va' | 'vu';

function growthOf(key: GrowthKey, now: number, history: unknown, today: string, minDays: number, ruleFrom: string): FestGrowth | null {
  const cut = ruleCut(today, ruleFrom);
  const rows = (Array.isArray(history) ? history : [])
    .filter((h): h is Doc => !!h && typeof h === 'object')
    .filter((h) => isDayKey(h.d) && h.d >= cut && typeof h[key] === 'number' && Number.isFinite(h[key]))
    .map((h) => ({ d: h.d as string, v: h[key] as number }))
    .filter((h) => daysBetween(h.d, today) >= 0 && daysBetween(h.d, today) <= GROWTH_WINDOW_DAYS)
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const first = rows[0];
  if (!first) return null;
  const days = daysBetween(first.d, today);
  if (days < minDays) return null;
  const delta = now - first.v;
  return { delta, days, per28: (delta * GROWTH_WINDOW_DAYS) / days };
}

/**
 * „+n in 28 Tagen“ für Wörter und Wendungen: wechselt erst auf `vu`, wenn 28 Tage davon vorliegen; bis dahin gilt `va` mit der
 * Vokabel-Fest-Zahl (kein Sprung am Umstellungstag, weil beide Reihen nie vermischt werden).
 */
export function festGrowthUnits(i: { vocabFest: number; unitsFest: number; history: unknown; today: string; ruleFrom?: string }): FestGrowth | null {
  const from = i.ruleFrom ?? FEST_RULE_FROM;
  return growthOf('vu', i.unitsFest, i.history, i.today, GROWTH_WINDOW_DAYS, from) ?? growthOf('va', i.vocabFest, i.history, i.today, GROWTH_MIN_DAYS, from);
}
