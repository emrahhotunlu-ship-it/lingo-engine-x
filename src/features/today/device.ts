import { forFocus } from '../../domain/plan/retire';
import type { StoredPlan } from '../../domain/plan/types';

// Der Tagesplan, so wie die App ihn zeigt: ohne die Blöcke und Pflichtpunkte, die es seit dem Umbau
// „Fokus Wörter und Grammatik“ nicht mehr gibt (`domain/plan/retire`). Jeder Verbraucher des Plans – Zähler,
// Zeilen, Knopf, Pflicht-Prüfung, Serie – liest diese eine Ansicht. Der gespeicherte Plan bleibt unberührt.

/** Der Plan in der Ansicht des Umbaus (stabile Referenz, siehe `forFocus`). */
export function viewPlan(plan: StoredPlan | null | undefined): StoredPlan | null {
  return plan ? forFocus(plan) : null;
}
