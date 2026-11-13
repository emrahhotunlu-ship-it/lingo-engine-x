import { create } from 'zustand';
import type { Ctx } from '../../domain/learn/types';
import type { DutyId } from '../../domain/plan/types';
import type { MessageKey } from '../../i18n';

// D3 V-UEBUNG (Prüfung learning-scientist): Welche Runde läuft gerade? Der Übungskopf (`ExerciseTop`) meldet
// Pflicht/Extra und den Pflichtblock, die Laptop-Spalte „Heute“ (TodayMini) liest es. Nur Anzeige, nie planwirksam.
export type RunCtx = { ctx: Ctx | 'extra' | null; duty: DutyId | null };

export const useRunCtx = create<RunCtx>(() => ({ ctx: null, duty: null }));

// Politur P1 (13.11.2026): EIN Abschluss je Schritt des Tages, und sein Hauptknopf nennt das Ziel – „Weiter: Grammatik“,
// „Weiter: Anwenden“, „Fertig für heute“. Die Zwischenkarte entfällt (`features/unit/run.ts` startet den nächsten Schritt direkt).
// Damit kein Abschluss die Tageseinheit kennen muss, meldet sie hier, was nach dem laufenden Schritt kommt:
//  · `SessionEnd` fragt selbst (Hauptknopf „Weiter“ in einer Pflicht-Runde bekommt das Ziel),
//  · eigene Abschlüsse (Wörter-Runde, Anwenden) holen den Text mit `stepNextLabel(t)` bzw. bekommen ihn vom Bereich.
// Nur Anzeige: gestartet wird weiter über `unitDone(block)`.

/** Was nach dem laufenden Schritt der Tageseinheit kommt: der Name des nächsten offenen Schritts, oder `last` = danach ist der Tag fertig. */
export type StepNext = { last: false; name: string } | { last: true };

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

let stepNextProvider: ((t: T) => StepNext | null) | null = null;

/** Die Tageseinheit meldet sich an (einmal, `features/unit/run.ts`). */
export function setStepNextProvider(fn: ((t: T) => StepNext | null) | null): void {
  stepNextProvider = fn;
}

/** `null` = es läuft kein Schritt der Tageseinheit (freie Runde, Extra): der Abschluss behält seinen eigenen Knopf. */
export function stepNext(t: T): StepNext | null {
  return stepNextProvider ? stepNextProvider(t) : null;
}

/** Beschriftung des Hauptknopfs im Abschluss eines Tagesschritts („Weiter: Grammatik“ / „Fertig für heute“), sonst `null`. */
export function stepNextLabel(t: T): string | null {
  const n = stepNext(t);
  if (!n) return null;
  return n.last ? t('nbHeuteDoneToday') : t('nbHeuteBetweenGo', { block: n.name });
}
