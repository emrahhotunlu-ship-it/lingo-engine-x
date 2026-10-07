// Kopie des Plan-Lesers von Lernplattform 2.0 (vor P23): `readUnitMeta` aus domain/plan/unitMeta.ts, wörtlich, nur umbenannt. NICHT anpassen.
// Der Rückweg-Test (planRollbackV3.test.ts) zeigt damit, dass jeder Plan 3.0 vom LP2-Leser vollständig gelesen wird.
import type { GrammarDay, PatState, StepArgs, UnitMeta, UnitMetaBlock } from '../../../src/domain/plan/types';

// Neubau (plan.md §1.5, P1): tolerantes Lesen der eingefrorenen Eckdaten der Tageseinheit
// (`app/profile.plan.u`). Fehlerhafte Einträge fallen weg, nichts wird erfunden.

type Obj = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const BLOCKS = new Set([1, 2, 3, 4, 5]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const ARG_KEYS = ['errs', 'repairs', 'limit'] as const;

/** Schritt-Argumente (4. Tupel-Element): nur ganze Zahlen ≥ 0 unter 100; Unbekanntes oder Fehlerhaftes fällt weg. */
function readArgs(v: unknown): StepArgs | null {
  const o = obj(v);
  if (!o) return null;
  const out: StepArgs = {};
  for (const k of ARG_KEYS) {
    const n = num(o[k]);
    if (n !== null && n < 100) out[k] = Math.round(n);
  }
  return Object.keys(out).length ? out : null;
}

const strList = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 80) ? (v as string[]) : null;

function readGt(v: unknown): GrammarDay | null {
  const o = obj(v);
  if (!o) return null;
  const pats = strList(o.pats, 2);
  const topics = strList(o.topics, 3);
  if (!pats || !topics || !(o.intro === null || typeof o.intro === 'string')) return null;
  return { intro: o.intro, pats, topics };
}

function readPs(v: unknown): Record<string, PatState> | null {
  const o = obj(v);
  if (!o) return null;
  const out: Record<string, PatState> = {};
  for (const [k, x] of Object.entries(o)) {
    if ((x === 0 || x === 1 || x === 2 || x === 3) && k.length <= 80) out[k] = x;
    if (Object.keys(out).length >= 24) break;
  }
  return Object.keys(out).length ? out : null;
}

export function readUnitMetaLp2(v: unknown): UnitMeta | null {
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
    const args = readArgs((x as unknown[])[3]);
    b.push(args ? [n as UnitMetaBlock[0], kind, m as number, args] : [n as UnitMetaBlock[0], kind, m as number]);
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
  // Lernplattform 2.0 (§2.3), alles rein ergänzend: Regelversion, eingefrorenes Grammatikthema, Musterzustände vom Morgen.
  if (o.rv === 2) out.rv = 2;
  const gt = readGt(o.gt);
  if (gt) out.gt = gt;
  const ps = readPs(o.ps);
  if (ps) out.ps = ps;
  return out;
}
