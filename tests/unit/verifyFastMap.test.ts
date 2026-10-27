import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- reines .mjs ohne Typen (scripts/)
import { RULES, SMOKE } from '../../scripts/verify-fast-map.mjs';

// Schneller Lauf (docs/umbau/arbeitsweise.md §10): Die Tabelle „Pfad → E2E-Specs“ nennt nur Specs, die es gibt.
const specs = readdirSync(new URL('../e2e/', import.meta.url)).filter((f) => f.endsWith('.spec.ts'));

describe('verify-fast-map', () => {
  it('jede genannte Spec existiert', () => {
    const named = new Set<string>([...(SMOKE as string[]), ...(RULES as Array<{ specs: string[] }>).flatMap((r) => r.specs)]);
    expect([...named].filter((s) => !specs.includes(s))).toEqual([]);
  });
  it('Rauch-Auswahl ist klein (höchstens 6 Specs)', () => {
    expect((SMOKE as string[]).length).toBeLessThanOrEqual(6);
  });
});
