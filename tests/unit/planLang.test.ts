import { describe, expect, it } from 'vitest';
import { buildTrainCards } from '../../src/domain/metrics';
import { quizzable } from '../../src/domain/srs/queue';
import { unitReviewGoal } from '../../src/domain/unit/review';
import { berlin, loadSeed } from './helpers';

// Der Plan hängt nicht von der Oberflächensprache ab (Lernplattform 2.0 §2.3): bisher „DE 30 gegen EN 27 Karten“, weil Karten
// ohne englische Definition auf Englisch nicht abfragbar waren.

const NOW = berlin('2026-09-23', 9);
const seed = loadSeed();
const vocab = new Map<string, Record<string, unknown>>(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), { ...v }]));
// Ein Teil der Karten ohne englische Definition, ein Teil ohne deutsche Bedeutung.
[...vocab.values()].forEach((d, i) => {
  if (i % 7 === 0) delete d.def;
  else if (i % 11 === 0) delete d.de;
});

describe('Plan in Deutsch und Englisch am selben Tag identisch', () => {
  const cards = buildTrainCards(vocab, NOW).filter((c) => !c.hidden);
  it('dieselben Karten sind abfragbar', () => {
    const de = cards.filter((c) => quizzable(c, 'de', cards.length - 1)).map((c) => c.key);
    const en = cards.filter((c) => quizzable(c, 'en', cards.length - 1)).map((c) => c.key);
    expect(en).toEqual(de);
  });
  it('Wiederholziel, Minuten und Zusammensetzung sind gleich', () => {
    const run = (lang: 'de' | 'en') => unitReviewGoal({ cards, repairs: 2, nowMs: NOW, lang, budgetSec: 480, quotaLeft: 3 });
    const de = run('de');
    const en = run('en');
    expect(en.goal).toBe(de.goal);
    expect({ due: en.due, fresh: en.fresh, repairs: en.repairs, sec: en.sec, overdue: en.overdue }).toEqual({ due: de.due, fresh: de.fresh, repairs: de.repairs, sec: de.sec, overdue: de.overdue });
    expect(de.goal).toBeGreaterThan(0);
  });
});
