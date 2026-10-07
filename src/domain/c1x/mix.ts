import { hash32, mulberry32, shuffle } from '../random';
import type { C1Item, Err, Mcc } from './types';

// Anzeige-Reihenfolge der Auswahlarten. Im Inhalt steht die Lösung in einem festen Kreis (mcc: Platz 0,1,2,3,2,0,3,1 …; err-Chips: 0,1,2 …),
// damit wäre sie vorhersehbar. Deshalb wird beim Anzeigen fest gemischt: Startwert = Aufgaben-ID + Lerntag. So würfelt Neu-Zeichnen nie neu
// (Kap. 15), am nächsten Lerntag liegt die Lösung woanders. Die Mischung ist reine Ansicht: Antwort und Buchung tragen weiter den Inhalt
// (mcc: Index in `item.options`, err: Text des Chips), nie die angezeigte Position.

/** Feste Reihenfolge der Indizes `0 … n-1` für einen Startwert: `order[angezeigt] = Index im Inhalt`. */
export function mixOrder(n: number, seed: string): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    mulberry32(hash32(seed)),
  );
}

/** `mcc`: angezeigte Reihenfolge der vier Optionen am Lerntag `day`. */
export const mccOrder = (item: Mcc, day: string): number[] => mixOrder(item.options.length, `mcc-mix|${item.id}|${day}`);

/** `err`: angezeigte Reihenfolge der drei Korrektur-Chips (`null`, wenn die Aufgabe keine Chips hat). */
export const errChipOrder = (item: Err, day: string): number[] | null => (item.bad?.choices ? mixOrder(item.bad.choices.length, `err-mix|${item.id}|${day}`) : null);

/** Die Optionen bzw. Chips in Anzeige-Reihenfolge (für die Begründungen je Option); `null` bei Arten ohne Auswahl. */
export function shownOptions(item: C1Item, day: string): string[] | null {
  if (item.kind === 'mcc') return mccOrder(item, day).map((i) => item.options[i] ?? '');
  if (item.kind === 'err') {
    const order = errChipOrder(item, day);
    const choices = item.bad?.choices;
    return order && choices ? order.map((i) => choices[i] ?? '') : null;
  }
  return null;
}
