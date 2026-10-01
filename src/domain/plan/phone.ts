import type { StoredPlan } from './types';

// Handy-Ansicht des Tagesplans (Emrahs Wunsch 01.10.2026): Am Handy gehört die Aufgabe des Tages
// (Block 3: Sag es, Flüssigkeit, Generalprobe, Rollenspiel, Tonlagen, Posteingang-Antwort, Einwand-
// Training – Sprechen und längeres Schreiben, am Laptop besser) nicht zur Pflicht. Ausgenommen ist der
// Wochen-Check (Sonntag), der am Handy gut geht.
//
// Der gespeicherte Plan bleibt unberührt (`app/profile.plan` gilt für alle Geräte, erster Schreiber
// gewinnt, Kap. 15: nie neu gewürfelt). Die Handy-Ansicht ist eine abgeleitete Kopie im Speicher, die
// Zähler („x von n“), Zeilen, Knopf UND die Pflicht-Prüfung (`pflichtFor`) gemeinsam lesen – sonst würde
// `pflicht[tag]` am Handy nie gesetzt und die Serie risse. Rein, ohne Geräteerkennung.

/** Gehört dieser Block am Handy nicht zur Pflicht? */
export const phoneHides = (block: number, kind: string): boolean => block === 3 && kind !== 'task.check';

const RAW = new WeakMap<StoredPlan, StoredPlan>();
const VIEW = new WeakMap<StoredPlan, StoredPlan>();

/** Der gespeicherte Plan, aus dem eine Handy-Ansicht abgeleitet wurde (sonst der Plan selbst). */
export const rawPlan = (p: StoredPlan): StoredPlan => RAW.get(p) ?? p;

/** Ist `p` eine Handy-Ansicht, in der etwas ausgeblendet wurde? */
export const isPhoneView = (p: StoredPlan | null | undefined): boolean => !!p && RAW.has(p);

/**
 * Handy-Ansicht eines Plans der Tageseinheit. Pläne ohne `u` (Phase 1/2) und Pläne, in denen nichts
 * auszublenden ist, kommen unverändert zurück. Dieselbe Eingabe liefert dasselbe Objekt (stabile
 * Referenz für Stores und `useMemo`).
 */
export function forPhone(plan: StoredPlan): StoredPlan {
  const u = plan.u;
  if (!u || u.b.length !== plan.duty.length) return plan;
  const hit = VIEW.get(plan);
  if (hit) return hit;
  const keep = u.b.map(([block, kind]) => !phoneHides(block, kind));
  if (keep.every(Boolean)) {
    VIEW.set(plan, plan);
    return plan;
  }
  const b = u.b.filter((_, k) => keep[k]);
  const view: StoredPlan = { ...plan, duty: plan.duty.filter((_, k) => keep[k]), u: { ...u, b, min: b.reduce((s, x) => s + x[2], 0) } };
  RAW.set(view, plan);
  VIEW.set(plan, view);
  return view;
}

/** Die am Handy ausgeblendeten Pflichtpunkte (leer, wenn `plan` keine Handy-Ansicht ist). */
export function hiddenDuties(plan: StoredPlan): StoredPlan['duty'] {
  const raw = rawPlan(plan);
  if (raw === plan) return [];
  return raw.duty.filter((d) => !plan.duty.includes(d));
}
