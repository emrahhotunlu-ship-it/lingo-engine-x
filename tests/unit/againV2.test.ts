import { describe, expect, it } from 'vitest';
import { checkRepairLocal } from '../../src/domain/repair/check';
import { applyFixes, repairDiag, repairTiles, spanFixes } from '../../src/domain/repair/variant';

// Schritt 4 am Handy (Lernplattform 2.0 §5.7, §6): bis zu 3 Fehlerstellen antippen und ersetzen, sonst Bausteine der richtigen
// Fassung; nie ein Textfeld mit dem ganzen Satz. Rein.

describe('Fehlerstellen', () => {
  it('eine Stelle: der Ersatz ist die richtige Form', () => {
    const f = spanFixes('The report was send yesterday.', 'The report was sent yesterday.');
    expect(f).toEqual([{ span: [3, 3], fix: 'sent' }]);
  });

  it('zwei Stellen nacheinander, Ersatz je Stelle, am Ende der richtige Satz', () => {
    const wrong = 'Yesterday I go to the office and she say hello.';
    const right = 'Yesterday I went to the office and she said hello.';
    const f = spanFixes(wrong, right);
    expect(f?.map((x) => x.fix)).toEqual(['went', 'said']);
    expect(applyFixes(wrong, f!, ['went', 'said'])).toBe(right);
    // Nur eine Stelle ersetzt: die andere bleibt falsch, die Prüfung sagt nein.
    expect(checkRepairLocal(applyFixes(wrong, f!, ['went']), { wrong, right })).toBe('no');
    expect(checkRepairLocal(applyFixes(wrong, f!, ['went', 'said']), { wrong, right })).toBe('exact');
  });

  it('mehr als 3 Stellen oder Streichen allein: keine Stellen (dann Bausteine)', () => {
    expect(spanFixes('He go to work every days and she like it a lot too, very much.', 'He goes to work every day and she likes it a lot, too, very much indeed.')).toBeNull();
    expect(spanFixes('I am very very happy.', 'I am very happy.')).toBeNull();
  });
});

describe('Bausteine', () => {
  it('die Wörter der richtigen Fassung, vorgeordnet bis zur ersten Abweichung, nie schon fertig gelegt', () => {
    const t = repairTiles('We discussed about the budget in detail yesterday afternoon.', 'We discussed the budget in detail yesterday afternoon.', 'r1');
    expect(t.texts.join(' ')).toBe('We discussed the budget in detail yesterday afternoon.');
    expect(t.pre).toBe(2);
    expect(t.order).toHaveLength(t.texts.length - t.pre);
    expect([...t.order].sort((a, b) => a - b)).toEqual(t.texts.map((_, i) => i).filter((i) => i >= t.pre));
    expect(t.order).not.toEqual(t.texts.map((_, i) => i).filter((i) => i >= t.pre));
  });
});

describe('Diagnosezeile', () => {
  it('zählt Sätze ohne Bereich und mit 2–3 Stellen (nur eigene Sätze, keine Varianten)', () => {
    const one = [{ span: [1, 1] as [number, number], fix: 'a' }];
    const two = [...one, { span: [4, 4] as [number, number], fix: 'b' }];
    expect(repairDiag([{ spans: one, variant: null }, { spans: two, variant: null }, { spans: null, variant: null }])).toEqual({ n: 3, noSpan: 1, multi: 1 });
  });
});
