import { describe, expect, it } from 'vitest';
import {
  buildModel,
  cardLevel,
  findSurface,
  highlightMap,
  initialRevealed,
  pickChecks,
  pickKeyWord,
  pickKeyWords,
  sentenceState,
  toggleAll,
  toggleSentence,
  topVisibleSentence,
  userRevealCount,
  viewOf,
} from '../../../src/modules/read/domain/readerModel';
import { goodItem } from './fixtures';

describe('Leser: Sätze und Ansichten', () => {
  const art = goodItem();
  const model = buildModel(art);

  it('zerlegt den Artikel in nummerierte Sätze (ab 1, über alle Absätze) mit Fundstelle', () => {
    expect(model.total).toBe(art.paras.flat().length);
    expect(model.sentences[0]).toMatchObject({ n: 1, p: 0, s: 0 });
    expect(model.sentences[4]).toMatchObject({ n: 5, p: 1, s: 0 });
    expect(model.paragraphs).toHaveLength(art.paras.length);
    expect(model.paragraphs[1]?.[0]?.n).toBe(5);
  });

  it('ein aufgeräumter Artikel (paras: []) hat keine Sätze und bricht nichts', () => {
    const m = buildModel({ paras: [] });
    expect(m.total).toBe(0);
    expect(m.paragraphs).toEqual([]);
    expect(buildModel({ paras: [[{ e: '  ', d: 'x' }], [{ e: 'Hi there.', d: 'Hallo.' }]] }).sentences).toHaveLength(1);
  });

  it('Standardansicht ist B; unbekannte Werte fallen auf B zurück', () => {
    expect(viewOf(undefined)).toBe('b');
    expect(viewOf('zzz')).toBe('b');
    expect(viewOf('a')).toBe('a');
    expect(viewOf('c')).toBe('c');
  });

  it('Ansicht A deckt alle Sätze auf, B und C starten zugedeckt', () => {
    expect(initialRevealed('a', 3)).toEqual(new Set([1, 2, 3]));
    expect(initialRevealed('b', 3).size).toBe(0);
    expect(initialRevealed('c', 3).size).toBe(0);
  });

  it('Zustand je Satz: A und B zeigen Englisch, Deutsch erst aufgedeckt; C zeigt Deutsch, Englisch erst aufgedeckt', () => {
    expect(sentenceState('a', true)).toEqual({ showEn: true, showDe: true, deFirst: false });
    expect(sentenceState('b', false)).toEqual({ showEn: true, showDe: false, deFirst: false });
    expect(sentenceState('b', true)).toEqual({ showEn: true, showDe: true, deFirst: false });
    expect(sentenceState('c', false)).toEqual({ showEn: false, showDe: true, deFirst: true });
    expect(sentenceState('c', true)).toEqual({ showEn: true, showDe: true, deFirst: true });
  });

  it('Tippen schaltet einen Satz um, ohne die alte Menge zu verändern; „alle“ deckt auf oder zu', () => {
    const none = new Set<number>();
    const one = toggleSentence(none, 4);
    expect(one.has(4)).toBe(true);
    expect(none.size).toBe(0);
    expect(toggleSentence(one, 4).size).toBe(0);
    const all = toggleAll(none, 5);
    expect(all.size).toBe(5);
    expect(toggleAll(all, 5).size).toBe(0);
    expect(toggleAll(new Set([1]), 5).size).toBe(5);
  });

  it('selbst aufgedeckte Sätze: in A zählt das Zudecken, sonst das Aufdecken', () => {
    expect(userRevealCount('b', new Set([1, 2]), 10)).toBe(2);
    expect(userRevealCount('a', initialRevealed('a', 10), 10)).toBe(0);
    expect(userRevealCount('a', new Set([1, 2, 3]), 10)).toBe(7);
  });

  it('oberster sichtbarer Satz aus den Unterkanten', () => {
    const rows = [
      { n: 1, bottom: -300 },
      { n: 2, bottom: 20 },
      { n: 3, bottom: 120 },
    ];
    expect(topVisibleSentence(rows, 60)).toBe(3);
    expect(topVisibleSentence(rows, 10)).toBe(2);
    expect(topVisibleSentence([], 60)).toBe(1);
    expect(topVisibleSentence([{ n: 1, bottom: -5 }, { n: 2, bottom: -1 }], 60)).toBe(2);
  });

  it('Prüffragen: höchstens zwei', () => {
    expect(pickChecks(art.check)).toHaveLength(2);
    expect(pickChecks([...(art.check ?? []), ...(art.check ?? [])])).toHaveLength(2);
    expect(pickChecks(null)).toEqual([]);
  });
});

