import { useSettings } from '../../app/settings';
import { forPhone } from '../../domain/plan/phone';
import type { StoredPlan } from '../../domain/plan/types';
import { isPhoneDevice } from '../../platform/device';

// Handy-Ansicht des Tagesplans (Emrahs Wunsch 01.10.2026): Gilt sie gerade (Handy erkannt UND
// Schalter in den Einstellungen an), liest jeder Verbraucher des Plans – Zähler, Zeilen, Knopf,
// Pflicht-Prüfung, Serie – die abgeleitete Liste ohne die Aufgabe des Tages (`domain/plan/phone`).
// Der gespeicherte Plan bleibt unberührt und gilt auf allen Geräten gleich.

/** Gilt die Handy-Ansicht jetzt? */
export const phoneActive = (): boolean => useSettings.getState().phoneMode && isPhoneDevice();

/** Der Plan, so wie dieses Gerät ihn jetzt zeigt (stabile Referenz, siehe `forPhone`). */
export function viewPlan(plan: StoredPlan | null | undefined): StoredPlan | null {
  if (!plan) return null;
  return phoneActive() ? forPhone(plan) : plan;
}
