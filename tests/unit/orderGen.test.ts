import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFailure } from '../../src/ai/types';
import { ORDER_TOPICS, acceptGenerated, orderPool, poolNorm, poolSentenceKeys } from '../../src/domain/drills/orderPool';
import { buildOrder } from '../../src/domain/drills/order';
import { orderGenReply } from '../../src/platform/dev/cannedReplies';
import { ORDER_GEN_EXAMPLE, orderGen } from '../../src/prompts/orderGen';

// Satzbau mit Sätzen von Claude (Emrah 02.10.2026): Prüfregeln, tolerantes Lesen, Vorrat im Hintergrund, Rundenmischung.

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
}

const askJson = vi.fn();
vi.mock('../../src/ai/gate', () => ({ askJson: (...a: unknown[]) => askJson(...a) }));

const none = new Set<string>();
const parse = (text: string): unknown[] => (JSON.parse(text) as { items: unknown[] }).items;
const read = (raw: unknown): unknown[] => (orderGen.schema({ topics: [], words: [], avoid: [], n: 6 }).parse(raw) as { items: unknown[] }).items;

const GOOD = {
  topic: 'c1-precision',
  en: 'We can set up the Zebra test within two weeks.',
  de: 'Wir können den Zebra-Test innerhalb von zwei Wochen einrichten.',
  chunks: ['we', 'can', 'set up', 'the Zebra test', 'within two weeks'],
  alt: ['Within two weeks, we can set up the Zebra test.'],
  why: ['Within two weeks heißt binnen zwei Wochen und passt nicht mit in zusammen.', 'Within two weeks means inside that period and does not combine with in.'],
};

