import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../src/domain/answer/check';
import { normalize } from '../../src/domain/answer/normalize';
import { checkCloze, type ClozeItem } from '../../src/domain/drills/cloze';
import { COLLOC_GROUPS, VERB_FORMS } from '../../src/content/collocEquiv';
import { acceptCollocations } from '../../src/domain/srs/collocs';
import { collocAlternatives, isEquivalentPartner } from '../../src/domain/srs/collocEquiv';
import { autoGrade } from '../../src/domain/srs/grade';
import { gradeAnswer } from '../../src/domain/grade';

// Auswertung 15.10.2026, Punkt 2: Bewertung nicht zu streng. Gleichwertige Wortpartner gelten als richtig, die Note ändert sich nur durch Zeit und Hilfe, nie das Urteil.

describe('gleichwertige Wortpartner', () => {
  it('Daten sind vollständig (jedes Verb hat fünf Formen)', () => {
    for (const g of COLLOC_GROUPS) for (const v of g.verbs) expect(VERB_FORMS[v], v).toBeDefined();
    for (const f of Object.values(VERB_FORMS)) expect(f).toHaveLength(5);
  });

  it('meet a deadline ↔ hit a deadline (US üblich), make a deadline', () => {
    expect(collocAlternatives('meet a deadline', 'meet')).toEqual(expect.arrayContaining(['hit', 'make']));
    expect(collocAlternatives('hit a deadline', 'hit')).toEqual(expect.arrayContaining(['meet']));
    expect(collocAlternatives('meet a deadline', 'met')).toEqual(expect.arrayContaining(['hit', 'made']));
    expect(isEquivalentPartner('meet a deadline', 'meet', 'hit')).toBe(true);
  });

  it('hold a meeting, make a decision, give a presentation', () => {
    expect(collocAlternatives('hold a meeting', 'hold')).toEqual(expect.arrayContaining(['have', 'run', 'schedule']));
    expect(collocAlternatives('hold a meeting', 'held')).toEqual(expect.arrayContaining(['had', 'ran']));
    expect(collocAlternatives('make a decision', 'make')).toEqual(expect.arrayContaining(['take', 'reach']));
    expect(collocAlternatives('give a presentation', 'give')).toEqual(expect.arrayContaining(['deliver', 'make']));
    expect(collocAlternatives('give a presentation', 'gave')).toContain('delivered');
  });

  it('fremde Kollokationen und Nicht-Verben haben keine Alternativen', () => {
    expect(collocAlternatives('raise a concern', 'raise')).toEqual([]);
    expect(collocAlternatives('meet a deadline', 'deadline')).toEqual([]);
    expect(isEquivalentPartner('meet a deadline', 'meet', 'attend')).toBe(false);
  });

  const item: ClozeItem = {
    key: 'k#0',
    cardId: 'deadline',
    sentence: { sentence: 'We always meet the deadline.', start: 10, end: 14, gap: 'meet' },
    gap: 'meet',
    base: 'meet',
    phrase: 'meet a deadline',
    de: 'eine Frist einhalten',
    wrongPartners: ['hit', 'reach'],
  };
  it('Lückenjagd: „hit“ bei „meet a deadline“ ist richtig, ein falscher Partner nicht', () => {
    expect(checkCloze(item, 'hit').verdict).toBe('correct');
    expect(checkCloze(item, 'Meet').verdict).toBe('correct');
    expect(checkCloze(item, 'attend').verdict).toBe('wrong');
  });

  it('acceptCollocations: ein gleichwertiger Ablenker wird verworfen', () => {
    const raw = [
      {
        p: 'meet a deadline',
        de: 'eine Frist einhalten',
        gap: 'meet',
        opts: ['hit', 'break', 'miss', 'skip'],
        ex: 'We always [meet the deadline] for the report each week.',
      },
    ];
    const out = acceptCollocations('deadline', raw);
    expect(out[0]?.opts).not.toContain('hit');
    expect(out[0]?.opts).toEqual(['break', 'miss', 'skip']);
  });
});

describe('Normalisierung: Lösung = Antwort bleibt richtig', () => {
  it('Groß/Klein, Satzzeichen, Anführungszeichen, Klammern, Bindestrich', () => {
    expect(normalize('  “Make” ')).toBe('make');
    expect(normalize('(hold)')).toBe('hold');
    for (const g of ['Hold', 'hold.', '"hold"', 'HOLD!', 'to hold', 'hold ']) expect(checkTyped(g, ['hold'], { lemma: 'hold' }).verdict, g).toBe('correct');
    expect(checkTyped('well known', ['well-known'], { lemma: 'well-known' }).verdict).toBe('correct');
    expect(checkTyped('well-known', ['well known'], { lemma: 'well known' }).verdict).toBe('correct');
    expect(checkTyped('jeopardised', ['jeopardized'], { lemma: 'jeopardize' }).verdict).toBe('correct');
  });

  it('Zeit und Hilfe senken nur die Note, nie das Urteil', () => {
    const slow = autoGrade('cloze', { verdict: 'correct' }, { submitMs: 60_000, firstKeyMs: 60_000, hintLevel: 2 });
    expect(slow).toBeGreaterThanOrEqual(2);
    expect(gradeAnswer({ key: 'cloze', verdict: 'correct', timeMs: 300_000, firstKeyMs: 300_000, help: 2 })).toBe(2);
    expect(gradeAnswer({ key: 'colloc_gap', verdict: 'correct', timeMs: 900_000, help: 1 })).toBeGreaterThanOrEqual(2);
    // Nur die Lösung zu sehen („Weiß ich nicht“, Hilfe 3) ist eine Note 1 – das ist gewollt und kein Urteil über eine richtige Antwort.
    expect(gradeAnswer({ key: 'cloze', verdict: 'wrong', timeMs: 1000, help: 3 })).toBe(1);
  });
});
