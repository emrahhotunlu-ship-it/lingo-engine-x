import { describe, expect, it } from 'vitest';
import type { ExplanationModel } from '../../src/domain/explain/types';
import { explainDepth, visibleLines, visibleWordCount } from '../../src/ui/exercise/explainDepth';

const model: ExplanationModel = {
  lines: [
    { k: 'pattern', name: 'Present Perfect', formula: 'have/has + V3' },
    { k: 'yours', given: 'I have seen him yesterday', text: 'Mit „yesterday“ steht die einfache Vergangenheit.' },
    { k: 'why', text: 'Die Handlung ist abgeschlossen und hat einen festen Zeitpunkt.' },
    { k: 'mistake', bad: 'I have seen', good: 'I saw', cause: 'Zeitpunkt genannt' },
    { k: 'contrast', a: 'I saw him', b: 'I have seen him', diff: 'fester Zeitpunkt oder nicht' },
    { k: 'note', text: 'US-Englisch nutzt oft die einfache Vergangenheit.' },
  ],
  examples: [
    { en: 'I saw him yesterday.', de: 'Ich habe ihn gestern gesehen.' },
    { en: 'I have seen him twice.' },
  ],
  mark: ['yesterday'],
  ai: false,
  source: 'pattern',
};
const kinds = (l: { k: string }[]): string[] => l.map((x) => x.k);

describe('explainDepth', () => {
  it('Fehler, fast richtig, weiß nicht und Lernphase sind immer full', () => {
    for (const verdict of ['wrong', 'near', 'dontKnow'] as const) expect(explainDepth({ verdict, p: 0.99, stage: 5, learning: false })).toBe('full');
    expect(explainDepth({ verdict: 'ok', p: 0.99, learning: true })).toBe('full');
  });
  it('Grammatik: p < 0,4 full · p ≤ 0,7 short · sonst min', () => {
    expect(explainDepth({ verdict: 'ok', p: 0.39, learning: false })).toBe('full');
    expect(explainDepth({ verdict: 'ok', p: 0.4, learning: false })).toBe('short');
    expect(explainDepth({ verdict: 'ok', p: 0.7, learning: false })).toBe('short');
    expect(explainDepth({ verdict: 'ok', p: 0.71, learning: false })).toBe('min');
  });
  it('Wörter: stage ≤ 2 full · 3 short · sonst min', () => {
    expect(explainDepth({ verdict: 'ok', stage: 1, learning: false })).toBe('full');
    expect(explainDepth({ verdict: 'ok', stage: 2, learning: false })).toBe('full');
    expect(explainDepth({ verdict: 'ok', stage: 3, learning: false })).toBe('short');
    expect(explainDepth({ verdict: 'ok', stage: 4, learning: false })).toBe('min');
  });
  it('ohne p und stage: full', () => {
    expect(explainDepth({ verdict: 'ok', p: null, stage: null, learning: false })).toBe('full');
  });
});

describe('visibleLines', () => {
  it('full: pattern, yours, why, mistake offen, ein Beispiel', () => {
    const v = visibleLines(model, 'full');
    expect(kinds(v.open)).toEqual(['pattern', 'yours', 'why', 'mistake']);
    expect(kinds(v.folded)).toEqual(['contrast', 'note']);
    expect(v.examplesOpen).toBe(1);
    expect(v.oneLine).toBe(false);
  });
  it('full ohne Lernphase: mistake eingeklappt', () => {
    const v = visibleLines(model, 'full', { learning: false });
    expect(kinds(v.open)).toEqual(['pattern', 'yours', 'why']);
    expect(kinds(v.folded)).toEqual(['mistake', 'contrast', 'note']);
  });
  it('short: pattern, yours, why offen, keine Beispiele offen', () => {
    const v = visibleLines(model, 'short');
    expect(kinds(v.open)).toEqual(['pattern', 'yours', 'why']);
    expect(kinds(v.folded)).toEqual(['mistake', 'contrast', 'note']);
    expect(v.examplesOpen).toBe(0);
  });
  it('short ohne yours: nur vorhandene Zeilen', () => {
    const m = { ...model, lines: model.lines.filter((l) => l.k !== 'yours') };
    expect(kinds(visibleLines(m, 'short').open)).toEqual(['pattern', 'why']);
  });
  it('min: eine Zeile aus pattern und why, alles andere eingeklappt', () => {
    const v = visibleLines(model, 'min');
    expect(kinds(v.open)).toEqual(['pattern', 'why']);
    expect(kinds(v.folded)).toEqual(['yours', 'mistake', 'contrast', 'note']);
    expect(v.oneLine).toBe(true);
    expect(v.examplesOpen).toBe(0);
  });
  it('ohne Beispiele ist kein Beispiel offen', () => {
    expect(visibleLines({ ...model, examples: [] }, 'full').examplesOpen).toBe(0);
  });
});

describe('visibleWordCount', () => {
  it('full: höchstens 45 Wörter am Handy', () => {
    expect(visibleWordCount(model, 'full')).toBeLessThanOrEqual(45);
    expect(visibleWordCount(model, 'full')).toBeGreaterThan(visibleWordCount(model, 'short'));
  });
  it('min ist am kürzesten', () => {
    expect(visibleWordCount(model, 'min')).toBeLessThan(visibleWordCount(model, 'short'));
  });
  it('zählt das offene Beispiel mit', () => {
    expect(visibleWordCount(model, 'full') - visibleWordCount({ ...model, examples: [] }, 'full')).toBe(4);
  });
});