describe('acceptGenerated – Prüfregeln', () => {
  it('Beispielantwort im Prompt besteht Schema und Prüfung', () => {
    const items = read(JSON.parse(ORDER_GEN_EXAMPLE));
    expect(items).toHaveLength(2);
    for (const it of items) expect(acceptGenerated(it, none), JSON.stringify(it)).not.toBeNull();
  });

  it('die festen Antworten des Entwicklungs-Adapters bestehen, mit Markierung „ai“', () => {
    const items = parse(orderGenReply('[order-gen@1]\nLearner vocabulary: deserve'));
    expect(items).toHaveLength(6);
    for (const it of items) expect(acceptGenerated(it, poolSentenceKeys())?.ai, JSON.stringify(it)).toBe(true);
    expect(new Set(items.map((i) => (i as { topic: string }).topic)).size).toBe(6);
  });

  it('dieselben Regeln wie der feste Pool: jeder handgeschriebene Satz besteht (ohne Dubletten-Prüfung)', () => {
    for (const e of orderPool()) {
      const raw = { topic: e.topic, en: e.en, de: e.de, chunks: [...e.chunks], ...(e.alt.length ? { alt: [...e.alt] } : { single: e.single }), why: [e.why.de, e.why.en], ...(e.bad ? { bad: e.bad } : {}) };
      expect(acceptGenerated(raw, none), e.en).not.toBeNull();
    }
  });

  it('lehnt ab: zu wenige/zu viele Bausteine, Satz geht nicht auf, alt gleich Satz, beides oder keines von alt/single', () => {
    const bad = (over: Record<string, unknown>) => acceptGenerated({ ...GOOD, ...over }, none);
    expect(bad({})).not.toBeNull();
    expect(bad({ chunks: ['we', 'can', 'set up', 'the Zebra test'] })).toBeNull();
    expect(bad({ chunks: ['we', 'can', 'set', 'up', 'the', 'Zebra', 'test', 'within', 'two', 'weeks'] })).toBeNull();
    expect(bad({ chunks: ['we', 'can', 'set up', 'the Zebra test', 'in two weeks'] })).toBeNull();
    expect(bad({ alt: ['We can set up the Zebra test within two weeks.'] })).toBeNull();
    expect(bad({ alt: ['Within two weeks, we can set up the Zebra test.'], single: 'Only one natural order exists here.' })).toBeNull();
    expect(bad({ alt: [] })).toBeNull();
    expect(bad({ alt: ['Within two weeks we can build up the Zebra test.'] })).toBeNull();
  });

  it('lehnt ab: gerade Anführungszeichen, britische Schreibweise, Sprache, Thema, Tonlage, Schlusszeichen', () => {
    const bad = (over: Record<string, unknown>) => acceptGenerated({ ...GOOD, ...over }, none);
    expect(bad({ why: ['Within two weeks heißt "binnen zwei Wochen" und passt nicht mit in zusammen.', GOOD.why[1]] })).toBeNull();
    expect(bad({ en: 'We can organise the Zebra test within two weeks.', chunks: ['we', 'can', 'organise', 'the Zebra test', 'within two weeks'], alt: ['Within two weeks, we can organise the Zebra test.'] })).toBeNull();
    expect(bad({ de: 'We can set up the Zebra test within two weeks.' })).toBeNull();
    expect(bad({ why: [GOOD.why[0], 'Within two weeks heißt binnen zwei Wochen und passt nicht mit in zusammen.'] })).toBeNull();
    expect(bad({ topic: 'c1-unknown' })).toBeNull();
    expect(bad({ topic: 'c1-hedging' })).toBeNull();
    expect(bad({ topic: 'c1-hedging', de: `${GOOD.de.slice(0, -1)}. (vorsichtig)` })).not.toBeNull();
    expect(bad({ en: 'We can set up the Zebra test within two weeks', alt: ['Within two weeks, we can set up the Zebra test'] })).toBeNull();
    expect(bad({ de: 'Wir wollen es.' })).toBeNull();
    expect(bad({ why: ['Zu kurz.', GOOD.why[1]] })).toBeNull();
  });

  it('lehnt Dubletten ab: fester Pool, zuletzt gesehen, auch über eine zweite Reihenfolge', () => {
    const pool = orderPool()[0]!;
    const dup = { topic: pool.topic, en: pool.en, de: pool.de, chunks: [...pool.chunks], ...(pool.alt.length ? { alt: [...pool.alt] } : { single: pool.single }), why: [pool.why.de, pool.why.en] };
    expect(acceptGenerated(dup, poolSentenceKeys())).toBeNull();
    expect(acceptGenerated(GOOD, new Set([poolNorm(GOOD.en)]))).toBeNull();
    expect(acceptGenerated(GOOD, new Set([poolNorm(GOOD.alt[0]!)]))).toBeNull();
  });

  it('nur bekannte Themen', () => {
    expect(ORDER_TOPICS).toHaveLength(7);
    for (const e of orderPool()) expect(ORDER_TOPICS as readonly string[]).toContain(e.topic);
  });
});

describe('order-gen – tolerantes Lesen', () => {
  it('nacktes Array, `sentences`, `alt` als Text, `why` als Objekt', () => {
    const loose = { topic: GOOD.topic, sentence: GOOD.en, german: GOOD.de, chunks: GOOD.chunks, alt: GOOD.alt[0], why: { de: GOOD.why[0], en: GOOD.why[1] } };
    for (const wrapped of [[loose], { sentences: [loose] }, { items: [loose] }, { data: [loose] }]) {
      const items = read(wrapped);
      expect(acceptGenerated(items[0], none), JSON.stringify(wrapped).slice(0, 40)).not.toBeNull();
    }
  });

  it('ein kaputter Satz reißt die anderen nicht mit (keine Schemaverletzung, kein Neuversuch)', () => {
    const items = read({ items: [GOOD, { nonsense: true }, 'text', null, { ...GOOD, chunks: ['a'] }] });
    expect(items).toHaveLength(5);
    expect(items.map((i) => acceptGenerated(i, none)).filter(Boolean)).toHaveLength(1);
  });

  it('keine Liste → Schemafehler, mehr als 8 → gekürzt', () => {
    expect(() => read({ items: 'x' })).toThrow();
    expect(() => read({ items: [] })).toThrow();
    expect(read({ items: Array.from({ length: 12 }, () => GOOD) })).toHaveLength(8);
  });

  it('Prompt: Kopfzeile, Themen, Kontext; ohne Wörter „(none)“', () => {
    const p = orderGen.build({ topics: ['c1-hedging', 'c1-emphasis'], words: ['deserve', 'roll out'], avoid: ['We need your decision by the end of Q3.'], n: 6 });
    expect(p.startsWith('[order-gen@1]')).toBe(true);
    expect(p).toContain('Topics (focus first): c1-hedging, c1-emphasis');
    expect(p).toContain('Learner vocabulary: deserve; roll out');
    expect(orderGen.build({ topics: [], words: [], avoid: [], n: 6 })).toContain('Learner vocabulary: (none)');
  });
});

