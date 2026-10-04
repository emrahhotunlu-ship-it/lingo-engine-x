import { dowOf } from '../week/plan';
import type { UnitBlock, UnitBlockKind, UnitPlan } from '../week/types';
import type { StoredPlan } from './types';

// Handy-Ansicht des Tagesplans (Emrahs Wunsch 01.10./02.10.2026): Am Handy geht die Aufgabe des Tages
// (Block 3: Sag es, Flüssigkeit, Generalprobe, Rollenspiel, Tonlagen, Posteingang-Antwort, Einwand-
// Training – Sprechen und längeres Schreiben, am Laptop besser) nicht verloren, sondern wird durch eine
// kurze Übung ersetzt, die mit dem Daumen geht: Montag bis Mittwoch Kollokationen des Wochenthemas
// (3 Stück, selbst tippen), Donnerstag bis Samstag Einwand-Training mit 3 kurzen Antworten.
// Ausgenommen ist der Wochen-Check (Sonntag), der am Handy gut geht.
//
// Der gespeicherte Plan bleibt unberührt (`app/profile.plan` gilt für alle Geräte, erster Schreiber
// gewinnt, Kap. 15: nie neu gewürfelt). Die Handy-Ansicht ist eine abgeleitete Kopie im Speicher, die
// Zähler („x von n“), Zeilen, Knopf UND die Pflicht-Prüfung (`pflichtFor`) gemeinsam lesen. `duty` bleibt
// gleich lang (derselbe Pflichtpunkt `ch:u-task`), nur Art und Minuten des Blocks 3 ändern sich. Rein,
// ohne Geräteerkennung.

/** Minuten der Handy-Übung (Deckel; kürzere Pläne behalten ihre Minuten). */
export const PHONE_TASK_MIN = 6;

/** Wird dieser Block am Handy ersetzt? */
/** Satzbau (seit 04.10.2026 Block 3) geht am Handy gut und bleibt; ersetzt werden nur alte Sprech- und Schreibaufgaben. */
export const phoneReplaces = (block: number, kind: string): boolean => block === 3 && kind !== 'task.check' && kind !== 'task.order';

/** Handy-Übung für den Wochentag (1 = Montag … 7 = Sonntag). */
export const phoneKindFor = (dow: number): UnitBlockKind => (dow <= 3 ? 'focus.colloc' : 'task.objection');

const RAW = new WeakMap<StoredPlan, StoredPlan>();
const VIEW = new WeakMap<StoredPlan, StoredPlan>();

/** Der gespeicherte Plan, aus dem eine Handy-Ansicht abgeleitet wurde (sonst der Plan selbst). */
export const rawPlan = (p: StoredPlan): StoredPlan => RAW.get(p) ?? p;

/** Ist `p` eine Handy-Ansicht, in der etwas ersetzt wurde? */
export const isPhoneView = (p: StoredPlan | null | undefined): boolean => !!p && RAW.has(p);

/**
 * Handy-Ansicht eines Plans der Tageseinheit. Pläne ohne `u` (Phase 1/2) und Pläne, in denen nichts
 * zu ersetzen ist (Sonntag), kommen unverändert zurück. Dieselbe Eingabe liefert dasselbe Objekt
 * (stabile Referenz für Stores und `useMemo`).
 */
export function forPhone(plan: StoredPlan): StoredPlan {
  const u = plan.u;
  if (!u || u.b.length !== plan.duty.length) return plan;
  const hit = VIEW.get(plan);
  if (hit) return hit;
  if (!u.b.some(([block, kind]) => phoneReplaces(block, kind))) {
    VIEW.set(plan, plan);
    return plan;
  }
  const kind = phoneKindFor(dowOf(plan.d));
  const b = u.b.map((x) => (phoneReplaces(x[0], x[1]) ? ([x[0], kind, Math.min(x[2], PHONE_TASK_MIN)] as typeof x) : x));
  const view: StoredPlan = { ...plan, u: { ...u, b, min: b.reduce((s, x) => s + x[2], 0) } };
  RAW.set(view, plan);
  VIEW.set(plan, view);
  return view;
}

/** Die ersetzte Aufgabe des Tages (Art im gespeicherten Plan), `null` ohne Handy-Ansicht. */
export function replacedKind(plan: StoredPlan | null | undefined): UnitBlockKind | null {
  if (!plan || !isPhoneView(plan)) return null;
  const hit = rawPlan(plan).u?.b.find(([block, kind]) => phoneReplaces(block, kind));
  return hit ? (hit[1] as UnitBlockKind) : null;
}

/** Block 3 des Einheit-Plans für das Handy ersetzen (Art, Schritte, Optionen, Minuten). */
export function phoneUnitPlan(up: UnitPlan): UnitPlan {
  const kind = phoneKindFor(up.dow);
  const blocks: UnitBlock[] = up.blocks.map((b) =>
    phoneReplaces(b.block, b.kind) ? { ...b, kind, steps: [kind], opts: kind === 'task.objection' ? { short: true } : {}, min: Math.min(b.min, PHONE_TASK_MIN) } : b,
  );
  return { ...up, blocks, minutes: blocks.reduce((s, b) => s + b.min, 0) };
}
