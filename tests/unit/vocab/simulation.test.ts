import { describe, expect, it } from 'vitest';
import adapter from '../../../scripts/vocab/adapter-v1';
import { runScenario, SCENARIOS } from '../../../scripts/vocab/sim-core';

// Abnahme V1 (plan.md §1, Messweg 1) im schnellen Tor (G0): Szenarien A und B, ein Startwert, 60 Tage. Die volle Messung mit 5 Startwerten
// und allen Szenarien läuft mit `node scripts/vocab/simulate.mjs --adapter v1` (Ergebnis im Bericht V1).

const sc = (k: string) => SCENARIOS.find((s) => s.key === k)!;

describe('Simulation des neuen Planers (Kurzlauf)', () => {
  const a = runScenario(adapter, sc('A'), 60, 20261031).summary;
  const b = runScenario(adapter, sc('B'), 60, 20261031).summary;
  it('kein Lexem mehr als einmal am Tag durch den Planer außerhalb der Lernschritte', () => {
    expect(a.multiNoStep).toBe(0);
    expect(b.multiNoStep).toBe(0);
  });
  it('an jedem Lerntag ≥ 2 neue; Auswahl außerhalb der Lernschritte 0 %', () => {
    expect(a.newDaysBelow2).toBe(0);
    expect(b.newDaysBelow2).toBe(0);
    expect(b.choiceOutsideSteps).toBe(0);
  });
  it('Last gleichmäßig: Vorschau in Minuten ≤ 1,5; Pflicht nach dem Einlaufen VK ≤ 0,15; nach Extra-Runde nicht länger als im Mittel', () => {
    expect(a.forecastPeakMin).toBeLessThanOrEqual(1.5);
    expect(b.forecastPeakMin).toBeLessThanOrEqual(1.5);
    expect(a.cvDutySteady).toBeLessThanOrEqual(0.15);
    expect(b.cvDutySteady).toBeLessThanOrEqual(0.15);
    expect(b.dutyAfterExtra).toBeLessThanOrEqual(b.dutyMean + 0.5);
  });
  it('Anwenden an jedem Lerntag, sobald es Lexeme ab Stufe 4 gibt; nichts bleibt unbegrenzt liegen', () => {
    expect(a.transferDays).toBe(100);
    expect(a.overdueEnd).toBeLessThanOrEqual(3);
  });
  it('deterministisch: gleicher Startwert → gleiches Ergebnis', () => {
    expect(runScenario(adapter, sc('A'), 20, 7).summary).toEqual(runScenario(adapter, sc('A'), 20, 7).summary);
  });
});
