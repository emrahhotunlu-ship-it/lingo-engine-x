// Wörter-Modul V2: Problemwörter und Verwechslungspaare (synthese M14, Emrah 4.2).
//  - Beim 6. Fehler (danach alle 4 weiteren) bekommt das Lexem eine neue Darstellung: neuer Satz, Merkhilfe, Kontrast (Ereignis `leech`).
//  - Paar-Regel nur für echte englische Paare (*affect/effect*): das zweite Wort ruht, bis das Problemwort 7 Tage hält (`Catalog.rests`).
//  - Falsche Freunde (*eventually* ≠ eventuell) ruhen nie; sie bekommen statt der Pause eine Kontrastkarte Deutsch ↔ Englisch.

import type { Lex } from './types';

export const LEECH_AT = 6;
/**
 * Politur P2 (Prüfbericht S7, Emrah E3): Ab dem 3. Vergessen gilt ein Wort als Problemwort. Dann kommt es in einem Satz, den es noch nie
 * hatte; hat es eine Falle (falscher Freund, Paar) oder wurde es mit einem anderen Wort verwechselt, folgt in der nächsten Runde die
 * Gegenüberstellung (Kontrastkarte); ein echter Verwechslungspartner ruht 2 Tage, damit das Problemwort allein neu sitzen kann.
 */
export const PROBLEM_AT = 3;
/** So viele Lerntage nach dem Vergessen des Problemworts ruht sein Verwechslungspartner (Tag des Fehlers zählt nicht mit). */
export const PROBLEM_REST_DAYS = 2;
/** Ein Problemwort hört auf, eins zu sein, sobald die führende Spur so stabil ist (Tage): sonst blieb es nach 3 Fehlern für immer eins. */
export const PROBLEM_CLEAR_S = 21;
/**
 * Problemwort: mindestens `PROBLEM_AT`-mal vergessen UND die führende Spur (Benutzen, sonst Verstehen) noch unter `PROBLEM_CLEAR_S` Tagen
 * Stabilität (Prüfbefund learning-scientist 13.11.2026). `lc` wird nie zurückgesetzt; ein Wort, das inzwischen sitzt, ist kein Problem mehr.
 */
export const isProblem = (lex: Pick<Lex, 'lc' | 'u' | 'b'>): boolean => lex.lc >= PROBLEM_AT && (lex.b ?? lex.u).s < PROBLEM_CLEAR_S;
export const LEECH_EVERY = 4;
export const PAIR_HOLD_DAYS = 7;
export const isLeechCount = (lc: number): boolean => lc >= LEECH_AT && (lc - LEECH_AT) % LEECH_EVERY === 0;

/** Neue Darstellung für ein Problemwort: Kontrastkarte (falscher Freund oder Paar) oder Werkstatt (neuer Satz, Merkhilfe). */
export function leechTreatment(trap: 'pair' | 'ff' | null | undefined): 'contrast' | 'workshop' {
  return trap === 'ff' || trap === 'pair' ? 'contrast' : 'workshop';
}
