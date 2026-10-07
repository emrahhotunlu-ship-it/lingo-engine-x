import { REPAIR_MAX } from './block1';
import { fixLimitFor, GRAMMAR_N, unitPlanFor } from './planFor';
import type { ComebackMode, UnitBlock, UnitBlockKind, UnitChannel, UnitPlan, UnitPrefs } from './types';
import { ERRORS_PER_ROUND } from '../grammar/tasks';
import { AGAIN_OLD } from '../repair/unit';
import type { DutyId, GrammarDay, PatState, Step3Fmt, Step3Mode, StoredPlan, UnitMeta } from '../plan/types';

/**
 * Regelversion für NEUE Pläne (Lernplattform 2.0 §2.3). Seit dem Abschluss von Welle 2 `2` (§10.2).
 * Gespeicherte Pläne ohne `u.rv = 2` laufen nach der alten Regel zu Ende.
 */
export const PLAN_RV = 2 as 1 | 2;

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
  /** Rest des Wochenthemas, wird ignoriert (immer `null`). */
  week?: null;
  goalMin: number;
  /** Umfang von Block 1 (mit dem Budget aus `unitPlanFor(...).reviewSec` berechnet). */
  review: ReviewGoal;
  /** Fällige Fehlersätze (früherer Tage); 0 → Block 5 entfällt. Fehlt der Wert, bleibt Block 5. */
  fixDue?: number;
  /** Wiedereinstieg nach einer Pause (`domain/plan/comeback`). */
  comeback?: ComebackMode;
  /** Morgenwerte für den Abschluss: überfällige und sichere Karten beim Planen. */
  ov?: number;
  sure?: number;
  /** Regelversion dieses Plans (Standard `PLAN_RV`). */
  rv?: 1 | 2;
  /** Eingefroren beim Anlegen (§2.3), unabhängig von `rv`: Grammatikthema des Tages und Musterzustände vom Morgen. */
  gt?: GrammarDay;
  ps?: Record<string, PatState>;
  /** Plan 3.0 (P23, §2.1/§2.4), beim Anlegen eingefroren: Format von Schritt 3, Check-Tag, nächstes Ziel. Alles rein ergänzend. */
  step3?: { mode: Step3Mode; fmt?: Step3Fmt } | null;
  c1?: 'check';
  nx?: string;
};

/** Plan-Vorstufe ohne Block-1-Umfang: liefert das Budget für die Berechnung von `goal.review`. */
export function unitDraft(i: Omit<UnitBuildInput, 'nowMs' | 'review'>): UnitPlan {
  return unitPlanFor(i.day, i.week, prefsOf(i));
}

function prefsOf(i: { goalMin: number; fixDue?: number; comeback?: ComebackMode; rv?: 1 | 2; step3?: UnitPrefs['step3'] }, reviewCount?: number, reviewMin?: number): UnitPrefs {
  const p: UnitPrefs = { goalMin: i.goalMin };
  if (i.rv === 2) p.rv = 2;
  if (i.fixDue !== undefined) p.fixDue = i.fixDue;
  if (i.comeback) p.comeback = i.comeback;
  if (i.step3) p.step3 = i.step3;
  if (reviewCount !== undefined) p.reviewCount = reviewCount;
  if (reviewMin !== undefined && reviewMin > 0) p.reviewMin = reviewMin;
  return p;
}

function metaOf(up: UnitPlan, facts: { ov?: number; sure?: number; gt?: GrammarDay; ps?: Record<string, PatState>; c1?: 'check'; nx?: string } = {}): UnitMeta {
  const m: UnitMeta = { v: 1, shape: up.shape, goalMin: up.goalMin, theme: '', min: up.minutes, b: up.blocks.map((b) => (b.args ? [b.block, b.kind, b.min, b.args] : [b.block, b.kind, b.min])) };
  if (up.comeback) m.cb = up.comeback;
  if (facts.ov !== undefined) m.ov = facts.ov;
  if (facts.sure !== undefined) m.sure = facts.sure;
  if (up.rv === 2) m.rv = 2;
  if (facts.gt) m.gt = facts.gt;
  if (facts.ps && Object.keys(facts.ps).length) m.ps = facts.ps;
  if (facts.c1) m.c1 = facts.c1;
  if (facts.nx) m.nx = facts.nx;
  return m;
}

