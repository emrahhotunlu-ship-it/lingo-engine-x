import { SPRINGS } from '../../../ui/motion';
import type { Film } from '../../../domain/c1/anim';

// Zeitwerte des Struktur-Films (P61) – klein und ohne Spieler, damit die Startknöpfe sie zeigen können, ohne den Spieler mitzuladen.

/** Dauer der Wortbewegung (Feder `morph`, ≈ 450 ms) – bewusst ein Moment, keine Bedienbewegung. */
export const MORPH_MS = Math.round(SPRINGS.morph.visualDuration * 1000);
/** Verweildauer je Schritt (ohne Stimme), bei „langsamer“ geteilt durch 0,75. */
export const DWELL_MS = { first: 1600, step: 3200 } as const;

/** Ungefähre Laufzeit eines Films in Sekunden inkl. Vorhersage (für den Startknopf), auf 5 s gerundet. */
export function filmSeconds(film: Film): number {
  const play = (DWELL_MS.first + (film.steps.length - 1) * (DWELL_MS.step + MORPH_MS)) / 1000;
  return Math.max(10, Math.round((play + 8) / 5) * 5);
}
