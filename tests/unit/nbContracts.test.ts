import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { weekFor } from '../../src/app/useWeek';
import { schemaForPath } from '../../src/data/paths';
import { topFixes, topUpgrades, type Fix } from '../../src/ui/feedback/types';
import { TEMPLATES } from '../../src/prompts/registry';
import { NB_TEMPLATES } from '../../src/prompts/nb';

// Neubau-Verträge aus WP0a (docs/neubau/plan.md §4.10): Rückmeldung, Wochenziele, neue Dokumente,
// Prompt-Verdrahtung.

const fix = (kind: Fix['kind'], n: number): Fix => ({ kind, mine: `m${n}`, right: `r${n}`, why: `w${n}` });

describe('FeedbackPanel-Vertrag', () => {
  it('sortiert Bedeutung → Falle → Ziel → Form und kappt auf 3; Verbesserungen auf 2', () => {
    const out = topFixes([fix('form', 1), fix('goal', 2), fix('meaning', 3), fix('trap', 4)]);
    expect(out.map((f) => f.kind)).toEqual(['meaning', 'trap', 'goal']);
    expect(topUpgrades([{ to: 'a' }, { to: 'b' }, { to: 'c' }])).toHaveLength(2);
    expect(topUpgrades(undefined)).toEqual([]);
  });
});

describe('useWeek (liest app/week, rechnet mit domain/week)', () => {
  it('ohne Dokument: Thema-Vorschlag, Ziele und Plan des Lerntags; nie leer', () => {
    const w = weekFor('2026-09-21', null);
    expect(w.theme?.id).toMatch(/^t\d\d$/);
    expect(w.plan?.day).toBe('2026-09-21');
    expect(w.plan?.blocks.length).toBeGreaterThan(0);
    expect(w.targets.traps.length).toBeLessThanOrEqual(3);
  });

  it('gespeichertes Thema der Woche gilt; kaputte Felder werden toleriert', () => {
    const w = weekFor('2026-09-20', { v: 1, cur: { wk: '2026-W38', theme: 't02', by: 'user', at: 1 }, hist: 'kaputt' });
    expect(w.theme?.id).toBe('t02');
    expect(w.plan?.theme).toBe('t02');
  });
});

describe('Neue Dokumente (tolerant, Seed-Beispiel)', () => {
  const seed = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, unknown>;
  for (const path of ['app/decks', 'app/week', 'out/2026-09']) {
    it(`${path}: Schema vorhanden, Seed-Beispiel gültig, unbekannte Felder bleiben`, () => {
      const schema = schemaForPath(path);
      expect(schema).not.toBeNull();
      expect(seed[path]).toBeTruthy();
      const r = schema?.safeParse({ ...(seed[path] as object), zukunft: 1 });
      expect(r?.success).toBe(true);
      expect((r?.data as Record<string, unknown>).zukunft).toBe(1);
    });
  }
});

describe('Prompt-Verdrahtung', () => {
  it('neue Vorlagen der Pakete stehen im Register', () => {
    for (const t of NB_TEMPLATES) expect(TEMPLATES).toContain(t);
  });
});
