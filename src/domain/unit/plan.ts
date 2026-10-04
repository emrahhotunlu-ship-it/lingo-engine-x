import { isoWeek } from '../date';
import { unitPlanFor } from '../week';
import type { UnitBlock, UnitBlockKind, UnitChannel, UnitPlan, UnitPrefs, WeekDoc } from '../week/types';
import type { DutyId, StoredPlan, UnitMeta } from '../plan/types';

// Tageseinheit als gespeicherter Tagesplan (plan.md §1.5, N10/N12; Prüfung M2, M5). Rein.
// - Der Plan entsteht EINMAL je Lerntag aus Wochentag und Tagesziel (nie aus `env`)
//   und wird als `app/profile.plan` gespeichert: `duty` = `plan.duty` der Einheit (`review`, `ch:u-*`),
//   `goal.review` = Umfang von Block 1, `u` = eingefrorene Eckdaten (Blöcke, Minuten, Thema).
// - „x von n“ kommt immer aus `duty.length` (M2); `pflichtFor` bleibt unverändert.

/** `sec` = geplante Sekunden von Block 1, `overdue` = überfällige Karten beim Planen (nur zur Anzeige, nicht gespeichert). */
export type ReviewGoal = { goal: number; due: number; fresh: number; repairs: number; sec?: number; overdue?: number };

export type UnitBuildInput = {
  day: string;
  nowMs: number;
  week: WeekDoc | null | undefined;
  goalMin: number;
  /** Umfang von Block 1 (mit dem Budget aus `unitPlanFor(...).reviewSec` berechnet). */
  review: ReviewGoal;
};

/** Plan-Vorstufe ohne Block-1-Umfang: liefert das Budget für die Berechnung von `goal.review`. */
export function unitDraft(i: Omit<UnitBuildInput, 'nowMs' | 'review'>): UnitPlan {
  return unitPlanFor(i.day, i.week, prefsOf(i));
}

function prefsOf(i: { goalMin: number }, reviewCount?: number, reviewMin?: number): UnitPrefs {
  const p: UnitPrefs = { goalMin: i.goalMin };
  if (reviewCount !== undefined) p.reviewCount = reviewCount;
  if (reviewMin !== undefined && reviewMin > 0) p.reviewMin = reviewMin;
  return p;
}

function metaOf(up: UnitPlan): UnitMeta {
  return { v: 1, shape: up.shape, goalMin: up.goalMin, theme: up.theme, min: up.minutes, b: up.blocks.map((b) => [b.block, b.kind, b.min]) };
}

/** Der gespeicherte Tagesplan der Einheit (fester Schlüsselsatz, weil `update` verschmilzt). */
export function buildUnitStored(i: UnitBuildInput): StoredPlan {
  const up = unitPlanFor(i.day, i.week, prefsOf(i, i.review.goal, i.review.sec !== undefined ? Math.ceil(i.review.sec / 60) : undefined));
  const hasReview = up.duty.includes('review');
  return {
    d: i.day,
    ids: [],
    why: [],
    v: 1,
    duty: [...up.duty] as DutyId[],
    goal: hasReview ? { review: i.review.goal, due: i.review.due, new: i.review.fresh, ahead: 0 } : { review: 0, due: 0, new: 0, ahead: 0 },
    lesson: null,
    at: i.nowMs,
    u: metaOf(up),
  };
}

/** Ist das ein Plan der Tageseinheit? */
export const isUnitPlan = (p: StoredPlan | null | undefined): p is StoredPlan & { u: UnitMeta } => !!p?.u;

/**
 * Die Einheit eines gespeicherten Plans mit dem aktuellen Wochenthema: Blockarten, Minuten und
 * `duty` stammen aus dem eingefrorenen Plan; Thema und Block-Optionen (Frage A, Szene …) aus der
 * aktuellen Woche. Weicht die Neuberechnung ab (z. B. ein älterer Plan mit Preply-Rollen, `u.pp`), gilt der
 * eingefrorene Plan mit schlichten Blöcken – nie neu gewürfelt (Kap. 15).
 */
export function unitPlanOf(view: StoredPlan & { u: UnitMeta }, week: WeekDoc | null | undefined): UnitPlan {
  // `view` ist die Ansicht des Umbaus (`domain/plan/retire`): entfallene Blöcke sind schon herausgekürzt.
  return storedUnitPlan(view, week);
}

