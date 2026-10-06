import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pflichtFor } from '../../src/domain/plan/pflicht';
import { viewPlan } from '../../src/features/today/device';
import { buildUnitStored, unitPlanOf } from '../../src/domain/unit/plan';
import type { StoredPlan } from '../../src/domain/plan/types';

// Gleicher Plan, andere Eingabe (Lernplattform 2.0 Leitsatz 3, §8 Regel 6): Tagesplan, Pflicht, „x von 4“ und `pflicht[tag]` hängen nie vom Gerät ab.

const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };

/** Eine Browser-Umgebung mit Touch + kurzer Seite (Handy) bzw. feinem Zeiger (Laptop). */
function device(kind: 'phone' | 'laptop'): void {
  const coarse = kind === 'phone';
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: /pointer:\s*coarse|hover:\s*none/.test(q) ? coarse : /pointer:\s*fine|hover:\s*hover/.test(q) ? !coarse : false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal('innerWidth', coarse ? 390 : 1440);
}

afterEach(() => vi.unstubAllGlobals());

describe('Gerät und Eingabeprofil wirken nie auf Plan, Pflicht und Serie', () => {
  for (const rv of [1, 2] as const) {
    it(`Plan, Ansicht, Block-Liste und Pflicht sind auf Handy und Laptop gleich (rv ${rv})`, () => {
      const out: Array<{ plan: StoredPlan; view: StoredPlan | null; blocks: unknown; pflicht: boolean }> = [];
      for (const kind of ['phone', 'laptop'] as const) {
        device(kind);
        const plan = buildUnitStored({ day: '2026-10-05', nowMs: NOW, week: null, goalMin: 25, review, fixDue: 8, rv });
        const up = unitPlanOf(plan as StoredPlan & { u: NonNullable<StoredPlan['u']> });
        const profile = { days: { '2026-10-05': 5 }, act: { '2026-10-05': Object.fromEntries(plan.duty.filter((d) => d.startsWith('ch:u-')).map((d) => [d.slice(3), 1])) } };
        const pflicht = pflichtFor({ day: '2026-10-05', plan, profile, reviewDone: true, exhausted: false, course: undefined, pendingLessonDay: false, pendingChannelDone: false, batchActivity: false });
        out.push({ plan, view: viewPlan(plan), blocks: up.blocks.map((b) => [b.block, b.kind, b.min, b.channel, b.args ?? null]), pflicht });
      }
      expect(out[0]).toEqual(out[1]);
      expect(out[0]!.plan.duty).toHaveLength(4);
      expect(out[0]!.pflicht).toBe(true);
    });
  }

  it('die Planungsdateien lesen weder das Eingabeprofil noch Gerätemerkmale', () => {
    const files = ['src/domain/plan/buildPlan.ts', 'src/domain/plan/unitMeta.ts', 'src/domain/plan/pflicht.ts', 'src/domain/unit/plan.ts', 'src/domain/unit/planFor.ts', 'src/features/today/store.ts', 'src/features/today/state.ts', 'src/features/today/device.ts'];
    for (const f of files) {
      const text = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      expect(text, f).not.toMatch(/platform\/input|platform\/device|matchMedia|maxTouchPoints|innerWidth|userAgent/);
    }
  });
});