describe('Leser: Schlüsselwörter gehören zu einem Satz des Artikels', () => {
  const art = goodItem();
  const model = buildModel(art);

  it('findet die Wortform im Satz (Endungen erlaubt, Groß/Klein egal, ganze Wörter)', () => {
    expect(findSurface('Many teams offer three tiers.', 'tier')?.surface).toBe('tiers');
    expect(findSurface('Churn offers a clue.', 'churn')?.surface).toBe('Churn');
    expect(findSurface('A breach of   trust hurts.', 'breach of trust')?.surface).toBe('breach of   trust');
    expect(findSurface('The airtier was fast.', 'tier')).toBeNull();
    expect(findSurface('Nothing here.', 'tier')).toBeNull();
    expect(findSurface('x', '')).toBeNull();
  });

  it('nimmt den Satz der Fundstelle `i`, wenn das Wort dort steht', () => {
    const pick = pickKeyWord(model, { w: 'forecast', de: 'vorhersagen', i: [1, 1] });
    expect(pick.sentence?.p).toBe(1);
    expect(pick.sentence?.s).toBe(1);
    expect(pick.sentence?.e).toContain('forecast');
    expect(pick.surface).toBe('forecast');
    expect(pick.span).not.toBeNull();
    const [a, b] = pick.span ?? [0, 0];
    expect(pick.sentence?.e.slice(a, b)).toBe('forecast');
  });

  it('falsche Fundstelle: der erste Satz, der das Wort wirklich enthält', () => {
    const pick = pickKeyWord(model, { w: 'churn', de: 'Kundenabwanderung', i: [0, 0] });
    expect(pick.sentence?.e).toMatch(/Churn/);
  });

  it('Wort kommt in keinem Satz vor: kein Satz, also keine Karte', () => {
    const pick = pickKeyWord(model, { w: 'blockchain', de: 'Blockkette', i: [0, 0] });
    expect(pick.sentence).toBeNull();
    expect(pick.surface).toBeNull();
    expect(pick.span).toBeNull();
  });

  it('Fundstelle außerhalb des Artikels bricht nichts', () => {
    expect(pickKeyWord(model, { w: 'tiers', de: 'Stufen', i: [99, 99] }).sentence?.e).toContain('tiers');
  });

  it('alle fünf Wörter des Beispielartikels haben einen Satz; höchstens fünf, Dubletten einmal', () => {
    const picks = pickKeyWords(model, art.keyWords);
    expect(picks).toHaveLength(5);
    expect(picks.every((p) => p.sentence && p.surface)).toBe(true);
    const doubled = pickKeyWords(model, [...(art.keyWords ?? []), { w: 'TIERS', de: 'Stufen', i: [2, 0] }, { w: 'extra', de: 'zusätzlich', i: [0, 0] }]);
    expect(doubled).toHaveLength(5);
  });

  it('Hervorhebung: eine Stelle je Satz', () => {
    const map = highlightMap(pickKeyWords(model, art.keyWords));
    expect(map.size).toBe(5);
    for (const [n, [s, e]] of map) expect(model.sentences[n - 1]?.e.slice(s, e).length).toBeGreaterThan(2);
  });

  it('Kartenstufe nur bei gültigem Wert', () => {
    expect(cardLevel('c1')).toBe('C1');
    expect(cardLevel(' B2 ')).toBe('B2');
    expect(cardLevel('expert')).toBeNull();
    expect(cardLevel(undefined)).toBeNull();
  });
});
