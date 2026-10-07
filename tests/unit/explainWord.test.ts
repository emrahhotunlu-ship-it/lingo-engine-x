import { describe, expect, it } from 'vitest';
import { packDoc, packEntry } from '../../src/domain/c1pack/pack';
import { packExtraOf } from '../../src/domain/c1pack/packFields';
import { toTrainCard } from '../../src/domain/srs/cards';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { explainWord, isAltAnswer } from '../../src/domain/srs/explainWord';
import { checkTyped } from '../../src/domain/answer/check';
import type { TrainCard } from '../../src/domain/srs/types';
import { visibleLines } from '../../src/ui/exercise/explainDepth';

// Warum-Zeile mit echtem Fehlergrund (Lernplattform 2.0 §4.8): Verwechslung, falsche Option, Deutsch-Falle, Partnerwort, Register, Variante.

const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const DAY = '2026-10-05';
const packCard = (id: string): TrainCard => {
  const made = packDoc(packEntry(id)!, DAY, NOW)!;
  const doc = { ...made.doc, state: 'review', stage: 3, S: 4, D: 5, reps: 3, last: NOW - 1000, due: NOW };
  return (made.kind === 'chunk' ? toChunkCard(made.id, doc, NOW) : toTrainCard(made.id, doc, true, NOW))!;
};
const vocab = (over: Record<string, unknown>): TrainCard => toTrainCard('x', { word: 'constraint', de: 'Einschränkung', def: 'a limit on what you can do', pos: 'noun', state: 'review', stage: 3, S: 4, D: 5, reps: 3, last: 1, due: 2, ex: 'Budget is the main [constraint] here.', ...over }, true, NOW)!;
const text = (m: ReturnType<typeof explainWord>, k: string): string => JSON.stringify(m.lines.filter((l) => l.k === k));

describe('explainWord: der echte Grund des Fehlers', () => {
  it('Verwechslung (getippt): nennt die Bedeutung des anderen Worts und die gesuchte', () => {
    const card = vocab({});
    const check = checkTyped('restriction', ['constraint'], { lemma: 'constraint', knownWords: new Set(['restriction']) });
    expect(check.kind).toBe('confusable');
    const m = explainWord({ card, ex: 'cloze', verdict: 'wrong', given: 'restriction', check, lang: 'de', otherMeaning: 'Beschränkung' });
    const yours = text(m, 'yours');
    expect(yours).toContain('restriction');
    expect(yours).toContain('Beschränkung');
    expect(yours).toContain('constraint');
    expect(text(m, 'contrast')).toContain('restriction');
  });
  it('falsche Auswahl: „‚X‘ heißt … (gehört zu …)“', () => {
    const card = vocab({});
    const m = explainWord({ card, ex: 'mc_de', verdict: 'wrong', given: 'restriction', check: { verdict: 'wrong' }, picked: { label: 'restriction', fromWord: 'restriction', fromMeaning: 'Beschränkung' }, lang: 'de' });
    const yours = text(m, 'yours');
    expect(yours).toContain('heißt');
    expect(yours).toContain('gehört zu');
    expect(yours).toContain('Beschränkung');
  });
  it('Deutsch-Falle: die Karte „actual“ zeigt die Erklärung der Falle und den typischen Fehler', () => {
    const card = vocab({ word: 'actual', de: 'tatsächlich', ex: 'The [actual] figures are lower.' });
    const m = explainWord({ card, ex: 'cloze', verdict: 'wrong', given: 'current', check: { verdict: 'wrong' }, lang: 'de' });
    expect(text(m, 'mistake')).toContain('actual version');
    const trap = explainWord({ card, ex: 'find_trap', verdict: 'wrong', given: 'figures', check: { verdict: 'wrong' }, lang: 'de' });
    expect(text(trap, 'yours')).toContain('tatsächlich');
  });
  it('Partnerwort: „address“ statt „solve“ mit Merke-Zeile und Register', () => {
    const card = packCard('colloc-01');
    const m = explainWord({ card, ex: 'colloc_gap', verdict: 'wrong', given: 'solve', check: { verdict: 'wrong' }, lang: 'de', solution: 'address' });
    expect(text(m, 'yours')).toContain('address');
    expect(text(m, 'yours')).toContain('solve');
    const first = m.lines[0];
    expect(first).toMatchObject({ k: 'pattern' });
    expect(text(m, 'pattern')).toContain('address concerns');
    expect(text(m, 'pattern')).toContain('neutral');
    expect(text(m, 'why')).toContain('Merke: address an issue');
  });
  it('Variante aus `alt` → „Fast richtig“ mit „Auch möglich“, kein Fehler', () => {
    const card = packCard('colloc-01');
    expect(isAltAnswer(card, 'tackle concerns')).toBe(true);
    const r = checkTyped('tackle concerns', ['address concerns'], { lemma: 'address concerns', alt: ['tackle concerns', 'deal with concerns'] });
    expect(r).toMatchObject({ verdict: 'near', kind: 'synonym' });
    const m = explainWord({ card, ex: 'cloze', verdict: 'near', given: 'tackle concerns', check: r, lang: 'de', solution: 'address concerns' });
    expect(text(m, 'note')).toContain('Auch möglich');
  });
  it('richtige Antwort: mindestens die Merke-Zeile; Beispiele nur von dieser Karte; Tiefe „min“ zeigt genau eine Zeile', () => {
    const card = packCard('family-01');
    const m = explainWord({ card, ex: 'cloze', verdict: 'ok', given: 'compliance', check: { verdict: 'correct' }, lang: 'en' });
    expect(m.lines.some((l) => l.k === 'why')).toBe(true);
    expect(m.examples[0]?.en).toBe(card.context?.sentence);
    const own = new Set([card.context?.sentence, ...(packExtraOf(card)?.col ?? []).map((c) => c.ex)]);
    for (const e of m.examples) expect(own.has(e.en), e.en).toBe(true);
    const v = visibleLines(m, 'min');
    expect(v.open.length).toBeGreaterThanOrEqual(1);
  });
  it('US-Schreibweise wird als Hinweis genannt, nie als Fehler', () => {
    const card = vocab({ word: 'color', de: 'Farbe' });
    const m = explainWord({ card, ex: 'cloze', verdict: 'ok', given: 'colour', check: { verdict: 'correct', variant: 'uk', us: 'color' }, lang: 'en' });
    expect(text(m, 'note')).toContain('color');
  });
});
