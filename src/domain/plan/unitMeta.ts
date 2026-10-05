import type { UnitMeta, UnitMetaBlock } from './types';

// Neubau (plan.md §1.5, P1): tolerantes Lesen der eingefrorenen Eckdaten der Tageseinheit
// (`app/profile.plan.u`). Fehlerhafte Einträge fallen weg, nichts wird erfunden.

type Obj = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const BLOCKS = new Set([1, 2, 3, 4, 5]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function readUnitMeta(v: unknown): UnitMeta | null {
  const o = obj(v);
  if (!o || o.v !== 1 || !Array.isArray(o.b)) return null;
  const goalMin = num(o.goalMin);
  const min = num(o.min);
  if (goalMin === null || min === null || typeof o.shape !== 'string') return null;
  const b: UnitMetaBlock[] = [];
  for (const x of o.b) {
    if (!Array.isArray(x) || x.length < 3) return null;
    const [n, kind, m] = x as unknown[];
    if (typeof n !== 'number' || !BLOCKS.has(n) || typeof kind !== 'string' || num(m) === null) return null;
    b.push([n as UnitMetaBlock[0], kind, m as number]);
  }
  const out: UnitMeta = { v: 1, shape: o.shape, goalMin, theme: typeof o.theme === 'string' ? o.theme : '', min, b };
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
