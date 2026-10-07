import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOrder, checkOrder, TRAP_FROM_P } from '../../src/domain/drills/order';
import { orderExamples, orderExplanation } from '../../src/domain/drills/orderExplain';
import { orderPool, poolNorm, type PoolEntry } from '../../src/domain/drills/orderPool';
import { dayTopic, pickOrderForDay } from '../../src/domain/drills/orderTopic';
import { familyOf, patternById } from '../../src/domain/grammar/patterns';

// Satzbau zum Tagesthema (Lernplattform 2.0 §3.6, §5.8): Sätze aus `u.gt` mit Rückfall, Fallen-Baustein ab p ≥ 0,4,
// Erklär-Karte nur mit Beispielen desselben Musters.

const pool = orderPool();
const rawItems = (JSON.parse(readFileSync('src/content/c1/order.json', 'utf8')) as { items: Array<{ en: string; pat?: string; trap?: unknown }> }).items;
const withTrap = pool.filter((e) => e.trap);
const patOf = (e: PoolEntry): string => e.pat ?? '';

describe('Pool: Muster und Fallen-Baustein', () => {
  it('pat und trap werden gelesen, ungültige Fallen fallen nicht still unter den Tisch', () => {
    expect(pool.filter((e) => e.pat).length).toBeGreaterThanOrEqual(100);
    expect(withTrap.length).toBeGreaterThanOrEqual(50);
    // Jede Falle der Datei ist im geladenen Pool angekommen (tile ist ein Baustein, instead keiner).
    expect(withTrap.length).toBe(rawItems.filter((r) => r.trap).length);
    for (const e of withTrap) {
      const norm = e.chunks.map(poolNorm);
      expect(norm).toContain(poolNorm(e.trap!.tile));
      expect(norm).not.toContain(poolNorm(e.trap!.instead));
    }
  });

  it('jedes Muster der Sätze gibt es als Grammatik-Muster', () => {
    for (const e of pool.filter((x) => x.pat)) expect(patternById(e.pat!), `${e.topic}: ${e.pat}`).not.toBeNull();
  });
});

describe('buildOrder: Fallen-Baustein', () => {
  const e = withTrap[0]!;
  const seed = 'trap-1';
  const plain = (p: number | null) => buildOrder(e, { seed, p });

  it('unter 0,4 oder ohne Wert: keine Falle im Vorrat', () => {
    for (const p of [null, 0, TRAP_FROM_P - 0.01]) {
      const it = plain(p);
      expect(it.tiles.some((x) => x.distractor)).toBe(false);
      expect(it.tiles).toHaveLength(e.chunks.length);
      expect(it.trap ?? null).toBeNull();
    }
  });

  it('ab 0,4 genau EIN Fallen-Baustein mit der falschen Form', () => {
    const it = plain(TRAP_FROM_P);
    const traps = it.tiles.filter((x) => x.distractor);
    expect(traps).toHaveLength(1);
    expect(traps[0]!.text).toBe(e.trap!.instead);
    expect(it.tiles).toHaveLength(e.chunks.length + 1);
    expect(it.trap?.tile).toBe(e.trap!.tile);
  });

  it('die Lösung bleibt richtig, der Fallen-Baustein macht den Satz falsch', () => {
    const it = plain(0.8);
    const ids = (texts: readonly string[]) => texts.map((t) => it.tiles.find((x) => !x.distractor && x.text === t)!.id);
    expect(checkOrder(it, ids(it.solution)).verdict).toBe('correct');
    // die Falle statt des richtigen Bausteins gelegt → falsch, auch wenn die Stelle stimmt
    const trapId = it.tiles.find((x) => x.distractor)!.id;
    const swapped = it.solution.map((t) => (t === e.trap!.tile ? trapId : it.tiles.find((x) => x.text === t)!.id));
    const res = checkOrder(it, swapped);
    expect(res.verdict).toBe('wrong');
    expect(res.usedDistractor).toBe(true);
  });

  it('der Vorrat liegt nie schon in der Lösungsreihenfolge', () => {
    for (let k = 0; k < 20; k++) {
      const it = buildOrder(e, { seed: `s${k}`, p: 0.9 });
      expect(it.tiles.filter((x) => !x.distractor).map((x) => x.text)).not.toEqual(it.solution);
    }
  });
});

