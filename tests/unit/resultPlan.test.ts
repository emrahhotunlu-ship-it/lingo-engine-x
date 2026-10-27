import { describe, expect, it } from 'vitest';
import type { ExplainLine, ExplanationModel } from '../../src/domain/explain/types';
import { countWord, planResult } from '../../src/ui/exercise/resultPlan';

// Bauplan der Ergebnis-Karte (UX-Audit U3): höchstens drei Blöcke (Urteil+Lösung · Warum · Merke), der Rest unter „Mehr“.

const SHELL_FOLD = ['mistake', 'contrast', 'note'] as const;
const text = (xs: { t: string }[]): string => JSON.stringify(xs);

describe('planResult', () => {
  const grammar: ExplanationModel = {
    lines: [
      { k: 'pattern', name: 'be used to · gewöhnt sein', formula: 'be used to + -ing' },
      { k: 'yours', given: 'use to', text: '„use to“ heißt „früher“ – hier geht es um Gewohnheit.' },
      { k: 'why', text: 'Be used to + -ing = gewöhnt sein.', head: 'Claude sagt', ai: true },
      { k: 'mistake', bad: 'I am used to work', good: 'I am used to working', cause: 'nach „to“ folgt -ing' },
      { k: 'contrast', a: 'used to', b: 'be used to', diff: 'früher ≠ gewöhnt' },
      { k: 'note', text: 'Auch möglich: get used to' },
    ],
    examples: [{ en: 'Our team is used to tight deadlines.' }],
    mark: [],
    ai: true,
    source: 'pattern',
  };

  it('Grammatik: Warum = eigene Antwort + Begründung (ohne eigene Überschrift), Merke = Muster, Rest unter Mehr', () => {
    const p = planResult(grammar, 'full', { fold: SHELL_FOLD });
    expect(p.why.map((x) => x.t === 'text' && x.k)).toEqual(['yours', 'why']);
    // „Claude sagt“ wird nie eine Überschrift; die KI-Kennzeichnung bleibt an der Zeile.
    expect(text(p.why)).not.toContain('Claude sagt');
    expect(p.why[1]).toMatchObject({ ai: true });
    expect(p.remember).toEqual([{ t: 'pattern', name: 'be used to · gewöhnt sein', formula: 'be used to + -ing' }]);
    expect(p.more.map((x) => x.t)).toEqual(['mistake', 'contrast', 'text']);
  });

  it('die eigene (falsche) Antwort steht nicht noch einmal in der Karte – nur die Begründung', () => {
    const p = planResult(grammar, 'full', { fold: SHELL_FOLD });
    expect(text(p.why)).not.toContain('"given"');
  });

  it('Fehler finden: Muster unter Mehr, Kontrast offen im Warum-Block', () => {
    const p = planResult(grammar, 'full', { fold: (['mistake', 'note', 'pattern'] as ExplainLine['k'][]), unfold: ['contrast'] });
    expect(p.remember).toEqual([]);
    expect(p.why.map((x) => x.t)).toContain('contrast');
    expect(p.more.map((x) => x.t)).toContain('pattern');
  });

  it('Tiefe min: nur Muster und Begründung offen', () => {
    const p = planResult(grammar, 'min', { fold: SHELL_FOLD });
    expect(p.why.map((x) => x.t === 'text' && x.k)).toEqual(['why']);
    expect(p.remember.map((x) => x.t)).toEqual(['pattern']);
  });

  const word: ExplanationModel = {
    lines: [
      { k: 'pattern', name: 'phase out · Verb · neutral', formula: null },
      { k: 'why', text: 'Merke: phase out a product · neutral. Phase out = schrittweise abschaffen; formeller: discontinue' },
    ],
    examples: [{ en: 'We will phase out the on-premise version by 2028.' }],
    mark: ['phase out'],
    ai: false,
    source: 'card',
  };

  it('Wortkarte: Merke = Kern + Gegenstück; Bedeutung und Wortarten-Chips unter Mehr (das Wort steht schon im Kopf)', () => {
    const p = planResult(word, 'full', { fold: SHELL_FOLD });
    expect(p.why).toEqual([]);
    expect(p.remember).toEqual([
      { t: 'main', text: 'phase out a product', en: true },
      { t: 'pair', label: 'Formeller', text: 'discontinue' },
    ]);
    expect(p.more).toEqual([
      { t: 'chips', word: 'phase out', chips: ['Verb', 'neutral'], formula: null },
      { t: 'text', k: 'note', text: 'Phase out = schrittweise abschaffen' },
    ]);
  });

  it('Lernwort höchstens zweimal in den offenen Blöcken (Kopf + Merke)', () => {
    const p = planResult(word, 'full', { fold: SHELL_FOLD });
    const open = [...p.why, ...p.remember].map((x) => ('text' in x ? x.text : '')).join(' ');
    // Der Kopf der Karte zeigt das Wort einmal; die offenen Blöcke höchstens noch einmal.
    expect(countWord(open, 'phase out')).toBeLessThanOrEqual(1);
  });

  it('Wortpartner: der Grund steht im Warum-Block, die Verbindung im Merke-Block', () => {
    const col: ExplanationModel = {
      ...word,
      lines: [
        { k: 'pattern', name: 'concern · Nomen', formula: 'raise concerns' },
        { k: 'why', text: 'Merke: raise concerns = Bedenken äußern. „raise“ ist der feste Partner von „concern“ – als Paar lernen' },
      ],
    };
    const p = planResult(col, 'full', { fold: SHELL_FOLD });
    expect(p.remember).toEqual([{ t: 'main', text: 'raise concerns = Bedenken äußern', en: false }]);
    expect(p.why).toEqual([{ t: 'text', k: 'why', text: '„raise“ ist der feste Partner von „concern“ – als Paar lernen' }]);
  });

  it('Begründung ohne „Merke:“ (Kontrast-Schritt, Drill) steht im Warum-Block; ein reines Wort entfällt', () => {
    const plain: ExplanationModel = { ...word, lines: [{ k: 'why', text: 'Gehört zu: make, take' }] };
    expect(planResult(plain, 'full').why).toEqual([{ t: 'text', k: 'why', text: 'Gehört zu: make, take', ai: undefined }]);
    const bare: ExplanationModel = { ...word, lines: [{ k: 'pattern', name: 'phase out', formula: null }, { k: 'why', text: 'phase out' }] };
    const p = planResult(bare, 'full');
    expect([...p.why, ...p.remember, ...p.more]).toEqual([]);
  });

  it('eigene Überschrift einer Antwortzeile („Deine Wertung“) bleibt als Vorspann erhalten', () => {
    const m: ExplanationModel = { ...grammar, lines: [{ k: 'yours', given: '', text: 'Du hast gesagt, deine Antwort stimmt.', head: 'Deine Wertung' }] };
    expect(planResult(m, 'full').why).toEqual([{ t: 'text', k: 'yours', text: 'Du hast gesagt, deine Antwort stimmt.', lead: 'Deine Wertung' }]);
  });
});

describe('countWord', () => {
  it('zählt ganze Wörter und Wendungen ohne Groß/klein', () => {
    expect(countWord('Avoid it. I avoided avoid', 'avoid')).toBe(2);
    expect(countWord('We phase  out the old; phase out!', 'phase out')).toBe(2);
    expect(countWord('', 'x')).toBe(0);
  });
});
