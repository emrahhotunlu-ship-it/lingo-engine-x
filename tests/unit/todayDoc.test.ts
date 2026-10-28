import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Zustand from 'zustand';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import type { DutyId, DutyState, StoredPlan } from '../../src/domain/plan/types';
import { berlin } from './helpers';

// Startbild `app/today` (Relaunch Stufe 1 P6, docs/relaunch/stufe1-plan.md §4.3, data-guard G1–G5, N1/N2). Erfundene Daten.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
// renderToStaticMarkup liest bei zustand sonst den Anfangszustand (wie metricsGolden.test.ts).
vi.mock('zustand', async (orig) => {
  const real = await orig<typeof Zustand>();
  const { createStore } = await import('zustand/vanilla');
  const impl = (init: never) => {
    const api = createStore(init);
    api.getInitialState = api.getState;
    const hook = (sel?: (s: unknown) => unknown) => (sel ? real.useStore(api, sel) : real.useStore(api));
    Object.assign(hook, api);
    return hook;
  };
  return { ...real, create: (init?: never) => (init ? impl(init) : impl) };
});

const { LIVE_DOCS, useLive } = await import('../../src/data/live');
const { APP_DOCS } = await import('../../src/data/paths');
const todayDoc = await import('../../src/data/todayDoc');
const startDoc = await import('../../src/features/today/startDoc');
const store = await import('../../src/features/today/store');
const persist = await import('../../src/features/progress/persist');
const { HomeSkeleton } = await import('../../src/features/system/HomeSkeleton');
const { HiddenInputProvider } = await import('../../src/engine/HiddenInput');

const D = '2026-10-06';
const D2 = '2026-10-07';
const plan = (d: string, duty: StoredPlan['duty'], review = 3): StoredPlan => ({ d, ids: [], why: [], v: 1, duty, goal: { review }, lesson: null, at: 0 });
const unitPlan = (d: string): StoredPlan => ({
  ...plan(d, ['review', 'ch:u-gram', 'ch:u-order', 'ch:u-use']),
  u: {
    v: 1,
    shape: 'std',
    goalMin: 20,
    theme: '',
    min: 20,
    b: [
      [1, 'review', 6],
      [2, 'grammar', 6],
      [3, 'task.order', 4, { mode: 'format', fmt: 'kwt' }],
      [4, 'task.check', 4],
    ],
    rv: 2,
    gt: { intro: null, pats: [], topics: ['present-perfect'], ch: 3 },
  },
});
const profile = (p: StoredPlan): Doc => ({ days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0, plan: p });

let h: MemoryDbHandle;
const setup = (seed: Record<string, Doc>) => {
  h = createMemoryDb({ seed });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
};
const todayWrites = () => h.writes().filter((w) => w.path === 'app/today');
/** Plan steht, Tagesprotokoll geladen (wie nach `ensureDay`). */
const ready = (day: string, p: StoredPlan) => {
  store.useTodayPlan.setState({ day, plan: p, status: 'ready', exhausted: null });
  useLive.setState({ docs: { 'app/profile': profile(p) }, collections: {}, day: { key: day, doc: null, invalid: false } });
};

beforeEach(() => {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  startDoc.resetStartDocForTests();
  todayDoc.resetTodayDocForTests();
  useLive.setState({ day: null, docs: {}, collections: {} });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  holder.writer = null;
  holder.db = null;
});

