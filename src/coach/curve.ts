import type { CheckRec, Placement } from './types';

// Fortschrittskurve: gemessener Wortschatz (Einstufung, dann jeder Monats-Check).

export type CurvePoint = { at: number; size: number; level: string; label: string };

export function curvePoints(placement: Placement | undefined, checks: Readonly<Record<string, CheckRec>>): CurvePoint[] {
  const pts: CurvePoint[] = [];
  if (placement) pts.push({ at: placement.at, size: placement.size, level: placement.level, label: 'start' });
  for (const [month, c] of Object.entries(checks).sort((a, b) => a[0].localeCompare(b[0]))) pts.push({ at: c.at, size: c.size, level: c.level, label: month });
  return pts.sort((a, b) => a.at - b.at);
}

/** Ist ein Check in diesem Monat fällig? Erst nach 20 Tagen seit der letzten Messung. */
export function checkDue(placement: Placement | undefined, checks: Readonly<Record<string, CheckRec>>, nowMs: number, month: string): boolean {
  if (!placement || checks[month]) return false;
  const last = Math.max(placement.at, ...Object.values(checks).map((c) => c.at));
  return nowMs - last >= 20 * 86_400_000;
}
