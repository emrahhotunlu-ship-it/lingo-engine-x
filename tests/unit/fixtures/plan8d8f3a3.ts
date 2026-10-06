// Kopie des Plan-Lesers der LIVE-Version 67 (Commit 8d8f3a3: `readUnitMeta` aus domain/plan/unitMeta.ts, `readPlan` aus domain/plan/buildPlan.ts,
// `isUnitPlan` aus domain/unit/plan.ts). Wörtlich, nur Typen und Importe lokal. NICHT anpassen: Der Rückweg-Test (planRollback.test.ts) zeigt damit,
// dass jeder Plan, den neuer Code schreibt, vom alten Leser vollständig gelesen wird (Lernplattform 2.0 §2.3, Rückweg).

type Obj = Readonly<Record<string, unknown>>;
type OldBlock = [block: 1 | 2 | 3 | 4 | 5, kind: string, min: number];
export type OldUnitMeta = { v: 1; shape: string; goalMin: number; theme: string; min: number; b: OldBlock[]; pp?: string[]; cb?: 'reduced' | 'restart'; ov?: number; sure?: number };
export type OldPlan = { d: string; ids: string[]; why: unknown[][]; v: 1; duty: string[]; goal: { review: number; due?: number; new?: number; ahead?: number; ch?: number }; lesson: string | null; at: number; u?: OldUnitMeta };

const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const BLOCKS = new Set([1, 2, 3, 4, 5]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function readUnitMeta8d8f3a3(v: unknown): OldUnitMeta | null {
  const o = obj(v);
  if (!o || o.v !== 1 || !Array.isArray(o.b)) return null;
  const goalMin = num(o.goalMin);
  const min = num(o.min);
  if (goalMin === null || min === null || typeof o.shape !== 'string') return null;
  const b: OldBlock[] = [];
  for (const x of o.b) {
    if (!Array.isArray(x) || x.length < 3) return null;
    const [n, kind, m] = x as unknown[];
    if (typeof n !== 'number' || !BLOCKS.has(n) || typeof kind !== 'string' || num(m) === null) return null;
    b.push([n as OldBlock[0], kind, m as number]);
  }
  const out: OldUnitMeta = { v: 1, shape: o.shape, goalMin, theme: typeof o.theme === 'string' ? o.theme : '', min, b };
  if (Array.isArray(o.pp)) {
    const pp = o.pp.filter((d): d is string => typeof d === 'string' && DAY_RE.test(d)).slice(0, 8);
    if (pp.length) out.pp = pp;
  }
  if (o.cb === 'reduced' || o.cb === 'restart') out.cb = o.cb;
  const ov = num(o.ov);
  if (ov !== null) out.ov = Math.round(ov);
  const sure = num(o.sure);
  if (sure !== null) out.sure = Math.round(sure);
  return out;
}

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const nonNeg = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined);

/** Gespeicherten Plan lesen; `null`, wenn er nicht von diesem Tag oder nicht von dieser App ist. */
export function readPlan8d8f3a3(v: unknown, today: string): OldPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Obj;
  if (p.d !== today || p.v !== 1) return null;
  const goal = p.goal && typeof p.goal === 'object' ? (p.goal as Obj) : {};
  const g: OldPlan['goal'] = { review: nonNeg(goal.review) ?? 0 };
  for (const k of ['due', 'new', 'ahead', 'ch'] as const) {
    const x = nonNeg(goal[k]);
    if (x !== undefined) g[k] = x;
  }
  const out: OldPlan = {
    d: today,
    ids: isStrArr(p.ids) ? p.ids : [],
    why: Array.isArray(p.why) ? (p.why as unknown[][]) : [],
    v: 1,
    duty: isStrArr(p.duty) ? p.duty : [],
    goal: g,
    lesson: typeof p.lesson === 'string' ? p.lesson : null,
    at: typeof p.at === 'number' ? p.at : 0,
  };
  const u = readUnitMeta8d8f3a3(p.u);
  if (u) out.u = u;
  return out;
}

/** `isUnitPlan` des alten Stands: ein Plan der Tageseinheit hat `u`. */
export const isUnitPlan8d8f3a3 = (p: OldPlan | null | undefined): boolean => !!p?.u;
