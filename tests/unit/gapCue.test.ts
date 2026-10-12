import { describe, expect, it } from 'vitest';
import { gapCue } from '../../src/domain/srs/exercise';
import type { Colloc } from '../../src/domain/srs/types';

// Rückmeldung 11.10.2026: „After this busy quarter, you deserve a ____.“ zeigte „Bedeutung: verdienen“ (Kartenwort), die Lücke ist aber „break“.
const colloc = (over: Partial<Colloc> = {}): Colloc => ({ index: 0, p: 'deserve a break', de: 'eine Pause verdienen', gap: 'break', opts: ['break', 'rest'], ctx: null, ...over });

describe('Hinweis unter Lückenaufgaben passt zur Lücke', () => {
  it('Wortpartner-Lücke: Bedeutung der Wendung, nie die des Kartenworts', () => {
    for (const ex of ['colloc', 'colloc_gap'] as const) {
      expect(gapCue({ ex, meaning: 'verdienen', colloc: colloc() }, 'de')).toEqual({ kind: 'phrase', text: 'eine Pause verdienen' });
    }
  });
  it('Paket-Lücke (index −1): die Verbindung ist die Wendung der Karte, ihre Bedeutung gilt (Audit 12.10.2026: „address ___ concerns“ ohne Hinweis)', () => {
    for (const lang of ['de', 'en'] as const) {
      expect(gapCue({ ex: 'colloc_gap', meaning: 'Bedenken ansprechen', colloc: colloc({ index: -1, p: 'address concerns', de: 'Bedenken ansprechen' }) }, lang)).toEqual({ kind: 'phrase', text: 'Bedenken ansprechen' });
    }
    expect(gapCue({ ex: 'colloc', meaning: null, colloc: colloc({ index: -1, de: '' }) }, 'de')).toBeNull();
  });
  it('ohne Bedeutung der Wendung (leer, englische Oberfläche): kein Hinweis', () => {
    expect(gapCue({ ex: 'colloc', meaning: 'verdienen', colloc: colloc({ de: '' }) }, 'de')).toBeNull();
    expect(gapCue({ ex: 'colloc', meaning: 'deserve', colloc: colloc() }, 'en')).toBeNull();
    expect(gapCue({ ex: 'colloc', meaning: 'verdienen', colloc: null }, 'de')).toBeNull();
  });
  it('Lücke = Kartenwort (cloze, complete, Wortfamilie, match): Bedeutung der Karte', () => {
    for (const ex of ['cloze', 'cloze_hint', 'wordfam', 'match', 'complete'] as const) {
      expect(gapCue({ ex, meaning: 'verdienen', colloc: null }, 'de')).toEqual({ kind: 'word', text: 'verdienen' });
    }
    expect(gapCue({ ex: 'cloze', meaning: null, colloc: null }, 'de')).toBeNull();
  });
});
