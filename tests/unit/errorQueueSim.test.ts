import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { ERRORS_MAX } from '../../src/domain/grammar/errors';
import { dowOf } from '../../src/domain/unit/planFor';
import { CURRENT, DAYS, P2_REAL, P2_RULES, SEEDS, START, simulate } from './errorQueueSimLib';

// Schlangen-Simulation (Lernplattform 2.0 §2.3 „Durchsatz“, §10.4 P4). Die Simulation selbst steht in `errorQueueSimLib.ts`: 60 Lerntage, Boxen 1/3/9,
// echter Tagesplan (`buildUnitStored` mit rv 2, Sonntage mit Grenze 3), echte Auswahl (`dueFehlersaetze`), echte Zählung der Bremse
// (`dueErrorCount`, `canIntroduce`). Annahmen wie im Plan: 6 neue Aufgaben je Tag (Sonntag: Wochen-Check mit 5), 75 % richtig beim Wiederholen.
// Die Fehlerquote bezieht sich auf die neuen Aufgaben; die Muster fallen unterschiedlich oft (Zipf), wie in echten Daten.
// Regeln der Schlange: `CURRENT` = die echten `addError`/`reviewError` von heute; `P2_RULES` = §5.7 (ein offener Eintrag je Muster, falsch = eine Box
// zurück, Abstand der neuen Box) als dünne Hülle um die echten Funktionen. Im P4-Nachtrag ersetzt `P2_REAL` (die echten Funktionen aus P2) die Hülle.
// Abnahme laut Plan: An mindestens 80 % der Tage sind weniger als 10 Grammatikfehler fällig, und mindestens 1 neues Thema je 6 Lerntage ist möglich.

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
// `real` = die echten Funktionen von P2 (falsch = eine Box zurück, aber immer „morgen wieder“); `proposal` = dieselbe Regel mit dem Abstand der neuen Box (1/3/9 Tage).
const real = P2_REAL ?? P2_RULES;
const proposal = P2_RULES;
const shareBelow = (series: number[], n: number): number => series.filter((x) => x < n).length / series.length;

describe('Schlangen-Simulation: trägt die Fehlerschlange? (60 Lerntage, Boxen 1/3/9)', () => {
  it('Fehlerquote 30 %: mit dem Abstand der neuen Box an ≥ 80 % der Tage unter 10 fällige Grammatikfehler und ≥ 1 neues Thema je 6 Lerntage (Abnahme erfüllt)', () => {
    for (const seed of SEEDS) {
      const r = simulate(proposal, 0.3, seed);
      expect(r.lowShare, `Seed ${seed}: Anteil der Tage mit < 10 fälligen (max ${r.maxDue}, Ø ${r.avgDue.toFixed(1)})`).toBeGreaterThanOrEqual(0.8);
      expect(r.introductions, `Seed ${seed}: neue Themen in 60 Tagen`).toBeGreaterThanOrEqual(DAYS / 6);
      expect(r.dropped, `Seed ${seed}: verworfene Sätze`).toBe(0);
      expect(r.done).toBeGreaterThan(0);
      expect(Math.max(...r.limitsUsed)).toBeLessThanOrEqual(9);
      // Sonntage nach Plan: höchstens 3 Sätze.
      r.limitsUsed.forEach((n, d) => {
        if (dowOf(addDays(START, d)) === 7) expect(n).toBeLessThanOrEqual(3);
      });
    }
  });

  // OFFEN (Befund P4-Nachtrag, 06.10.2026): Mit den ECHTEN Funktionen von P2 (`reviewError`: falsch = eine Box zurück, Fälligkeit aber immer „morgen“) liegt
  // Fehlerquote 30 % bei 77–97 % der Tage (Seed 47: 77 % < 80 %). Mit dem Abstand der neuen Box (Box 0: 1 Tag, 1: 3, 2: 9) sind es 90–98 %. Die Änderung
  // gehört in `errors.ts` (P2); dieser Test hält den echten Stand fest.
  it('Fehlerquote 30 % mit den echten Funktionen von P2: Rückfall-Wächter (Abnahme in einem von drei Läufen knapp verfehlt)', () => {
    const runs = SEEDS.map((s) => simulate(real, 0.3, s));
    expect(mean(runs.map((r) => r.lowShare))).toBeGreaterThanOrEqual(0.8);
    for (const r of runs) {
      expect(r.lowShare).toBeGreaterThanOrEqual(0.7);
      expect(r.introductions).toBeGreaterThanOrEqual(DAYS / 6);
      expect(r.dropped).toBe(0);
    }
  });

  // OFFEN (Befund P4, 06.10.2026): Bei 50 % Fehlerquote erreicht die Schlange die Abnahme NICHT (an 35–43 % der Tage unter 10 statt ≥ 80 %); der Plan nannte
  // 84 %. Nach den zwei erlaubten Anpassungen innerhalb von §2.3 (Annahme 75 % richtig beim Wiederholen wie im Plan, Abstand der neuen Box nach „falsch“)
  // bleibt es dabei; eine höhere Obergrenze (11) ändert nichts, weil die Grenze nicht der enge Punkt ist. Emrah entscheidet (stand.md). Dieser Test hält den
  // gemessenen Stand fest (Rückfall-Wächter), er behauptet die Abnahme nicht.
  it('Fehlerquote 50 %: gemessener Stand (Abnahme laut Plan offen, siehe Kommentar)', () => {
    const runs = SEEDS.map((s) => simulate(real, 0.5, s));
    expect(mean(runs.map((r) => r.lowShare))).toBeGreaterThanOrEqual(0.3);
    expect(mean(runs.map((r) => r.avgDue))).toBeLessThanOrEqual(12);
    for (const r of runs) {
      expect(r.dropped).toBe(0);
      expect(r.introductions).toBeGreaterThanOrEqual(DAYS / 12);
    }
  });

  it('Vorschlag zur Entscheidung: mit dem Abstand der neuen Box und Bremse „unter 15“ hielten auch 50 % die 80 %-Marke', () => {
    for (const seed of SEEDS) expect(shareBelow(simulate(proposal, 0.5, seed).dueSeries, 15), `Seed ${seed}`).toBeGreaterThanOrEqual(0.8);
  });

  it('die Regeln aus §5.7 sind nie schlechter als „jeder Satz einzeln, falsch = Box 0“', () => {
    for (const wrong of [0.3, 0.5]) {
      const today = mean(SEEDS.map((s) => simulate(CURRENT, wrong, s).lowShare));
      const p2 = mean(SEEDS.map((s) => simulate(real, wrong, s).lowShare));
      expect(p2, `Fehlerquote ${wrong}`).toBeGreaterThanOrEqual(today);
    }
  });

  it('der Ist-Stand der Schlange läuft durch und liefert eine Zahl für den Bericht', () => {
    const r = simulate(CURRENT, 0.3, SEEDS[0]!);
    expect(r.lowShare).toBeGreaterThanOrEqual(0);
    expect(r.lowShare).toBeLessThanOrEqual(1);
    expect(ERRORS_MAX).toBe(10);
  });
});
