import { describe, expect, it } from 'vitest';
import feedSeed from '../../src/content/legacy/feed-seed.json';
import { flattenFeed, isOwnFeed, safeUrl } from '../../src/domain/discover/feedItems';
import { discCount, isItemDone, stepState, stepsFor } from '../../src/domain/discover/steps';
import { discPatch, genPatch } from '../../src/domain/input/records';
import { deriveToday, type DayEntry } from '../../src/domain/plan/buildPlan';
import { channelDone, channelExecutable, lastDoneDaysAgo, type ChannelEnv } from '../../src/domain/plan/inputChannels';
import { channelLogEntry } from '../../src/domain/progress/channelLog';
import { mergeLogEntries } from '../../src/domain/progress/logPatch';
import { minimalProfile, profilePatch } from '../../src/domain/progress/profilePatch';
import { unitMinutes, unitsPatch, unitXp, type UnitEnd } from '../../src/domain/progress/unitPatch';
import { radarEvents } from '../../src/domain/radar/events';
import { mergeRadar, CAT_IDS } from '../../src/domain/grammar/radar';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import type { TextError } from '../../src/domain/input/types';
import { loadSeed, SEED_ANCHOR } from './helpers';

type Doc = Record<string, unknown>;
const DAY = SEED_ANCHOR;
const read = (over: Partial<UnitEnd> = {}): UnitEnd => ({ day: DAY, act: 'read', answers: 4, right: 3, activeMs: 6 * 60_000, domain: 'work', ...over });

