import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { acceptBankItem, SB_DE_MAX_CHARS, SB_EN_MAX_CHARS, SB_MAX, type SbEntry } from '../../src/domain/tutor/sentenceBank';

// Harte Zeichengrenzen der Satzbank (en 220, de 300) und Worst-Case-Größe von `vocab/<id>` mit 8 Sätzen.
const card = { id: 'convince', en: 'to convince' };
const run = (en: string, de: string) => acceptBankItem({ id: card.id, sents: [{ en, de, sit: 'work', k: 'work' }] }, card, new Set(), 1_700_000_000_000, 'word-bank@1');

describe('Satzbank: Zeichengrenzen', () => {
  it('en über 220 Zeichen wird verworfen (length)', () => {
    const r = run(`We need to convince ${'x'.repeat(SB_EN_MAX_CHARS)}.`, 'Wir müssen sie überzeugen.');
    expect(r.sb).toHaveLength(0);
    expect(r.rejected).toEqual(['length']);
  });
  it('de über 300 Zeichen wird verworfen (length)', () => {
    const r = run('We need to convince the board today.', `Wir müssen ${'sehr '.repeat(80)}überzeugen.`);
    expect(r.sb).toHaveLength(0);
    expect(r.rejected).toEqual(['length']);
  });
  it('normaler Satz bleibt angenommen', () => {
    expect(run('She wanted to convince the whole board of the new budget plan.', 'Sie wollte den ganzen Vorstand von dem neuen Haushaltsplan überzeugen.').rejected).toEqual([]);
  });
  it('Worst-Case: 8 Sätze an den Grenzen bleiben klar unter 256 KiB', () => {
    const sb: SbEntry[] = Array.from({ length: SB_MAX }, (_, i) => ({
      en: 'e'.repeat(SB_EN_MAX_CHARS),
      de: 'ä'.repeat(SB_DE_MAX_CHARS),
      sit: 's'.repeat(40),
      k: 'work',
      src: 'ai',
      t: 1_700_000_000_000 + i,
      pv: 'p'.repeat(60),
    }));
    const doc = { word: 'convince', de: 'x', ex: 'We talked about convince in the weekly meeting with the team.', stage: 2, S: 3, D: 5, due: 1_700_000_000_000, sb };
    expect(new TextEncoder().encode(JSON.stringify(doc)).length).toBeLessThan(16 * 1024);
    expect(validateDoc('vocab/convince', doc).ok).toBe(true);
  });
});
