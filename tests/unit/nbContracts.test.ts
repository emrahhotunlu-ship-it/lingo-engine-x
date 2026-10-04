import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