/** Der gespeicherte Tagesplan der Einheit (fester Schlüsselsatz, weil `update` verschmilzt). */
export function buildUnitStored(i: UnitBuildInput): StoredPlan {
  const up = unitPlanFor(i.day, i.week, prefsOf({ ...i, rv: i.rv ?? PLAN_RV }, i.review.goal, i.review.sec !== undefined ? Math.ceil(i.review.sec / 60) : undefined));
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
    u: metaOf(up, { ov: i.ov, sure: i.sure, ...(i.gt ? { gt: i.gt } : {}), ...(i.ps ? { ps: i.ps } : {}), ...(i.c1 && up.shape === 'sat' && up.rv === 2 ? { c1: i.c1 } : {}), ...(i.nx && up.rv === 2 ? { nx: i.nx } : {}) }),
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
export function unitPlanOf(view: StoredPlan & { u: UnitMeta }, week?: null): UnitPlan {
  // `view` ist die Ansicht des Umbaus (`domain/plan/retire`): entfallene Blöcke sind schon herausgekürzt.
  return storedUnitPlan(view, week);
}

function storedUnitPlan(p: StoredPlan & { u: UnitMeta }, week: null | undefined): UnitPlan {
  // Die Minuten von Block 1 stammen aus dem eingefrorenen Plan (bei Rückstand länger als der Grundwert).
  const storedReviewMin = p.u.b.find(([, kind]) => kind === 'review')?.[2];
  const rv2 = p.u.rv === 2;
  // Form des Plans aus den eingefrorenen Eckdaten: Wiedereinstieg (`cb`) und „kein Fehlersatz fällig“ (Block 5 fehlt).
  // Regelversion 2: Auch der Sonntag trägt Schritt 4 nur, wenn er gespeichert ist.
  const hasFix = p.u.b.some(([, kind]) => kind === 'again');
  const noFix = rv2 ? !hasFix : p.u.shape !== 'sun' && !hasFix;
  const fixDue = noFix ? { fixDue: 0 } : rv2 && p.u.shape === 'sun' ? { fixDue: 1 } : {};
  const live = unitPlanFor(p.d, week, prefsOf({ goalMin: p.u.goalMin, ...fixDue, ...(p.u.cb ? { comeback: p.u.cb } : {}), ...(rv2 ? { rv: 2 as const } : {}) }, p.goal.review, storedReviewMin));
  const same = live.duty.length === p.duty.length && live.duty.every((d, k) => d === p.duty[k]) && live.blocks.every((b, k) => b.kind === p.u.b[k]?.[1]);
  if (same) {
    if (!rv2) return live;
    // Regelversion 2: Argumente und Minuten stammen aus dem eingefrorenen Plan (die Grenze von Schritt 4 hing von `fixDue` beim Anlegen ab).
    const blocks = live.blocks.map((b, k): UnitBlock => {
      const [, , min, args] = p.u.b[k] ?? [];
      const out: UnitBlock = { ...b, min: min ?? b.min };
      if (args) out.args = args;
      else delete out.args;
      return out;
    });
    return { ...live, blocks, minutes: blocks.reduce((s, b) => s + b.min, 0) };
  }
  const blocks: UnitBlock[] = p.u.b.map(([block, kind, min, args], k) => ({
    block,
    kind: kind as UnitBlockKind,
    steps: [kind as UnitBlockKind],
    opts: {},
    min,
    channel: (p.duty[k] ?? 'review') as UnitChannel,
    ...(args ? { args } : {}),
  }));
  return { ...live, blocks, duty: p.duty as UnitChannel[], minutes: p.u.min, shape: live.shape };
}

/** Regelversion eines gespeicherten Plans: `2` nur mit `u.rv = 2`, sonst gilt die alte Regel. */
export const planRvOf = (plan: StoredPlan | null | undefined): 1 | 2 => (plan?.u?.rv === 2 ? 2 : 1);

/** Grammatikrunde des Plans: Zahl der Hauptaufgaben und der Fehlersätze darin (rv 2: keine; sonst `ERRORS_PER_ROUND`). */
export function unitGrammarArgs(plan: StoredPlan | null | undefined): { n: number; errs: number } {
  if (!plan?.u) return { n: GRAMMAR_N.full, errs: ERRORS_PER_ROUND };
  const stored = plan.u.b.find(([block]) => block === 2)?.[3];
  const n = unitPlanOf(plan as StoredPlan & { u: UnitMeta }, null).blocks.find((b) => b.block === 2)?.opts.n ?? GRAMMAR_N.full;
  return { n, errs: stored?.errs ?? (plan.u.rv === 2 ? 0 : ERRORS_PER_ROUND) };
}

/**
 * Argumente eines Schritts (4. Tupel-Element, sonst die alte Regel): Schritt 1 `repairs`, Grammatik `errs`, Schritt 4 `limit`.
 * Die alte Regel kennt für Schritt 4 nur die Zahl der alten Sätze (`AGAIN_OLD`).
 */
export function unitStepArgs(plan: StoredPlan | null | undefined, block: 1 | 2 | 5): { errs?: number; repairs?: number; limit?: number } {
  const stored = plan?.u?.b.find(([b]) => b === block)?.[3];
  if (stored) return { ...stored };
  if (block === 1) return { repairs: REPAIR_MAX };
  if (block === 2) return { errs: ERRORS_PER_ROUND };
  return { limit: AGAIN_OLD };
}

/** Format von Schritt 3 laut gespeichertem Plan (4. Tupel-Element von Block 3); `null` = Satzbau (Montag, ältere Pläne, Format nicht angeboten). */
export function unitStep3(plan: StoredPlan | null | undefined): { mode: Step3Mode; fmt?: Step3Fmt } | null {
  const a = plan?.u?.b.find(([block]) => block === 3)?.[3];
  if (!a?.mode) return null;
  return a.mode === 'format' && !a.fmt ? null : { mode: a.mode, ...(a.fmt ? { fmt: a.fmt } : {}) };
}

/** Grenze von Schritt 4 für einen neuen Plan der Regelversion 2 (Formel §2.3), für Tests und Anzeige. */
export const fixLimitOf = fixLimitFor;

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