describe('pickOrderForDay: Rückfall gleiches Muster → Thema → Familie → C1', () => {
  const family = (t: string) => familyOf(t);
  const patEntry = pool.find((e) => e.pat && e.topic === 'articles')!;
  const gt = { intro: 'articles', pats: [patEntry.pat!], topics: ['articles', 'countable'] };

  it('das Tagesthema ist das Einführungsthema, sonst das erste Rundenthema', () => {
    expect(dayTopic(gt)).toBe('articles');
    expect(dayTopic({ intro: null, pats: [], topics: ['passive'] })).toBe('passive');
    expect(dayTopic({ intro: null, pats: [], topics: [] })).toBeNull();
    expect(dayTopic(null)).toBeNull();
  });

  it('Sätze mit dem Muster des Tages stehen vorn, jeder Satz einmal', () => {
    const picks = pickOrderForDay(pool, gt, { n: 6, seed: 'a', family });
    expect(picks).toHaveLength(6);
    expect(new Set(picks.map((p) => poolNorm(p.entry.en))).size).toBe(6);
    const same = pool.filter((e) => e.pat === gt.pats[0]).length;
    const tier1 = picks.filter((p) => p.tier === 1);
    expect(tier1.length).toBe(Math.min(6, same));
    expect(picks.map((p) => p.tier)).toEqual([...picks.map((p) => p.tier)].sort());
    for (const p of tier1) expect(patOf(p.entry)).toBe(gt.pats[0]);
  });

  it('ohne Muster des Tages: das Thema, dann die Familie, dann C1', () => {
    const picks = pickOrderForDay(pool, { intro: null, pats: [], topics: ['articles'] }, { n: 12, seed: 'b', family });
    expect(picks).toHaveLength(12);
    const own = pool.filter((e) => e.topic === 'articles').length;
    expect(picks.filter((p) => p.tier === 2)).toHaveLength(Math.min(12, own));
    if (own < 12) expect(picks.some((p) => p.tier >= 3)).toBe(true);
    const fam = new Set(family('articles'));
    for (const p of picks.filter((x) => x.tier === 3)) expect(fam.has(p.entry.topic)).toBe(true);
  });

  it('Gesehenes wird gemieden, solange das Thema genug Neues hat; sonst wiederholt es sich vor einem fremden Thema', () => {
    const base = pickOrderForDay(pool, gt, { n: 3, seed: 'c', family });
    const seen = new Set(base.map((p) => poolNorm(p.entry.en)));
    const again = pickOrderForDay(pool, gt, { n: 3, seed: 'c', seen, family });
    const topicSize = pool.filter((e) => e.topic === 'articles').length;
    if (topicSize >= 6) for (const p of again) expect(seen.has(poolNorm(p.entry.en))).toBe(false);
    // alles gesehen: das Thema liefert trotzdem zuerst (Stufe ≤ 3), nicht der Rest
    const allSeen = new Set(pool.map((e) => poolNorm(e.en)));
    const all = pickOrderForDay(pool, gt, { n: 4, seed: 'd', seen: allSeen, family });
    expect(all).toHaveLength(4);
    const near = pool.filter((e) => e.pat === gt.pats[0] || e.topic === 'articles' || family('articles').includes(e.topic)).length;
    if (near >= 4) expect(all.every((p) => p.tier <= 3)).toBe(true);
  });

  it('gleicher Startwert, gleiche Auswahl; Plan ohne Thema liefert nichts', () => {
    expect(pickOrderForDay(pool, gt, { n: 6, seed: 'x', family }).map((p) => p.entry.en)).toEqual(pickOrderForDay(pool, gt, { n: 6, seed: 'x', family }).map((p) => p.entry.en));
    expect(pickOrderForDay(pool, { intro: null, pats: [], topics: [] }, { n: 6, seed: 'x', family })).toEqual([]);
  });
});