describe('Einheitsabschluss im Sammel-Schreibweg (Plan §3.2, F5–F9)', () => {
  const seedProfile = loadSeed()['app/profile'] as Doc;

  it('Zähler, act, minutes, mix aus frischem Stand plus Delta', () => {
    const p = unitsPatch(seedProfile, null, [read()], { deviceId: 'dev1', seq: 10 }) as Doc & {
      days: Doc;
      xpDays: Doc;
      act: Record<string, Doc>;
      minutes: Doc;
      mix: Doc;
      lxSeq: Doc;
      answers: number;
      xp: number;
    };
    const cur = seedProfile as { days: Record<string, number>; xpDays: Record<string, number>; minutes: Record<string, number>; answers: number; xp: number; act: Record<string, Record<string, number>>; mix: { work: number } };
    expect(p.days[DAY]).toBe(cur.days[DAY]! + 4);
    expect(p.answers).toBe(cur.answers + 4);
    expect(p.xpDays[DAY]).toBe(cur.xpDays[DAY]! + 3 * 10 + 3 + 15);
    expect(p.xp).toBe(cur.xp + 48);
    expect(p.act[DAY]).toEqual({ read: 1 });
    expect(p.minutes[DAY]).toBe(cur.minutes[DAY]! + 6);
    expect(p.mix).toEqual({ work: cur.mix.work + 1 });
    expect(p.lxSeq).toEqual({ dev1: 10 });
    expect(p).not.toHaveProperty('vAnswers');
    // Einmischen wie `update` erhält die übrigen act-Schlüssel des Tages.
    const merged = applyUpdate(seedProfile, p) as { act: Record<string, Record<string, number>> };
    expect(merged.act[DAY]).toMatchObject({ ...cur.act[DAY], read: 1 });
  });

  it('Texte ohne Fragen zählen nicht als Antworten (F9), aber als Einheit (xpDays > 0)', () => {
    const p = unitsPatch(minimalProfile(DAY), null, [{ day: DAY, act: 'write', answers: 0, right: 0, activeMs: 0, domain: 'life' }], { deviceId: null, seq: 1 }) as Doc & { xpDays: Doc; minutes: Doc };
    expect(p).not.toHaveProperty('days');
    expect(p.xpDays[DAY]).toBe(15);
    expect(p.minutes[DAY]).toBe(1);
    expect(unitMinutes({ activeMs: 90 * 60_000 })).toBe(30);
    expect(unitXp({ answers: 0, right: 0 })).toBe(15);
  });

  it('zweimal dieselbe Folgenummer wirkt einmal; ohne Einheiten bleibt der Phase-1-Patch unverändert', () => {
    const once = unitsPatch(seedProfile, null, [read()], { deviceId: 'dev1', seq: 10 });
    const after = applyUpdate(seedProfile, once ?? {});
    expect(unitsPatch(after, null, [read()], { deviceId: 'dev1', seq: 10 })).toBeNull();
    const base = profilePatch(seedProfile, [], [{ day: DAY, act: 'review', partial: false, n: 8, right: 7, activeMs: 120_000 }], { deviceId: 'dev1', seq: 11 });
    expect(unitsPatch(seedProfile, base, [], { deviceId: 'dev1', seq: 11 })).toBe(base);
  });

  it('mit Trainer-Deltas im selben Schreibvorgang: Werte addieren sich', () => {
    const base = profilePatch(seedProfile, [], [{ day: DAY, act: 'review', partial: false, n: 8, right: 7, activeMs: 120_000 }], { deviceId: 'd', seq: 20 }) as Doc & { xpDays: Doc; minutes: Doc };
    const both = unitsPatch(seedProfile, base, [read()], { deviceId: 'd', seq: 20 }) as Doc & { xpDays: Doc; minutes: Doc; act: Record<string, Doc> };
    expect(both.xpDays[DAY]).toBe(Number(base.xpDays[DAY]) + 48);
    expect(both.minutes[DAY]).toBe(Number(base.minutes[DAY]) + 6);
    expect(both.act[DAY]?.read).toBe(1);
    expect(typeof both.act[DAY]?.review).toBe('number');
  });

  it('Hören: listen[] im Altformat, gedeckelt auf 80, ema/n je Antwort', () => {
    const listen = { id: 'l4', level: 'B2+', n: 4, ok: 3, plays: 2, rate: 0.9, help: false, t: 1 };
    const p = unitsPatch(seedProfile, null, [{ ...read({ act: 'listen', oks: [true, true, false, true] }), listen }], { deviceId: null, seq: 1 }) as Doc & { listen: unknown[]; ema: Doc; n: Doc };
    expect(p.listen.at(-1)).toEqual(listen);
    expect(p.listen).toHaveLength((seedProfile.listen as unknown[]).length + 1);
    expect(Number(p.n.listen)).toBe(Number((seedProfile.n as Doc).listen) + 4);
    expect(p.ema.listen).not.toBe((seedProfile.ema as Doc).listen);
    const many = { ...seedProfile, listen: Array.from({ length: 80 }, (_, i) => ({ id: `x${i}`, t: i })) };
    const capped = unitsPatch(many, null, [{ ...read({ act: 'listen' }), listen }], { deviceId: null, seq: 1 }) as Doc & { listen: Array<{ id: string }> };
    expect(capped.listen).toHaveLength(80);
    expect(capped.listen[0]?.id).toBe('x1');
  });

  it('ungültiges Profil → nichts schreiben', () => {
    expect(unitsPatch({ ...seedProfile, days: 'kaputt' }, null, [read()], { deviceId: null, seq: 1 })).toBeNull();
  });
});

describe('Protokoll ohne id/k (Plan F8)', () => {
  it('Einträge von Lesen/Hören/Entdecken zählen nie als „Wiederholen"', () => {
    const e = channelLogEntry({ t: 5, ok: true, lang: 'de', type: 'read', ref: 'articles/ai1', q: 'Q'.repeat(300), given: 'a', ans: 'a', ms: 1234.4, ctx: 'duty' });
    expect(e).not.toHaveProperty('id');
    expect(e).not.toHaveProperty('k');
    expect(e.q).toHaveLength(160);
    expect(e.ctx).toBe('ch');
    const plan = { d: DAY, ids: [], why: [], v: 1 as const, duty: ['review' as const], goal: { review: 3 }, lesson: null, at: 1 };
    const rev: DayEntry[] = [{ t: 1, id: 'a', k: 'v', ok: true, ctx: 'rev' }];
    const before = deriveToday({ day: DAY, plan, entries: rev, minutes: 0 });
    const after = deriveToday({ day: DAY, plan, entries: [...rev, e, { ...e, t: 6, ctx: 'xtra' }], minutes: 0 });
    expect(after.review).toEqual(before.review);
    expect(after.balance.answers).toBe(3);
    expect(after.extra).toBe(1);
  });

  it('Doppel-Erkennung über das eindeutige t', () => {
    const a = channelLogEntry({ t: 7, ok: true, lang: 'de', type: 'listen', ref: 'r', q: 'q', given: 'g', ans: 'a', ms: 1, ctx: 'extra' });
    expect(mergeLogEntries([a], [a, { ...a, t: 8 }])).toHaveLength(2);
  });
});

