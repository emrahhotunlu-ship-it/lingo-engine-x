import { describe, expect, it } from 'vitest';
import { checkDrill } from '../../src/features/companion/drill';
import { CLAUDE_DRILL_EXAMPLE, claudeDrill, claudeDrillSchema } from '../../src/prompts/nb/p6/claudeDrill';

// N96 „Mach mir eine Übung dazu“: Vorlage claude-drill@1 und lokale Prüfung.

const item = (n: number) => ({ sentence: `Sentence ${n} was signed ___ yesterday.`, answer: 'off', accept: ['Off'], hint: 'Partikel', why: 'sign off = freigeben' });

describe('claude-drill@1', () => {
  it('Kopfzeile, Gesprächsausschnitt und Sprache der Erklärung', () => {
    const p = claudeDrill.build({ context: 'Learner: since oder for?', uiLang: 'de' });
    expect(p.startsWith('[claude-drill@1]')).toBe(true);
    expect(p).toContain('since oder for?');
    expect(p).toContain('in German');
    expect(claudeDrill.tier).toBe('quick');
    expect(claudeDrill.cache).toBe(false);
  });

  it('genau fünf Aufgaben mit genau einer Lücke; doppelte Varianten fallen weg', () => {
    const ok = claudeDrillSchema().parse({ title: 'sign off', items: [1, 2, 3, 4, 5].map(item) });
    expect(ok.items).toHaveLength(5);
    expect(ok.items[0]?.accept).toEqual([]);
    expect(() => claudeDrillSchema().parse({ title: 'x', items: [1, 2, 3, 4].map(item) })).toThrow();
    expect(() => claudeDrillSchema().parse({ title: 'x', items: [1, 2, 3, 4, 5].map((n) => ({ ...item(n), sentence: 'no gap' })) })).toThrow();
    // Das Beispiel im Prompt ist gültiges JSON in der richtigen Form (ein Eintrag).
    expect((JSON.parse(CLAUDE_DRILL_EXAMPLE) as { items: unknown[] }).items).toHaveLength(1);
  });

  it('lokale Prüfung: Lösung und Varianten richtig, anderes falsch', () => {
    expect(checkDrill({ answer: 'since', accept: [] }, 'since')).toBe(true);
    expect(checkDrill({ answer: 'since', accept: [] }, ' Since ')).toBe(true);
    expect(checkDrill({ answer: 'since', accept: [] }, 'for')).toBe(false);
    expect(checkDrill({ answer: 'sign off', accept: ['approve'] }, 'approve')).toBe(true);
  });
});
