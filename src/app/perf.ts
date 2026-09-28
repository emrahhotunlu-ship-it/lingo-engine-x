import { logWarn } from '../platform/diagnostics';

// Messmarken des Rahmens (leistung.md §4 Nr. 10, architektur.md §3.4, N09):
// - `lx:nav`: Tipp auf Reiter/Knopf → neues Bild. `markNavStart()` im Klick, der Rahmen setzt nach
//   dem nächsten Bild die Messung `lx:nav` (Dauer = `duration`, Ziel < 100 ms).
// - `lx:card`: „Weiter“/Bewertung → nächste Karte im Bild. Die Übung ruft `cardStart()` im Klick
//   und `cardShown()` im Effekt/Layout-Effekt der neuen Karte (Ziel < 50 ms). Beide Werte stehen
//   als `performance.measure` in der Zeitleiste; die Diagnose (P6) liest `lastMeasure`.
// Nur die jeweils letzte Messung bleibt stehen (kein Wachsen der Zeitleiste).

function safe(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    logWarn('perf:mark', err);
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

let navStart: number | null = null;

/** Im Klick auf einen Reiter oder Einstieg. */
export function markNavStart(): void {
  navStart = now();
}

/** Nach dem nächsten Bild des neuen Bildschirms (ruft der Rahmen). */
export function markNavPainted(): void {
  const start = navStart;
  if (start === null || typeof requestAnimationFrame === 'undefined') return;
  navStart = null;
  requestAnimationFrame(() =>
    safe(() => {
      performance.clearMeasures('lx:nav');
      performance.measure('lx:nav', { start, end: now() });
    }),
  );
}

let cardT0: number | null = null;

/** Im Klick auf „Weiter“ bzw. auf eine Bewertung. */
export function cardStart(): void {
  cardT0 = now();
}

/**
 * Die neue Karte steht (im Layout-Effekt der Karte aufrufen). Misst bis zum nächsten Bild; ohne
 * vorheriges `cardStart()` passiert nichts. `id` landet als `detail` in der Messung.
 */
export function cardShown(id?: string): void {
  const start = cardT0;
  if (start === null || typeof requestAnimationFrame === 'undefined') return;
  cardT0 = null;
  requestAnimationFrame(() =>
    safe(() => {
      performance.clearMeasures('lx:card');
      performance.measure('lx:card', { start, end: now(), detail: id ?? null });
    }),
  );
}

/** Letzte Messung (Diagnose, Tests): Dauer in ms oder `null`. */
export function lastMeasure(name: 'lx:nav' | 'lx:card'): number | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return null;
  const list = performance.getEntriesByName(name, 'measure');
  const last = list[list.length - 1];
  return last ? Math.round(last.duration * 10) / 10 : null;
}
