import { daysBetween } from '../date';

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

export type ComebackBand = 'none' | 'short' | 'long';

/** Band auf Heute: ≤ 2 Tage nichts, 3–6 kurz, ab 7 lang (Neustart-Woche ab 14 ist noch nicht gebaut). */
export function comebackBand(gap: number | null): ComebackBand {
  if (gap === null || gap <= 2) return 'none';
  return gap <= 6 ? 'short' : 'long';
}