describe('Kanäle (Plan §4.6): die eine Ableitung „erledigt"', () => {
  const profile = { act: { [DAY]: { read: 1, 'listen~': 1 }, '2026-09-16': { write: 2 } } };
  it('act ⊕ Puffer; begonnene Einheiten zählen nie', () => {
    expect(channelDone('read', DAY, profile)).toBe(true);
    expect(channelDone('listen', DAY, profile)).toBe(false);
    expect(channelDone('listen', DAY, profile, { listen: 1 })).toBe(true);
    expect(channelDone('write', DAY, profile)).toBe(false);
    expect(channelDone('discover', DAY, null)).toBe(false);
  });

  it('ausführbar für alle Kombinationen', () => {
    const env = (o: Partial<ChannelEnv>): ChannelEnv => ({ tts: 'ready', ai: false, lib: { read: false, listen: false }, feedOpen: 0, ...o });
    expect(channelExecutable('read', env({}))).toBe(false);
    expect(channelExecutable('read', env({ ai: true }))).toBe(true);
    expect(channelExecutable('read', env({ lib: { read: true, listen: false } }))).toBe(true);
    expect(channelExecutable('listen', env({ lib: { read: false, listen: true } }))).toBe(true);
    expect(channelExecutable('listen', env({ tts: 'novoice', lib: { read: false, listen: true } }))).toBe(false);
    expect(channelExecutable('listen', env({ tts: 'unsupported', ai: true }))).toBe(false);
    expect(channelExecutable('listen', env({ tts: 'loading', ai: true }))).toBe(true);
    expect(channelExecutable('write', env({ tts: 'unsupported' }))).toBe(true);
    expect(channelExecutable('discover', env({}))).toBe(false);
    expect(channelExecutable('discover', env({ feedOpen: 2 }))).toBe(true);
  });

  it('„zuletzt vor n Tagen" aus act', () => {
    expect(lastDoneDaysAgo('write', profile, DAY)).toBe(4);
    expect(lastDoneDaysAgo('read', profile, DAY)).toBe(0);
    expect(lastDoneDaysAgo('discover', profile, DAY)).toBeNull();
    expect(lastDoneDaysAgo('write', { act: { '2026-12-01': { write: 1 }, kaputt: { write: 1 } } }, DAY)).toBeNull();
  });
});

