import type { VtestResult } from './score';

// Ergebnis in `app/profile` (Plan §8.3): an `vtests[]` anhängen (≤ 20, Kennung `v:'lx1'`), dazu
// `act[tag].vtest` und die Minuten des Tages. Doppelt ausgeführt wirkt es wie einmal (Abgleich
// über `t`). Der Test ist freiwillig – nie Pflicht, zählt nicht für die Serie.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const VTESTS_MAX = 20;

export function vtestPatch(cur: Doc, r: VtestResult, day: string): Record<string, unknown> | null {
  const list = Array.isArray(cur.vtests) ? (cur.vtests as unknown[]) : [];
  if (list.some((v) => obj(v).t === r.t)) return null;
  const dayAct = obj(obj(cur.act)[day]);
  return {
    vtests: [...list, { ...r, v: 'lx1' }].slice(-VTESTS_MAX),
    act: { [day]: { vtest: num(dayAct.vtest) + 1 } },
    minutes: { [day]: num(obj(cur.minutes)[day]) + Math.round(r.dur / 60_000) },
  };
}
