import { addDays, daysBetween } from '../date';
import type { Step3Fmt, Step3Mode } from '../plan/types';
import { dowOf } from '../unit/planFor';

// Wochenrhythmus von Schritt 3 und C1-Check-Tag (Lernplattform 3.0 §2.1, P23). Rein, nichts wird gespeichert. Der Plan ruft diese Funktionen
// EINMAL beim Anlegen auf und friert das Ergebnis ein (`u.c1`, 4. Tupel-Element von Block 3); ein später fällig werdender Check ändert den
// Plan von heute nie (Kap. 15).

/** Format des Tages: Montag Satzbau (kein Eintrag), Dienstag bis Freitag eine c1x-Art, Samstag Tempo-Runde, Sonntag kein Schritt 3. */
export type Step3Format = { mode: Step3Mode; fmt?: Step3Fmt };

/** Aufgaben je Format-Tag (§2.1). */
export const FORMAT_N: Readonly<Record<Step3Fmt, number>> = { ocl: 8, wf: 6, kwt: 4, mcc: 8 };

/** Weniger passende Aufgaben als das: Die Runde entfällt, Schritt 3 ist Satzbau (§2.3 Grenze, gilt für alle Formate). */
export const FORMAT_MIN = 4;

const BY_DOW: Readonly<Record<number, Step3Format | null>> = {
  1: null,
  2: { mode: 'format', fmt: 'ocl' },
  3: { mode: 'format', fmt: 'wf' },
  4: { mode: 'format', fmt: 'kwt' },
  5: { mode: 'format', fmt: 'mcc' },
  6: { mode: 'tempo' },
};

/**
 * Format von Schritt 3 für einen Lerntag. `null` = Satzbau (Montag oder die Art ist nicht angeboten). `kindOn` sagt, ob die Aufgabenart
 * angeboten wird; `tempoOn`, ob es die Tempo-Runde gibt. Nur volle Tage haben Schritt 3 – der Aufrufer fragt nur dann.
 */
export function step3Format(day: string, on: { kindOn: (k: Step3Fmt) => boolean; tempoOn: boolean }): Step3Format | null {
  const f = BY_DOW[dowOf(day)] ?? null;
  if (!f) return null;
  if (f.mode === 'tempo') return on.tempoOn ? f : null;
  return f.fmt && on.kindOn(f.fmt) ? f : null;
}

// ------------------------------------------------------------------ C1-Check

/** Das Check-Fenster: die letzten 7 Tage des Monats. */
export function inCheckWindow(day: string): boolean {
  return addDays(day, 7).slice(0, 7) !== day.slice(0, 7);
}

/** Ist es der letzte Samstag des Monats? */
export const isLastSaturday = (day: string): boolean => dowOf(day) === 6 && inCheckWindow(day);

/** Mindestabstand zwischen zwei Checks in Tagen. */
export const CHECK_GAP_DAYS = 21;

export type CheckFacts = {
  /** Das C1-Programm ist gestartet (`app/c1` vorhanden). */
  programStarted: boolean;
  /** Tag des letzten Checks (`app/c1.checks`), sonst `null`. */
  lastCheck: string | null;
  /** Es gibt noch eine ungenutzte Form A bis L. */
  formAvailable: boolean;
};

/** Hat der Plan dieses Tages den Check-Tag? Nur ein voller Samstag, nur mit Programm, Abstand und freier Form. */
export function checkPlanned(day: string, shape: string, f: CheckFacts): boolean {
  if (shape !== 'sat' || !isLastSaturday(day)) return false;
  if (!f.programStarted || !f.formAvailable) return false;
  return f.lastCheck === null || daysBetween(f.lastCheck, day) >= CHECK_GAP_DAYS;
}
