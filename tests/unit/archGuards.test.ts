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
    const bad = outside.filter((f) => /stability\s*>=\s*(21|MATURE_DAYS|FEST_DAYS)/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });
});

// Relaunch Stufe 1 P5 S1-ZAHL (docs/relaunch/stufe1-plan.md §5.2): Anzeige-Dateien rechnen keine Zahl selbst. Dieselbe Liste wie
// `SCREEN_NUMBER_NAMES` in eslint.config.js; die Lern-Logik (GrammarItem, c1x, drills, generate) ruft `topicP` weiter direkt.
const SCREEN_NUMBER_NAMES = ['minutesLeft', 'dutyMinutes', 'dutyFills', 'newQuotaLeft', 'topicP'];
const isDisplay = (rel: string): boolean => (rel.startsWith('features/') && /Screen\.tsx$/.test(rel)) || rel.startsWith('features/progress/') || rel.startsWith('features/vocab/hub/') || rel.startsWith('ui/');

describe('Architektur: Anzeige-Zahlen nur aus domain/metrics (P5 S1-ZAHL)', () => {
  it('Bildschirme, Fortschritt, Wörter-Übersicht und Bausteine importieren keine Rechenbausteine für Anzeige-Zahlen', () => {
    const display = all.filter((f) => isDisplay(f.rel));
    expect(display.length).toBeGreaterThan(10);
    const bad = display.flatMap((f) => SCREEN_NUMBER_NAMES.filter((n) => new RegExp(`import\\s*(type\\s*)?\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from`).test(f.text)).map((n) => `${f.rel}: ${n}`));
    expect(bad).toEqual([]);
  });

  it('die Ringfüllung (höchstens 95 % offen) steht nur in domain/metrics', () => {
    const bad = outside.filter((f) => /\bdutyFills\b|Math\.min\(\s*0\.95\s*,/.test(f.text)).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('domain/metrics bietet die Quellen an, die die Anzeige nutzt', () => {
    const index = all.find((f) => f.rel === 'domain/metrics/index.ts')?.text ?? '';
    for (const n of ['todaySummary', 'ringFills', 'newQuotaToday', 'topicShown']) expect(index).toMatch(new RegExp(`\\b${n}\\b`));
  });
});
