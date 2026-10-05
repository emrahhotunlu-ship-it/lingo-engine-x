import { daysBetween } from '../date';
import type { ComebackMode } from '../unit/types';

// Wiedereinstieg (Gesamtkonzept 3.2): Wie viele volle Lerntage lag zwischen dem letzten aktiven Tag und heute?
// Rein und getestet. Gezählt wird nur Vergangenes (heute selbst nie); Pflicht-Tage (`pflicht`), Tage mit Antworten
// (`days`) und Tage mit Minuten zählen als aktiv. Nie ein Vorwurf: die Oberfläche zeigt nur ein ruhiges Band.

type Rec = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {});
const active = (v: unknown): boolean => v !== undefined && v !== null && v !== false && v !== 0;

/** Letzter aktiver Lerntag vor `today` oder `null` (kein Verlauf). */
export function lastActiveDay(profile: Rec | null | undefined, today: string): string | null {
  const p = obj(profile);
  let best: string | null = null;
  for (const src of [obj(p.days), obj(p.pflicht), obj(p.minutes)]) {
    for (const [k, v] of Object.entries(src)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k >= today || !active(v)) continue;
      if (best === null || k > best) best = k;
    }
  }
  return best;
}

/** Lücke in Lerntagen ohne Aktivität (gestern aktiv = 0). `null`, wenn es keinen Verlauf gibt (Erststart). */
export function comebackGap(profile: Rec | null | undefined, today: string): number | null {
  const last = lastActiveDay(profile, today);
  return last === null ? null : Math.max(0, daysBetween(last, today) - 1);
}

export type ComebackBand = 'none' | 'short' | 'long' | 'restart';

/** Ab so vielen Lerntagen Pause beginnt die Neustart-Woche; so viele Lerntage dauert sie. */
export const RESTART_GAP = 14;
export const RESTART_DAYS = 7;
/** Ab so vielen Lerntagen Pause (und überfälligen Karten) gilt der Kurz-Plan mit 3 Grammatikaufgaben. */
export const REDUCED_GAP = 7;
export const REDUCED_OVERDUE = 40;
/** Der Kurz-Plan gilt höchstens so viele Lerntage nach der Rückkehr, auch wenn das Überfällige nicht unter 40 fällt. */
export const REDUCED_MAX_DAYS = 14;

/** Band auf Heute: ≤ 2 Tage nichts, 3–6 kurz, 7–13 lang, ab 14 die Willkommens-Karte der Neustart-Woche. */
export function comebackBand(gap: number | null): ComebackBand {
  if (gap === null || gap <= 2) return 'none';
  if (gap <= 6) return 'short';
  return gap < RESTART_GAP ? 'long' : 'restart';
}

/** Aktive Lerntage bis einschließlich `today`, aufsteigend. */
function activeDays(profile: Rec | null | undefined, today: string): string[] {
  const p = obj(profile);
  const out = new Set<string>();
  for (const src of [obj(p.days), obj(p.pflicht), obj(p.minutes)]) {
    for (const [k, v] of Object.entries(src)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k <= today && active(v)) out.add(k);
  }
  return [...out].sort();
}

/**
 * Die letzte Rückkehr nach einer Pause von mindestens 7 Lerntagen: Länge der Pause und Lerntage seit der Rückkehr
 * (0 = der erste Tag zurück, auch wenn heute noch nichts geübt wurde). Abgeleitet aus den Lerntagen
 * (`pflicht`, `days`, `minutes`): kein eigener Merker, nichts wird geschrieben.
 */
export function lastReturn(profile: Rec | null | undefined, today: string): { gap: number; since: number } | null {
  const days = activeDays(profile, today);
  let best: { gap: number; start: string } | null = null;
  for (let i = 1; i < days.length; i++) {
    const gap = daysBetween(days[i - 1] as string, days[i] as string) - 1;
    if (gap >= REDUCED_GAP) best = { gap, start: days[i] as string };
  }
  const last = days[days.length - 1];
  if (last !== undefined && last < today) {
    const gap = daysBetween(last, today) - 1;
    if (gap >= REDUCED_GAP) best = { gap, start: today };
  }
  return best ? { gap: best.gap, since: daysBetween(best.start, today) } : null;
}

/**
 * Form des Tagesplans nach einer Pause (Gesamtkonzept 3.2): Neustart-Woche (Pause ≥ 14 Tage) gilt an den ersten 7 Lerntagen;
 * nach 7–13 Tagen Pause gilt der Kurz-Plan (nur 3 Grammatikaufgaben, Satzbau pausiert), solange `overdue` ≥ 40 ist
 * (höchstens 14 Lerntage nach der Rückkehr). Sonst `null` (normaler Plan).
 */
export function comebackMode(profile: Rec | null | undefined, today: string, overdue: number): ComebackMode | null {
  const r = lastReturn(profile, today);
  if (!r) return null;
  if (r.gap >= RESTART_GAP) return r.since < RESTART_DAYS ? 'restart' : null;
  return r.since < REDUCED_MAX_DAYS && overdue >= REDUCED_OVERDUE ? 'reduced' : null;
}

/** Neustart-Woche aktiv? (Hängt nicht vom Überfälligen ab, deshalb schon vor dem Plan bekannt.) */
export const restartActive = (profile: Rec | null | undefined, today: string): boolean => {
  const r = lastReturn(profile, today);
  return !!r && r.gap >= RESTART_GAP && r.since < RESTART_DAYS;
};