describe('Ableitung', () => {
  const items: DutyState[] = [
    { id: 'review', state: 'done', progress: { done: 3, total: 3 } },
    { id: 'ch:u-gram', state: 'open', progress: { done: 2, total: 6 } },
    { id: 'ch:u-order', state: 'open', progress: null },
    { id: 'ch:u-use', state: 'open', progress: null },
  ];

  it('Einheit: Blöcke b1…bN in Reihenfolge, „jetzt dran“ = erster offener, Thema aus u.gt, Format-Tag mit `f`', () => {
    const doc = startDoc.deriveTodayDoc({ day: D, plan: unitPlan(D), items, at: 1 });
    expect(doc).not.toBeNull();
    const blocks = todayDoc.todayDocBlocks(doc!);
    expect(blocks.map((b) => b.st)).toEqual(['done', 'now', 'open', 'open']);
    expect(blocks.map((b) => b.id)).toEqual(['review', 'ch:u-gram', 'ch:u-order', 'ch:u-use']);
    expect(blocks[1]).toMatchObject({ n: 2, of: 6, k: 'grammar', bl: 2, m: 6 });
    expect(blocks[2]?.f).toBe('kwt');
    expect(doc!.go).toEqual({ k: 'grammar', id: 'ch:u-gram' });
    expect(doc!.th).toMatchObject({ k: 'ch', id: 'present-perfect', ch: 3 });
    expect(typeof doc!.rest).toBe('number');
    expect(doc!.ring).toBeGreaterThan(0);
    expect(doc!.ring).toBeLessThan(1);
    expect(todayDoc.todayDocFor(doc, D)).not.toBeNull();
  });

  it('alter Plan ohne `u`: Pflichtpunkte als Blöcke', () => {
    const doc = startDoc.deriveTodayDoc({ day: D, plan: plan(D, ['review', 'ch:gram']), items: [items[0]!, { id: 'ch:gram', state: 'open', progress: null }], at: 1 });
    expect(todayDoc.todayDocBlocks(doc!).map((b) => [b.k, b.st])).toEqual([
      ['review', 'done'],
      ['legacy', 'now'],
    ]);
  });

  it('≤ 2 KiB auch bei vielen Blöcken mit langen Kennungen', () => {
    const duty = Array.from({ length: 12 }, (_, k) => `ch:u-${'x'.repeat(40)}-${k}` as DutyId);
    const many: DutyState[] = duty.map((id) => ({ id, state: 'open', progress: { done: 12, total: 40 } }));
    const doc = startDoc.deriveTodayDoc({ day: D, plan: { ...unitPlan(D), duty, u: { ...unitPlan(D).u!, b: duty.map(() => [2, 'grammar', 6]) } }, items: many, at: Date.now() });
    expect(todayDoc.todayDocBytes(doc)).toBeLessThanOrEqual(todayDoc.TODAY_DOC_MAX_BYTES);
  });

  it('N2: Vergleich ohne `at`', () => {
    const a = startDoc.deriveTodayDoc({ day: D, plan: unitPlan(D), items, at: 1 }) as unknown as Doc;
    const b = startDoc.deriveTodayDoc({ day: D, plan: unitPlan(D), items, at: 999 }) as unknown as Doc;
    expect(todayDoc.sameIgnoringAt(a, b)).toBe(true);
    expect(todayDoc.sameIgnoringAt(a, { ...b, rest: 0 })).toBe(false);
  });

  it('Gültigkeit beim Zeichnen: falscher Tag, fehlend, kaputter Block, fremde Form-Version → null (Skelett)', () => {
    const doc = startDoc.deriveTodayDoc({ day: D, plan: unitPlan(D), items, at: 1 })!;
    expect(todayDoc.todayDocFor(doc, D2)).toBeNull();
    expect(todayDoc.todayDocFor(null, D)).toBeNull();
    expect(todayDoc.todayDocFor({ ...doc, v: 2 }, D)).toBeNull();
    expect(todayDoc.todayDocFor({ ...doc, b: { ...doc.b, b2: { st: 'now', id: 'ch:u-gram' } } }, D)).toBeNull();
    expect(todayDoc.todayDocFor({ ...doc, rest: 'viel' }, D)).toBeNull();
  });
});

