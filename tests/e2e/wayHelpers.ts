import { expect, type Page } from '@playwright/test';
import { boot, openOverview, type BootOptions } from './fixtures';

// Gemeinsame Bausteine für „Weg zu C1“ (P45): Testdaten für `app/c1` und das Öffnen des Blatts mit Schalter `way`.

const check = (d: string, p: [number, number, number, number], extra: Record<string, unknown> = {}) => ({ d, f: 'A', inp: 'desk', p, pts: p[0] + p[1] + p[2] + p[3], max: 36, ...extra });

/** Drei Checks seit Juni, der letzte mit eingefrorener Prognose. */
export const C1_THREE = {
  v: 1,
  place: { d: '2026-06-01', se: 0.31, n: 24, th: 0.42, skip: [] },
  checks: [check('2026-06-27', [4, 4, 3, 5]), check('2026-07-25', [5, 4, 4, 6]), check('2026-08-29', [5, 5, 4, 7], { fc: { from: '2027-04', to: '2027-07', late: 'k4' } })],
  gates: [{ d: '2026-08-15', ch: 1, g: [17, 20], w: [8, 8], ok: true }],
  prod: [],
  bad: [],
};
export const C1_TWO = { ...C1_THREE, checks: C1_THREE.checks.slice(0, 2) };

export async function openWay(page: Page, opts: BootOptions = {}) {
  const booted = await boot(page, { migrated: true, ...opts, localStorage: { 'lx:flags': 'way', ...(opts.localStorage ?? {}) } });
  await openOverview(page);
  await page.getByTestId('way-head').click();
  const sheet = page.getByTestId('way-sheet');
  await expect(sheet).not.toHaveAttribute('data-state', 'loading');
  return { ...booted, sheet };
}

