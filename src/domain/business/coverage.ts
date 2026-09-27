// Präsentations-Coach (Plan §5.5): Abdeckung der Folienpunkte als Tatsache („5 von 6“).

export type CoverageItem = { point: string; covered: boolean; note: string };

export function coverageCount(points: readonly string[], coverage: readonly CoverageItem[]): { covered: number; total: number; missing: string[] } {
  const byPoint = new Map(coverage.map((c) => [c.point.trim().toLowerCase(), c]));
  let covered = 0;
  const missing: string[] = [];
  for (const p of points) {
    const c = byPoint.get(p.trim().toLowerCase());
    if (c?.covered) covered++;
    else missing.push(p);
  }
  return { covered, total: points.length, missing };
}
