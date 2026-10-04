import type { DutyId, StoredPlan } from './types';

// Pflichtpunkte und Blöcke, die es nach dem Umbau „Fokus Wörter und Grammatik“ nicht mehr gibt (Gesamtkonzept
// Kap. 6, „Pflicht/Serie am Umstellungstag“): ein am Umstellungstag schon eingefrorener Tagesplan kann
// sie noch tragen (Kurs-Lektion, Input-Block, Sprech- und Schreibaufgaben, Diktat, Sprint). Sie werden als
// „entfällt“ behandelt, nicht als offen – sonst bliebe die Pflicht dieses einen Tages unerfüllbar und die
// Serie risse. Rein. Der gespeicherte Plan bleibt unberührt (Kap. 15: nie neu gewürfelt); alle Verbraucher
// lesen die abgeleitete Ansicht `forFocus` (Zähler, Zeilen, Knopf, Pflicht-Prüfung, Serie).

const RETIRED_DUTY = new Set<string>(['lesson', 'ch:u-in', 'ch:say', 'ch:dictate', 'ch:sprint']);

/** Blockarten, die ein neuer Plan erzeugt (oder die ältere Pläne mit weiter vorhandener Übung tragen). */
const LIVE_KINDS = new Set<string>(['review', 'grammar', 'focus', 'task.order', 'task.check', 'again']);

/** Gibt es diesen Pflichtpunkt nach dem Umbau nicht mehr? */
export const isRetiredDuty = (id: DutyId): boolean => RETIRED_DUTY.has(id);

/** Gibt es diese Blockart nach dem Umbau nicht mehr? */
export const isRetiredKind = (kind: string): boolean => !LIVE_KINDS.has(kind);

/** Teilt die Pflichtliste eines gespeicherten Plans in weiter geltende und entfallene Punkte. */
export function retireDuties(duty: readonly DutyId[]): { kept: DutyId[]; retired: DutyId[] } {
  const kept: DutyId[] = [];
  const retired: DutyId[] = [];
  for (const d of duty) (isRetiredDuty(d) ? retired : kept).push(d);
  return { kept, retired };
}

const VIEW = new WeakMap<StoredPlan, StoredPlan>();

/**
 * Ansicht eines gespeicherten Plans ohne entfallene Blöcke und Pflichtpunkte. Pläne der Tageseinheit (`u`)
 * werden Block für Block gekürzt (Blockart und Pflichtpunkt stehen an derselben Stelle); ältere Pläne ohne `u`
 * verlieren nur entfallene Pflichtpunkte. Dieselbe Eingabe liefert dasselbe Objekt (stabile Referenz für
 * Stores und `useMemo`); ist nichts zu kürzen, kommt der Plan selbst zurück.
 */
export function forFocus(plan: StoredPlan): StoredPlan {
  const hit = VIEW.get(plan);
  if (hit) return hit;
  const u = plan.u;
  let view = plan;
  if (u && u.b.length === plan.duty.length) {
    const keep = u.b.map(([, kind], k) => !isRetiredKind(kind) && !isRetiredDuty(plan.duty[k] as DutyId));
    if (keep.some((x) => !x)) {
      const b = u.b.filter((_, k) => keep[k]);
      view = { ...plan, duty: plan.duty.filter((_, k) => keep[k]), u: { ...u, b, min: b.reduce((s, x) => s + x[2], 0) } };
    }
  } else {
    const { kept, retired } = retireDuties(plan.duty);
    if (retired.length) view = { ...plan, duty: kept };
  }
  VIEW.set(plan, view);
  return view;
}
