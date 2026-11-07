import { describe, expect, it } from 'vitest';
import adapter from '../../../scripts/vocab/adapter-v1';
import { runScenario, SCENARIOS } from '../../../scripts/vocab/sim-core';

// Abnahme V1/V2 (plan.md §1, Messweg 1 und 2) im schnellen Tor (G0): Szenarien A und B, ein Startwert, 60 Tage. Die volle Messung mit 5 Startwerten
// und allen Szenarien läuft mit `node scripts/vocab/simulate.mjs --adapter v1` (Ergebnis im Bericht V1).

const sc = (k: string) => SCENARIOS.find((s) => s.key === k)!;

describe('Simulation des neuen Planers (Kurzlauf)', () => {
  const a = runScenario(adapter, sc('A'), 60, 20261031).summary;
  const b = runScenario(adapter, sc('B'), 60, 20261031).summary;
  it('kein Lexem mehr als einmal am Tag durch den Planer außerhalb der Lernschritte', () => {
    expect(a.multiNoStep).toBe(0);
    expect(b.multiNoStep).toBe(0);
  });
  it('echte Behaltensrate: V2 mit Satzwechsel 80–84 % (Ziel 87–93 % offen, Bericht V2 offene_fragen 1; Modellbefund)', () => {
    // Messreihe V2 (5 Startwerte, docs/umbau/vokabeln/ausgangsmessung-v2.json): A 80,4–83,5 · B 83–83,6 · C 80,7–83,1 · D 82,1–84 %.
    // Ohne Satzbindung im Lerner (VOCAB_BIND=0): neu 82,8–85,5 %, heute 72,5–79,5 % – das Ziel verfehlen beide Planer (FSRS-Standardwerte).
    // Grund: V1 zeigte immer den Ankersatz; der simulierte Lerner bekommt dort eine Abrufhilfe von +12 Punkten (Satzbindung, V0 Befund 11).
    // V2 wechselt den Satz ab Tag 2 (M57); in neuen Sätzen fehlt die Hilfe, FSRS mit Standardwerten kennt das nicht (Anpassung erst M19).
    // Mit Ankersatz misst derselbe Planer 95 %. Die Grenze hält den gemessenen Stand, damit eine Verschlechterung auffällt.
    // Grenze = Messwert dieses Startwerts (A 83,0 · B 83,6) − 2 (learning-scientist V2 Befund 10), damit ein Rückschritt auffällt.
    expect(a.retention).toBeGreaterThanOrEqual(81);
    expect(a.retention).toBeLessThanOrEqual(93);
    expect(b.retention).toBeGreaterThanOrEqual(81.5);
  });
  it('an jedem Lerntag ≥ 2 neue; Auswahl außerhalb der Lernschritte 0 %', () => {
    expect(a.newDaysBelow2).toBe(0);
    expect(b.newDaysBelow2).toBe(0);
    expect(b.choiceOutsideSteps).toBe(0);
  });
  it('Last gleichmäßig: Pflicht nach dem Einlaufen VK ≤ 0,15; nach Extra-Runde nicht länger als im Mittel', () => {
    // Emrahs Lesart 01.11.2026: Gleichmäßigkeit ab Tag 15, die 14-Tage-Vorschau (≤ 1,5) nur beim Start mit Bestand (Szenario D, volle
    // Messung mit `simulate.mjs`); beim leeren Start wird sie hier nicht abgenommen.
    // Messreihe V2 ab Tag 15 (5 Startwerte): A 0,12–0,15 · B 0,11–0,14 · C 0,11–0,16 · D 0,05–0,08.
    expect(a.cvDutySteady).toBeLessThanOrEqual(0.15);
    expect(b.cvDutySteady).toBeLessThanOrEqual(0.15);
    expect(b.dutyAfterExtra).toBeLessThanOrEqual(b.dutyMean + 0.5);
  });
  // Emrah 07.11.2026 („Text“ A): die Schreibaufgabe mit mehreren Wörtern steht nicht mehr in der Wörter-Pflicht (sondern unter Anwenden).
  it('Wörter-Pflicht ohne Schreibaufgabe; nichts bleibt unbegrenzt liegen', () => {
    expect(a.transferDays).toBe(0);
    expect(a.overdueEnd).toBeLessThanOrEqual(3);
  });
  it('V2: ≥ 50 % aktive Abfragen ab Stufe 3, 30–40 % ohne Satz ab Stufe 4, Auswahl nur in Lernschritten (plan.md §10 V2)', () => {
    for (const x of [a, b]) {
      expect(x.activeShareStage3).toBeGreaterThanOrEqual(50);
      expect(x.noSentenceStage4).toBeGreaterThanOrEqual(30);
      expect(x.noSentenceStage4).toBeLessThanOrEqual(40);
      expect(x.choiceOutsideSteps).toBe(0);
    }
  });
  it('deterministisch: gleicher Startwert → gleiches Ergebnis', () => {
    expect(runScenario(adapter, sc('A'), 20, 7).summary).toEqual(runScenario(adapter, sc('A'), 20, 7).summary);
  });
});
