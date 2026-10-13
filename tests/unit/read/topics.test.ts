import { describe, expect, it } from 'vitest';
import { candidates, pickTopic, sanitizeCustomTopic, topicId } from '../../../src/modules/read/domain/topics';

// Themenwahl (docs/umbau/lesen-plan.md §3.3): deterministisch mit festem `rand`.

const prefs = (topics: Record<string, number> = {}, custom: string[] = []) => ({ topics, custom });
/** Zufallsquelle aus fester Folge. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length] ?? 0;
};

describe('Kandidaten', () => {
  it('ohne aktiven Chip gelten die sieben festen Themen mit Gewicht 1', () => {
    expect(candidates(prefs()).map((c) => c.id)).toEqual(['bizdev', 'saas', 'ai', 'economy', 'architecture', 'management', 'claudecode']);
  });

  it('aktive Chips und eigene Themen (höchstens 5, gesäubert, ohne Dubletten)', () => {
    const c = candidates(prefs({ ai: 3, saas: 1, economy: 0 }, ['Pricing for dev tools', 'pricing for dev tools', '  ', 'a', 'b', 'c', 'd', 'e']));
    expect(c.map((x) => x.id)).toEqual(['saas', 'ai', 'custom:pricing for dev tools', 'custom:a', 'custom:b', 'custom:c', 'custom:d']);
    expect(c.find((x) => x.id === 'ai')?.weight).toBe(3);
  });

  it('eigenes Thema säubern: ≤ 60 Zeichen, einzeilig, ohne < >', () => {
    expect(sanitizeCustomTopic('  Hello\n\tworld <b> ')).toBe('Hello world b');
    expect(sanitizeCustomTopic('x'.repeat(100))).toHaveLength(60);
    expect(sanitizeCustomTopic('   ')).toBeNull();
    expect(sanitizeCustomTopic('\u0000\u0001')).toBeNull();
    expect(topicId('custom', ' Foo Bar ')).toBe('custom:foo bar');
    expect(topicId('ai')).toBe('ai');
  });
});

describe('pickTopic', () => {
  it('deterministisch mit festem rand', () => {
    const p = prefs({ ai: 1, saas: 1, economy: 1 });
    const a = pickTopic(p, [], seq(0.1));
    const b = pickTopic(p, [], seq(0.1));
    expect(a).toEqual(b);
    expect(pickTopic(p, [], seq(0)).id).toBe('saas');
    expect(pickTopic(p, [], seq(0.999)).id).toBe('economy');
  });

  it('nie dreimal dasselbe Thema hintereinander (solange es eine Alternative gibt)', () => {
    const p = prefs({ ai: 3, saas: 1 });
    for (const r of [0, 0.3, 0.6, 0.9, 0.999]) expect(pickTopic(p, [{ topic: 'ai' }, { topic: 'ai' }], seq(r)).id).toBe('saas');
    // nur ein Thema aktiv: es bleibt bei diesem
    expect(pickTopic(prefs({ ai: 3 }), [{ topic: 'ai' }, { topic: 'ai' }], seq(0.5)).id).toBe('ai');
  });

  it('die letzten zwei Themen werden abgewertet, lange Pausen bevorzugt (Verteilung über viele Würfe)', () => {
    const p = prefs({ ai: 1, saas: 1, economy: 1, management: 1 });
    const hist = [{ topic: 'ai' }, { topic: 'saas' }, { topic: 'economy' }];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const id = pickTopic(p, hist, seq((i + 0.5) / 1000)).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    // management war nie dran: häufigster; ai (neuestes) seltenster
    expect(counts.management).toBeGreaterThan(counts.economy ?? 0);
    expect(counts.economy ?? 0).toBeGreaterThan(counts.saas ?? 0);
    expect(counts.saas ?? 0).toBeGreaterThan(counts.ai ?? 0);
    expect(counts.ai).toBeGreaterThan(0);
  });

  it('eigene Themen zählen wie Chips und tragen ihren Text', () => {
    const c = pickTopic(prefs({}, ['Pricing for dev tools']), [], seq(0.999));
    const all = candidates(prefs({}, ['Pricing for dev tools']));
    expect(all.at(-1)?.id).toBe('custom:pricing for dev tools');
    expect(['custom', 'claudecode', 'bizdev', 'saas', 'ai', 'economy', 'architecture', 'management']).toContain(c.topic);
    const only = pickTopic(prefs({ ai: 0 }, ['Pricing for dev tools']), [], seq(0.3));
    expect(only).toEqual({ topic: 'custom', custom: 'Pricing for dev tools', id: 'custom:pricing for dev tools' });
  });

  it('eigenes Thema wird im Verlauf an seinem Text erkannt (nicht dreimal dasselbe eigene Thema)', () => {
    const hist = [{ topic: 'custom', custom: 'Pricing for dev tools' }, { topic: 'custom', custom: 'Pricing for dev tools' }];
    const r = pickTopic(prefs({ ai: 1 }, ['Pricing for dev tools']), hist, seq(0.5));
    expect(r.id).toBe('ai');
  });

  it('rand außerhalb [0, 1) bricht nichts', () => {
    const p = prefs({ ai: 1, saas: 1 });
    expect(['ai', 'saas']).toContain(pickTopic(p, [], () => 7).id);
    expect(['ai', 'saas']).toContain(pickTopic(p, [], () => -3).id);
  });
});