describe('Entdecken: Beiträge und Schritte (Plan §4.4, F12)', () => {
  const docs = [
    { id: '2026-09-20', doc: feedSeed[0] as Doc },
    { id: 'seed-1', doc: feedSeed[1] as Doc },
    { id: '2026-09-19-own-k2x9', doc: { d: '2026-09-19', items: [{ id: 'x', kind: 'article', title: 'T', gist: 'G.', url: 'javascript:alert(1)' }, { id: 'bad', kind: 'song', title: 'T', gist: 'G' }, { title: 'no id' }] } },
  ];

  it('ungültige Beiträge fallen weg, nur http(s)-Links, -own- erkannt, neueste zuerst', () => {
    const items = flattenFeed(docs, 'de');
    expect(items.map((i) => i.itemId)).not.toContain('bad');
    const own = items.find((i) => i.itemId === 'x');
    expect(own?.own).toBe(true);
    expect(own?.url).toBeNull();
    expect(items[0]?.feedId).toBe('2026-09-20');
    expect(safeUrl('https://www.ey.com/en_gl/insights')).toBe('https://www.ey.com/en_gl/insights');
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('http://localhost')).toBeNull();
    expect(isOwnFeed('2026-09-19-own-k2x9')).toBe(true);
  });

  it('listen/watch ohne Zitat und ohne Fragen, Artikel mit Fragen in der Oberflächensprache', () => {
    const items = flattenFeed(docs, 'en');
    const watch = items.find((i) => i.kind === 'watch');
    expect(watch?.excerpt).toBeNull();
    expect(watch?.questions).toEqual([]);
    expect(watch?.guide.en?.length).toBeGreaterThan(0);
    const art = items.find((i) => i.itemId === 'fed-hike-2609');
    expect(art?.questions[0]?.qLang).toBe('en');
    expect(art?.domain).toBe('work');
  });

  it('Schritte und Wiedereinstieg', () => {
    expect(stepsFor('article')).toEqual(['prep', 'take', 'check', 'use']);
    expect(stepsFor('article', false)).toEqual(['prep', 'take', 'use']);
    expect(stepsFor('watch')).toEqual(['prep', 'take', 'use']);
    const disc = { a: { prep: DAY, take: DAY }, b: { prep: DAY, take: DAY, use: DAY } };
    expect(stepState(disc, 'a', stepsFor('article')).current).toBe('check');
    expect(isItemDone(disc, { itemId: 'b', kind: 'listen', questions: [] })).toBe(true);
    expect(isItemDone(disc, { itemId: 'a', kind: 'article', questions: [] })).toBe(false);
    expect(discCount(disc)).toBe(2);
  });

  it('disc/gen nur bei Änderung', () => {
    expect(discPatch({ a: { prep: DAY } }, 'a', 'prep', '2026-09-21')).toBeNull();
    expect(discPatch({ a: { prep: DAY } }, 'a', 'take', DAY)).toEqual({ disc: { a: { take: DAY } } });
    expect(genPatch({ ar: DAY }, 'ar', DAY)).toBeNull();
    expect(genPatch(undefined, 'lp', DAY)).toEqual({ gen: { lp: DAY } });
  });
});

describe('Fehler-Radar (Plan §3.8, F10)', () => {
  const err = (orig: string, cat: TextError['cat'] = 'grammar', topic: string | null = null): TextError => ({ orig, fix: `${orig}!`, cat, topic, sev: 'minor', why: 'w', span: null });

  it('Altformat {c, s, t, q, g, a}: Kategorien der alten App, Satz mit der Stelle', () => {
    const text = 'First sentence here. We are working on it since March. Last one.';
    const e: TextError = { ...err('are working on it since', 'grammar', 'pres-perf-cont'), span: [24, 47] };
    const ev = radarEvents([e, err('x', 'grammar', 'unbekannt'), err('y', 'vocabulary'), err('z', 'word-order'), err('p', 'grammar', 'passive')], text, 'w', 100);
    expect(ev[0]).toEqual({ c: 'tense', s: 'w', t: 100, q: 'We are working on it since March.', g: 'are working on it since', a: 'are working on it since!' });
    expect(ev.map((x) => x.c)).toEqual(['tense', 'wordchoice', 'wordchoice', 'order', 'passive']);
    for (const x of ev) expect(CAT_IDS as readonly string[]).toContain(x.c);
    expect(ev.map((x) => x.t)).toEqual([100, 101, 102, 103, 104]);
  });

  it('läuft über mergeRadar der Warteschlange: ohne Doppelte, Quelle r für Lesen', () => {
    const add = radarEvents([err('a'), err('b')], 'text', 'r', 5);
    expect(add.every((x) => x.s === 'r')).toBe(true);
    expect(mergeRadar(add, add)).toHaveLength(2);
    expect(radarEvents([{ ...err(''), fix: ' ' }], 'text', 'w', 1)).toEqual([]);
  });
});