describe('Schreiben (W1, N1, N2)', () => {
  it('ein ungültiges Dokument wird ganz ersetzt (kein Verschmelzen alter Felder)', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p), 'app/today': { v: 1, d: D, b: { b9: { st: 'now' } }, alt: 'x' } });
    ready(D, p);
    expect(await startDoc.syncTodayDoc(D, 'day')).toBe('updated');
    const stored = h.dump()['app/today'] as Doc;
    expect(stored.alt).toBeUndefined();
    expect(Object.keys(stored.b as Doc)).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(todayDoc.todayDocFor(stored, D)).not.toBeNull();
  });

  it('gleicher Inhalt (nur `at` anders) → 0 Schreibungen', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p) });
    ready(D, p);
    expect(await startDoc.syncTodayDoc(D, 'day')).toBe('created');
    for (let k = 0; k < 5; k++) expect(await startDoc.syncTodayDoc(D, 'block')).toBe('unchanged');
    expect(todayWrites()).toHaveLength(1);
  });

  it('N1: Plan steht → ensureDay-Aufrufe im selben Lerntag schreiben nichts; über 04:00 genau eine Schreibung', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p) });
    ready(D, p);
    await startDoc.syncTodayDoc(D, 'day');
    const before = todayWrites().length;
    // Uhr-Ticks und Sichtbarwerden im selben Lerntag (Plan steht): kein neuer Inhalt.
    for (const hh of [9, 12, 18, 23]) await store.ensureDay(berlin(D, hh, 30));
    await startDoc.syncTodayDoc(D, 'day');
    expect(todayWrites().length).toBe(before);
    // 04:00 am Folgetag: neuer Lerntag mit eigenem Plan, Tagesprotokoll kommt nach → genau eine Schreibung für D2.
    const p2 = unitPlan(D2);
    store.useTodayPlan.setState({ day: D2, plan: p2, status: 'ready', exhausted: null });
    useLive.setState({ docs: { 'app/profile': profile(p2) }, day: { key: D2, doc: undefined, invalid: false } });
    const waiting = startDoc.syncTodayDocForDay(D2);
    useLive.setState({ day: { key: D2, doc: null, invalid: false } });
    expect(await waiting).toBe('updated');
    await store.ensureDay(berlin(D2, 4, 5));
    await startDoc.syncTodayDoc(D2, 'day');
    expect(todayWrites().length).toBe(before + 1);
    expect((h.dump()['app/today'] as Doc).d).toBe(D2);
  });

  it('fremder Snapshot (anderes Gerät: Profil, Tagesprotokoll, app/today) → 0 eigene Schreibungen', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p) });
    ready(D, p);
    startDoc.installTodayDocRounds();
    await startDoc.syncTodayDoc(D, 'day');
    const before = h.writes().length;
    // So kommen Schnappschüsse an: live.ts legt sie in den Store. Ein anderes Gerät hat weitergelernt und ein eigenes Startbild geschrieben.
    useLive.setState({ docs: { 'app/profile': { ...profile(p), xp: 50, answers: 9 } } });
    useLive.setState({ day: { key: D, doc: { entries: [{ t: 1, k: 'v', id: 'w0', ok: true, ctx: 'rev' }] }, invalid: false } });
    todayDoc.useTodayDoc.setState({ doc: { v: 1, d: D, fremd: true } });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.writes().length - before).toBe(0);
  });

  it('ohne geladenes Tagesprotokoll oder ohne gespeicherten Plan: nichts geschrieben', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p) });
    ready(D, p);
    useLive.setState({ day: { key: D, doc: undefined, invalid: false } });
    expect(await startDoc.syncTodayDoc(D, 'day')).toBe('skipped');
    useLive.setState({ day: { key: D, doc: null, invalid: false } });
    store.useTodayPlan.setState({ status: 'local' });
    expect(await startDoc.syncTodayDoc(D, 'day')).toBe('skipped');
    expect(todayWrites()).toHaveLength(0);
  });

  it('10× neu zeichnen (Startbild im Ladezustand) → 0 Schreibungen', async () => {
    const p = unitPlan(D);
    setup({ 'app/profile': profile(p) });
    const now = Date.now();
    const day = (await import('../../src/domain/date')).dayKey(now);
    const doc = startDoc.deriveTodayDoc({ day, plan: unitPlan(day), items: [{ id: 'review', state: 'open', progress: { done: 1, total: 3 } }], at: now });
    todayDoc.useTodayDoc.setState({ status: 'done', doc: doc as unknown as Doc });
    const html: string[] = [];
    for (let k = 0; k < 10; k++) html.push(renderToStaticMarkup(createElement(HiddenInputProvider, null, createElement(HomeSkeleton))));
    expect(html[0]).toContain('data-testid="start-card"');
    expect(new Set(html).size).toBe(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.writes()).toHaveLength(0);
  });
});

describe('Lesen', () => {
  it('app/today steht in APP_DOCS, nie in LIVE_DOCS (kein Abo)', () => {
    expect(Object.keys(APP_DOCS)).toContain('app/today');
    expect((LIVE_DOCS as readonly string[]).includes('app/today')).toBe(false);
  });

  it('beim Start genau ein `get`, danach nicht noch einmal', async () => {
    setup({ 'app/today': { v: 1, d: D } });
    const get = vi.fn((path: string) => h.db.doc(path));
    const db = { doc: get } as unknown as Db;
    todayDoc.loadTodayDoc(db);
    todayDoc.loadTodayDoc(db);
    await new Promise((r) => setTimeout(r, 0));
    expect(get).toHaveBeenCalledTimes(1);
    expect(todayDoc.useTodayDoc.getState()).toMatchObject({ status: 'done', doc: { v: 1, d: D } });
    expect(h.activeSubscriptions()).toBe(0);
  });
});
