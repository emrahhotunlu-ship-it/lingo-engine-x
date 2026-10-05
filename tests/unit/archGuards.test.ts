import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Architektur-Wächter (Gesamtkonzept Kap. 6, eine Quelle je Zahl): Außerhalb von `src/domain/metrics` (und der Umstellung der alten App)
// darf niemand `buildTrainCards` oder `computeStreak` direkt aus ihren Ursprungsdateien holen, und niemand rechnet „fällig“ oder „Fest“
// selbst. Dieselben Regeln prüft ESLint (`no-restricted-imports`); dieser Test hält sie auch ohne Lint fest.

const ROOT = join(import.meta.dirname, '../../src');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const all = files(ROOT).map((p) => ({ rel: relative(ROOT, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }));
const outside = all.filter((f) => !f.rel.startsWith('domain/metrics/') && !f.rel.startsWith('domain/migration/'));

describe('Architektur: eine Quelle je Zahl', () => {
  it('buildTrainCards wird nur über domain/metrics importiert', () => {
    const bad = outside.filter((f) => /import\s*(type\s*)?\{[^}]*\bbuildTrainCards\b[^}]*\}\s*from\s*'[^']*srs\/cards'/.test(f.text) && f.rel !== 'domain/srs/cards.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('computeStreak wird nur über domain/metrics aufgerufen (Umstellung ausgenommen)', () => {
    const bad = outside.filter((f) => /\bcomputeStreak\s*\(|\{[^}]*\bcomputeStreak\b[^}]*\}\s*from/.test(f.text) && f.rel !== 'domain/streak.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('„fällig“ und „überfällig“ gegen die Lerntagsgrenze rechnet nur domain/metrics (Karten-Ebene)', () => {
    const bad = outside.filter((f) => /\.fsrs\.due\s*<\s*(learningDay(End|Start)|end\b|start\b)/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('„Fest“ (Stufe und 21 Tage) steht nur in domain/metrics', () => {
    const bad = outside.filter((f) => /stability\s*>=\s*(21|MATURE_DAYS|FEST_DAYS)/.test(f.text) && f.rel !== 'domain/srs/confidence.ts').map((f) => f.rel);
    expect(bad).toEqual([]);
  });
});
