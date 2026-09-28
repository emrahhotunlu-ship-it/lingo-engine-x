import { describe, expect, it } from 'vitest';
import { canDoEvidence, canDoStatus, canDoSummary, type CanDoEnv, type CanDoItem } from '../../src/domain/progress/cando';

// N92 (plan.md §3.3, lehrer.md X2): C1 erst mit zwei Belegen; die Selbstmarkierung zählt nicht.

const env = (o: Partial<CanDoEnv> = {}): CanDoEnv => ({
  grammar: new Map(),
  vtest: null,
  colloc: { ema: null, n: 0 },
  radar: { n30: 0, nPrev30: 0 },
  writing: [],
  listening: [],
  speaking: null,
  self: {},
  ...o,
});
const item = (evidence: string, level = 'C1', id = `x-${evidence}-${level}`): CanDoItem => ({ id, level, dim: 'grammar', de: '', en: '', tip_de: '', tip_en: '', evidence });

describe('Can-Do: C1 erst mit zwei Belegen (N92)', () => {
  it('ein Wortschatztest über der Schwelle reicht für C1 nicht, zwei schon', () => {
    const one = env({ vtest: { passive: 8200, active: 6100 } });
    expect(canDoEvidence(item('vocab_passive'), one)).toBe(1);
    expect(canDoStatus(item('vocab_passive'), one)).toBe('open');
    const two = env({ vtest: { passive: 8200, active: 6100 }, vtests: [{ passive: 8100, active: 6000 }, { passive: 8200, active: 6100 }] });
    expect(canDoStatus(item('vocab_passive'), two)).toBe('reached');
    // B2 bleibt bei einem Beleg erreicht.
    expect(canDoStatus(item('vocab_passive', 'B2'), one)).toBe('reached');
  });

  it('Sprechen: „fair“ ist ein Beleg, „good“ sind zwei', () => {
    expect(canDoStatus(item('fluency'), env({ speaking: 'C1', speakingConf: 'fair' }))).toBe('open');
    expect(canDoStatus(item('fluency'), env({ speaking: 'C1', speakingConf: 'good' }))).toBe('reached');
  });

  it('Texte: drei C1-Texte sind drei Belege', () => {
    const w = [{ cefr: 'C1', register: 5 }, { cefr: 'C1', register: 4 }, { cefr: 'C1', register: 4 }];
    expect(canDoEvidence(item('writing'), env({ writing: w }))).toBe(3);
    expect(canDoStatus(item('writing'), env({ writing: w }))).toBe('reached');
  });

  it('Kollokationen zählen je volle 100 Antworten', () => {
    expect(canDoStatus(item('colloc'), env({ colloc: { ema: 0.8, n: 150 } }))).toBe('open');
    expect(canDoStatus(item('colloc'), env({ colloc: { ema: 0.8, n: 210 } }))).toBe('reached');
  });

  it('Selbstmarkierung ist nie ein Beleg und zählt nicht in der Zusammenfassung', () => {
    const items = [item('self', 'C1', 'a'), item('self', 'C1', 'b'), item('writing', 'C1', 'c')];
    const e = env({ self: { a: '2026-09-20' }, writing: [{ cefr: 'C1', register: 4 }, { cefr: 'C1', register: 4 }, { cefr: 'C1', register: 4 }] });
    expect(canDoEvidence(items[0]!, e)).toBe(0);
    const sum = canDoSummary(items, (i) => canDoStatus(i, e));
    expect(sum).toEqual([{ level: 'C1', done: 1, self: 1, total: 3 }]);
  });
});