describe('Vorrat im Hintergrund', () => {
  let store: typeof import('../../src/features/drills/orderGen');

  beforeEach(async () => {
    vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
    askJson.mockReset();
    store = await import('../../src/features/drills/orderGen');
    store.resetOrderGen();
  });

  const settle = () => new Promise((r) => setTimeout(r, 0));
  const ok = (items: unknown[]) => Promise.resolve({ data: { items }, tierApplied: 'default', retried: false });

  it('speichert geprüfte Sätze, danach nimmt takeStock sie heraus', async () => {
    askJson.mockReturnValue(ok(parse(orderGenReply('[order-gen@1]\nLearner vocabulary: '))));
    store.prefetchOrder(['deserve'], 1_000_000);
    await settle();
    expect(askJson).toHaveBeenCalledTimes(1);
    const call = askJson.mock.calls[0]![0] as { priority: string; vars: { words: string[]; n: number } };
    expect(call.priority).toBe('background');
    expect(call.vars.words).toEqual(['deserve']);
    expect(store.readStock()).toHaveLength(6);
    const taken = store.takeStock(3);
    expect(taken).toHaveLength(3);
    expect(taken.every((e) => e.ai === true)).toBe(true);
    expect(store.readStock()).toHaveLength(3);
  });

  it('weniger als drei bestandene Sätze: nichts gespeichert', async () => {
    askJson.mockReturnValue(ok([GOOD, { nonsense: 1 }, { nonsense: 2 }]));
    store.prefetchOrder([], 1_000_000);
    await settle();
    expect(store.readStock()).toHaveLength(0);
  });

  it('Fehler und fehlende Fähigkeit: ein Aufruf, still, Ruhezeit, danach wieder erlaubt', async () => {
    askJson.mockReturnValue(Promise.reject(new AiFailure('unavailable', 'absent', 'aiUnavailable')));
    store.prefetchOrder([], 1_000_000);
    await settle();
    store.prefetchOrder([], 1_000_000 + 60_000);
    store.prefetchOrder([], 1_000_000 + 19 * 60_000);
    await settle();
    expect(askJson).toHaveBeenCalledTimes(1);
    expect(store.readStock()).toHaveLength(0);
    askJson.mockReturnValue(ok(parse(orderGenReply('[order-gen@1]\nLearner vocabulary: '))));
    store.prefetchOrder([], 1_000_000 + 21 * 60_000);
    await settle();
    expect(askJson).toHaveBeenCalledTimes(2);
    expect(store.readStock()).toHaveLength(6);
  });

  it('genug Vorrat: keine Anfrage', async () => {
    askJson.mockReturnValue(ok(parse(orderGenReply('[order-gen@1]\nLearner vocabulary: '))));
    store.prefetchOrder([], 1_000_000);
    await settle();
    askJson.mockClear();
    store.takeStock(0);
    // 6 im Vorrat < 8: Ruhezeit hält die zweite Anfrage zurück, auch wenn der Vorrat knapp ist
    store.prefetchOrder([], 1_000_000 + 60_000);
    expect(askJson).not.toHaveBeenCalled();
  });

  it('kaputter oder manipulierter Speicher wird ignoriert; ungültige Einträge fallen beim Lesen weg', () => {
    window.localStorage.setItem('lx:orderGen:v1', '{kaputt');
    expect(store.readStock()).toEqual([]);
    window.localStorage.setItem('lx:orderGen:v1', JSON.stringify({ at: 1, items: [GOOD, { ...GOOD, en: 'Totally different words here today.' }, 42] }));
    expect(store.readStock().map((e) => e.en)).toEqual([GOOD.en]);
  });

  it('gesehene Sätze: Ringpuffer; falsche Themen: neueste zuerst, richtig nimmt heraus, „fast“ ändert nichts', () => {
    store.noteSeen(['Hello there, my friend.']);
    store.noteSeen(['Another one here.', 'Hello there, my friend.']);
    expect(store.seenSentences()).toEqual(['another one here', 'hello there my friend']);
    for (let i = 0; i < 60; i++) store.noteSeen([`Sentence number ${i}.`]);
    expect(store.seenSentences()).toHaveLength(store.SEEN_MAX);
    store.noteResult('c1-hedging', 'wrong');
    store.noteResult('c1-emphasis', 'wrong');
    store.noteResult('c1-participle', 'near');
    expect(store.wrongTopics()).toEqual(['c1-emphasis', 'c1-hedging']);
    store.noteResult('c1-emphasis', 'correct');
    expect(store.wrongTopics()).toEqual(['c1-hedging']);
  });
});