function storedUnitPlan(p: StoredPlan & { u: UnitMeta }, week: WeekDoc | null | undefined): UnitPlan {
  // Die Minuten von Block 1 stammen aus dem eingefrorenen Plan (bei Rückstand länger als der Grundwert).
  const storedReviewMin = p.u.b.find(([, kind]) => kind === 'review')?.[2];
  const live = unitPlanFor(p.d, week, prefsOf({ goalMin: p.u.goalMin }, p.goal.review, storedReviewMin));
  const same = live.duty.length === p.duty.length && live.duty.every((d, k) => d === p.duty[k]) && live.blocks.every((b, k) => b.kind === p.u.b[k]?.[1]);
  if (same) return live;
  const blocks: UnitBlock[] = p.u.b.map(([block, kind, min], k) => ({
    block,
    kind: kind as UnitBlockKind,
    steps: [kind as UnitBlockKind],
    opts: {},
    min,
    channel: (p.duty[k] ?? 'review') as UnitChannel,
  }));
  return { ...live, blocks, duty: p.duty as UnitChannel[], minutes: p.u.min, shape: live.shape };
}

/** Kanal-Schlüssel in `act[tag]` für einen Pflichtpunkt der Einheit (`ch:u-in` → `u-in`). */
export const unitActKey = (duty: string): string | null => (duty.startsWith('ch:u-') ? duty.slice(3) : null);

/**
 * Profil-Patch „Block erledigt“ (für `recordProfileFields`): setzt `act[tag][key] = 1`, nur wenn noch
 * nicht gezählt (idempotent wie alle Feld-Patches – ein wiederholter Schreibversuch zählt nie doppelt).
 * `pflichtFor` erkennt den Block über `act[ch] ≥ 1`.
 */
export function unitDonePatch(cur: Readonly<Record<string, unknown>>, day: string, key: string): Record<string, unknown> | null {
  const act = cur.act && typeof cur.act === 'object' && !Array.isArray(cur.act) ? (cur.act as Record<string, unknown>) : {};
  const dayAct = act[day] && typeof act[day] === 'object' && !Array.isArray(act[day]) ? (act[day] as Record<string, unknown>) : {};
  const n = dayAct[key];
  if (typeof n === 'number' && n >= 1) return null;
  // Die übrigen `u-*` desselben Tages mitschreiben (zusätzliche Absicherung): `sendFields` führt die
  // Feld-Patches eines Stapels tief zusammen, `update` verschmilzt verschachtelte Objekte (db.d.ts) –
  // so geht kein zweiter Block im selben Stapel verloren. Andere Zähler bleiben unberührt.
  const units: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dayAct)) if (k.startsWith('u-') && typeof v === 'number') units[k] = v;
  return { act: { [day]: { ...units, [key]: 1 } } };
}

// ------------------------------------------------------------------ Aufgabe des Tages am Laptop (Wochenbilanz)

/** Ziel je Woche: Aufgaben des Tages (Sprechen, längeres Schreiben), die am Laptop erledigt wurden. */
export const LAP_GOAL = 2;

/**
 * Profil-Patch „Aufgabe des Tages am Laptop erledigt“: `lap[tag] = 1` (idempotent). Eigenes Feld, damit die
 * Wochenbilanz auch dann stimmt, wenn dieselbe Pflicht an anderen Tagen am Handy als kurze Übung zählt.
 */
export function lapPatch(cur: Readonly<Record<string, unknown>>, day: string): Record<string, unknown> | null {
  const lap = cur.lap && typeof cur.lap === 'object' && !Array.isArray(cur.lap) ? (cur.lap as Record<string, unknown>) : {};
  if (lap[day] === 1) return null;
  return { lap: { [day]: 1 } };
}

/** Wie viele Laptop-Aufgaben stehen diese Woche (Mo–So, bis heute) im Profil? */
export function lapThisWeek(profile: Readonly<Record<string, unknown>> | null | undefined, today: string): number {
  const lap = profile?.lap;
  if (!lap || typeof lap !== 'object' || Array.isArray(lap)) return 0;
  const wk = isoWeek(today);
  return Object.entries(lap as Record<string, unknown>).filter(([k, v]) => v === 1 && k <= today && isoWeek(k) === wk).length;
}