describe('Erklär-Karte des Satzbaus', () => {
  const e = withTrap.find((x) => x.pat && patternById(x.pat))!;
  const item = buildOrder(e, { seed: 'ex', p: 0.8 });

  it('Muster · Warum · Fallen-Baustein (als „Deine Antwort“, wenn er gelegt wurde)', () => {
    const used = orderExplanation({ item, lang: 'de', usedTrap: true, topicName: 'T', verdict: 'wrong' });
    expect(used.lines.map((l) => l.k)).toEqual(expect.arrayContaining(['pattern', 'yours', 'why']));
    expect(used.lines.find((l) => l.k === 'yours')).toMatchObject({ given: e.trap!.instead, text: e.trap!.why.de });
    const unused = orderExplanation({ item, lang: 'en', usedTrap: false, topicName: 'T', verdict: 'ok' });
    expect(unused.lines.map((l) => l.k)).not.toContain('yours');
    expect(unused.lines.find((l) => l.k === 'contrast')).toMatchObject({ a: e.trap!.tile, b: e.trap!.instead, diff: e.trap!.why.en });
    expect(unused.lines.find((l) => l.k === 'why')).toMatchObject({ text: e.why.en });
  });

  it('Beispiele nur aus demselben Muster, nie der Übungssatz selbst', () => {
    const pat = patternById(e.pat!)!;
    const ex = orderExamples(item);
    expect(ex.length).toBeGreaterThan(0);
    for (const x of ex) expect(pat.ex.map((y) => y.en)).toContain(x.en);
    expect(ex.map((x) => poolNorm(x.en))).not.toContain(poolNorm(item.sentence));
  });

  it('ohne Muster: keine Beispiele (lieber keines als ein falsches)', () => {
    const noPat = pool.find((x) => !x.pat)!;
    const it = buildOrder(noPat, { seed: 'np', p: 0.9 });
    expect(orderExamples(it)).toEqual([]);
    expect(orderExplanation({ item: it, lang: 'de', usedTrap: false, topicName: 'Thema', verdict: 'ok' }).source).toBe('task');
  });
});

describe('orderItemsForDay (Rundenbau aus u.gt)', () => {
  const gt = { intro: 'articles', pats: [pool.find((e) => e.topic === 'articles' && e.pat)!.pat!], topics: ['articles'] };

  it('Sätze zum Tagesthema, Fallen-Baustein nur ab p ≥ 0,4, nie ein Baustein zu viel', async () => {
    const { orderItemsForDay } = await import('../../src/features/drills/session');
    const low = orderItemsForDay(gt, 's', 6, { p: () => 0.2 })!;
    expect(low).toHaveLength(6);
    expect(low.some((i) => i.tiles.some((x) => x.distractor))).toBe(false);
    const high = orderItemsForDay(gt, 's', 6, { p: () => 0.8 })!;
    for (const it of high) {
      const e = pool.find((x) => x.en === it.sentence)!;
      expect(it.tiles.filter((x) => x.distractor)).toHaveLength(e.trap ? 1 : 0);
    }
    // vorn die Sätze mit dem Muster des Tages
    expect(high[0]!.pat).toBe(gt.pats[0]);
  });

  it('der Vorrat von Claude wird nur angetastet, wenn entfernte Plätze frei sind', async () => {
    const { orderItemsForDay } = await import('../../src/features/drills/session');
    let asked = 0;
    const takeExtra = (max: number) => {
      asked++;
      return max > 0 ? [] : [];
    };
    // Thema mit vielen Sätzen: genug Nähe, kein Zugriff auf den Vorrat
    const many = pool.reduce<Record<string, number>>((m, e) => ({ ...m, [e.topic]: (m[e.topic] ?? 0) + 1 }), {});
    const rich = Object.entries(many).sort((a, b) => b[1] - a[1])[0]![0];
    expect(orderItemsForDay({ intro: rich, pats: [], topics: [rich] }, 'r', 4, { takeExtra })).toHaveLength(4);
    expect(asked).toBe(0);
  });

  it('ein Plan ohne Thema liefert null (dann gilt der bisherige Pool)', async () => {
    const { orderItemsForDay } = await import('../../src/features/drills/session');
    expect(orderItemsForDay({ intro: null, pats: [], topics: [] }, 'x', 6)).toBeNull();
  });
});