describe('orderItems – Rundenmischung', () => {
  it('ohne Vorrat: nur fester Pool, sechs verschiedene Sätze, keine Markierung', async () => {
    const { orderItems } = await import('../../src/features/drills/session');
    const items = orderItems('s1', 6);
    expect(items).toHaveLength(6);
    expect(new Set(items.map((i) => i.sentence)).size).toBe(6);
    expect(items.some((i) => i.ai)).toBe(false);
  });

  it('mit Vorrat: höchstens die Hälfte neu und markiert, der Rest aus dem Pool', async () => {
    const { orderItems } = await import('../../src/features/drills/session');
    const extra = parse(orderGenReply('[order-gen@1]\nLearner vocabulary: ')).map((r) => acceptGenerated(r, none)!);
    const items = orderItems('s2', 6, { extra });
    expect(items).toHaveLength(6);
    expect(items.filter((i) => i.ai)).toHaveLength(3);
    expect(items.filter((i) => !i.ai).every((i) => orderPool().some((e) => e.en === i.sentence))).toBe(true);
  });

  it('gesehene Sätze werden gemieden, solange genug übrig bleiben; sonst fällt es auf den ganzen Pool zurück', async () => {
    const { orderItems } = await import('../../src/features/drills/session');
    const seen = new Set(orderPool().slice(0, 40).map((e) => poolNorm(e.en)));
    const items = orderItems('s3', 6, { seen });
    expect(items.every((i) => !seen.has(poolNorm(i.sentence)))).toBe(true);
    const all = new Set(orderPool().map((e) => poolNorm(e.en)));
    expect(orderItems('s4', 6, { seen: all })).toHaveLength(6);
  });

  it('zuletzt falsches Thema bekommt bis zur Hälfte der festen Plätze, mit anderen Sätzen als zuletzt', async () => {
    const { orderItems } = await import('../../src/features/drills/session');
    const seen = new Set(orderPool().filter((e) => e.topic === 'c1-hedging').slice(0, 2).map((e) => poolNorm(e.en)));
    const items = orderItems('s5', 6, { wrong: ['c1-hedging'], seen });
    const hedging = items.filter((i) => i.key.endsWith('rules/c1-hedging'));
    expect(hedging.length).toBeGreaterThanOrEqual(3);
    expect(hedging.every((i) => !seen.has(poolNorm(i.sentence)))).toBe(true);
  });

  it('buildOrder trägt die KI-Markierung', () => {
    const e = acceptGenerated(GOOD, none)!;
    expect(buildOrder(e, { seed: 'x' }).ai).toBe(true);
    expect(buildOrder(orderPool()[0]!, { seed: 'x' }).ai).toBeUndefined();
  });
});
