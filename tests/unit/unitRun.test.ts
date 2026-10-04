import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaDef } from '../../src/app/registry';
import type { UnitCtx } from '../../src/app/unit/types';
import { createWriter, type Writer } from '../../src/data/writer';
import type { StoredPlan } from '../../src/domain/plan/types';
import type * as PlanModule from '../../src/domain/week/plan';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { berlin } from './helpers';

// Prüfbefunde Tageseinheit (Runde A): Pflicht über 04:00, Fortsetzen statt Neustart,
// Block 2 mit Nachsprechen. Erfundene Daten, nachgebildete Anbieter und Fortsetz-Verträge.

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const storage = new MemStorage();

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, legacyPlan: false }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
// Seit 04.10.2026 plant `unitPlanFor` nur noch Wortschatz · Grammatik · Satzbau · Fehler korrigieren.
// Die Ablauf-Logik für ältere Pläne (Sprechaufgabe in Block 3, Block 2 = Input → Nachsprechen) gibt es
// weiter; damit sie geprüft bleibt, liefert der Planer hier auf Wunsch den früheren Montagsplan.
vi.mock('../../src/domain/week/plan', async (importOriginal) => {
  const real = await importOriginal<typeof PlanModule>();
  type Plan = ReturnType<typeof real.unitPlanFor>;
  type Block = Plan['blocks'][number];
  const legacy = (p: Plan): Plan => {
    if (p.shape !== 'full') return p;
    const blocks: Block[] = [
      ...p.blocks.filter((b) => b.block === 1),
      { block: 2, kind: 'input.read', steps: ['input.read', 'pron.shadow'], opts: { src: 'theme-text' }, min: 5, channel: 'ch:u-in' },
      { block: 3, kind: 'task.say', steps: ['task.say'], opts: {}, min: 9, channel: 'ch:u-task' },
      { block: 4, kind: 'focus', steps: ['focus'], opts: {}, min: 3, channel: 'ch:u-focus' },
      { block: 5, kind: 'again', steps: ['again'], opts: {}, min: 2, channel: 'ch:u-again' },
    ];
    return { ...p, blocks, duty: blocks.map((b) => b.channel), minutes: blocks.reduce((sum, b) => sum + b.min, 0) };
  };
  return { ...real, unitPlanFor: (...a: Parameters<typeof real.unitPlanFor>): Plan => (holder.legacyPlan ? legacy(real.unitPlanFor(...a)) : real.unitPlanFor(...a)) };
});

const { installAreas } = await import('../../src/app/registry');
const { useClock } = await import('../../src/app/clock');
const { useNav } = await import('../../src/app/nav');
const { saveResume, clearResume } = await import('../../src/app/resume');
const { useLive } = await import('../../src/data/live');
const { buildUnitStored } = await import('../../src/domain/unit/plan');
const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const run = await import('../../src/features/unit/run');
const { EMPTY_RUN, useUnitRun } = await import('../../src/features/unit/runStore');

const Empty = () => null;
const sayStart = vi.fn((ctx: UnitCtx) => ({ name: 'say' as const, unit: ctx.block }));
const shadowStart = vi.fn((ctx: UnitCtx) => {
  void ctx;
  return { name: 'pron' as const, kind: 'shadow' as const };
});
const restored: unknown[] = [];

const AREA: AreaDef = {
  id: 'test',
  screens: {
    unitCard: { kind: 'exercise', component: Empty },
    say: { kind: 'exercise', component: Empty },
    pron: { kind: 'exercise', component: Empty },
    inputUnit: { kind: 'exercise', component: Empty },
  },
  unitBlocks: [
    { kind: 'task.say', feasible: () => true, start: sayStart },
    { kind: 'pron.shadow', feasible: () => true, start: shadowStart },
  ],
  resumables: [
    {
      id: 'fakeSay',
      version: 1,
      origin: 'speak',
      snapshot: () => null,
      subscribe: () => () => undefined,
      restore: (s: unknown) => {
        restored.push(s);
        return true;
      },
      route: () => ({ name: 'say' }),
      label: () => '',
    },
  ],
};

const plan = (d: string, duty: StoredPlan['duty']): StoredPlan => ({ d, ids: [], why: [], v: 1, duty, goal: { review: 0 }, lesson: null, at: 0 });
const baseProfile = (): Doc => ({ days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 });

let h: MemoryDbHandle;
const setup = (seed: Record<string, Doc>) => {
  h = createMemoryDb({ seed });
  holder.writer = createWriter(h.db);
};
const profile = () => h.dump()['app/profile'] as Doc;
const actOf = (day: string) => (profile().act as Record<string, Doc | undefined>)[day];

beforeAll(() => {
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
  installAreas([AREA]);
});

beforeEach(() => {
  storage.clear();
  restored.length = 0;
  sayStart.mockClear();
  shadowStart.mockClear();
  persist.resetPersistForTests();
  store.resetTodayForTests();
  run.resetUnitRunForTests();
  useLive.setState({ day: null, docs: {}, collections: {} });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  holder.writer = null;
});

describe('Befund 1: Block über 04:00 zählt für den Lerntag, an dem er begann', () => {
  const D = '2026-10-06';
  const D2 = '2026-10-07';

  it('vor 04:00 begonnen, danach beendet → act[Vortag] und pflicht[Vortag], nichts am neuen Tag', async () => {
    setup({ 'app/profile': { ...baseProfile(), days: { [D]: 8 } } });
    store.useTodayPlan.setState({ day: D, plan: plan(D, ['ch:u-task']), status: 'ready', exhausted: null });
    // 04:20: neuer Lerntag mit eigenem Plan (noch ohne Einheit).
    store.useTodayPlan.setState({ day: D2, plan: plan(D2, ['ch:u-task']), status: 'ready', exhausted: null });
    useClock.setState({ today: D2, now: berlin(D2, 4, 20) });
    useUnitRun.setState({ ...EMPTY_RUN, day: D, block: 3, duty: 'ch:u-task', kind: 'task.say', via: 'say', routeName: 'say', route: { name: 'say' } }, true);
    run.handleUnitDone(3);
    await vi.waitFor(() => expect((profile().pflicht as Doc | undefined)?.[D]).toBe(1));
    expect(actOf(D)).toEqual({ 'u-task': 1 });
    expect(actOf(D2)).toBeUndefined();
  });
});

describe('Tageseinheit mit gespeichertem Plan (älteres Format mit Sprechaufgabe und Input-Block)', () => {
  const MON = '2026-09-28';
  const unitPlan = () => buildUnitStored({ day: MON, nowMs: berlin(MON, 9), week: null, goalMin: 25, review: { goal: 12, due: 8, fresh: 3, repairs: 1 } });

  afterEach(() => {
    holder.legacyPlan = false;
  });

  beforeEach(() => {
    holder.legacyPlan = true;
    setup({ 'app/profile': { ...baseProfile(), days: { [MON]: 8 } } });
    useClock.setState({ today: MON, now: berlin(MON, 9) });
    store.useTodayPlan.setState({ day: MON, plan: unitPlan(), status: 'ready', exhausted: null });
  });

  it('Befund 2: unterbrochener Block wird fortgesetzt (Stand der Übung), ohne gesicherten Stand neu gestartet', () => {
    const u = run.unitNow();
    const row = u?.rows.find((r) => r.id === 'ch:u-task');
    expect(u && row).toBeTruthy();
    if (!u || !row) return;
    const api = { focusNow: () => undefined, blur: () => undefined };
    // Block 3 lief (Anbieter), dann ✕: Stand der Übung und der Einheit liegen lokal.
    const route = { name: 'say' as const, unit: 3 };
    useUnitRun.setState({ ...EMPTY_RUN, day: MON, block: 3, duty: 'ch:u-task', kind: 'task.say', via: 'provider', routeName: 'say', route, at: 1000 }, true);
    saveResume({ v: 1, id: 'fakeSay', day: MON, savedAt: 2000, tabId: 't', route, data: { pos: 3, draft: 'I would' } });
    run.startRow(u, row, api);
    expect(restored).toEqual([{ pos: 3, draft: 'I would' }]);
    expect(sayStart).not.toHaveBeenCalled();
    expect(useNav.getState().route).toMatchObject({ name: 'say' });
    // Auch nach dem Neuladen (Lauf nur noch in `lx:resume:unit`).
    restored.length = 0;
    saveResume({ v: 1, id: 'unit', day: MON, savedAt: 2000, tabId: 't', route, data: { ...useUnitRun.getState() } });
    run.resetUnitRunForTests();
    run.startRow(u, row, api);
    expect(restored).toHaveLength(1);
    expect(sayStart).not.toHaveBeenCalled();
    expect(useUnitRun.getState()).toMatchObject({ day: MON, duty: 'ch:u-task', via: 'provider' });
    // Ohne gesicherten Stand der Übung: neu starten.
    clearResume('fakeSay');
    run.startRow(u, row, api);
    expect(sayStart).toHaveBeenCalledTimes(1);
  });

  it('Befund 3: Block 2 – nach dem Input startet das Nachsprechen, erst danach zählt der Block', async () => {
    useUnitRun.setState({ ...EMPTY_RUN, day: MON, block: 2, duty: 'ch:u-in', kind: 'input.read', via: 'provider', routeName: 'inputUnit', route: { name: 'inputUnit', day: MON, kind: 'read', ref: 'theme:x-t01' }, at: 1 }, true);
    run.rememberInput(['First sentence.', 'Second sentence.', 'Third sentence.'], ['walk me through']);
    run.handleUnitDone(2);
    expect(shadowStart).toHaveBeenCalledTimes(1);
    expect(shadowStart.mock.calls[0]?.[0].sentences).toEqual(['First sentence.', 'Second sentence.', 'Third sentence.']);
    expect(useUnitRun.getState().kind).toBe('pron.shadow');
    expect(useNav.getState().route).toMatchObject({ name: 'pron' });
    await persist.flush();
    expect(actOf(MON)?.['u-in']).toBeUndefined();
    // Nachsprechen fertig → Block zählt, Zwischenkarte.
    run.handleUnitDone(2);
    expect(shadowStart).toHaveBeenCalledTimes(1);
    expect(useNav.getState().route).toMatchObject({ name: 'unitCard', step: 'next' });
    await vi.waitFor(() => expect(actOf(MON)?.['u-in']).toBe(1));
  });
});

describe('Tageseinheit seit 04.10.2026 (Vokabeln und Grammatik)', () => {
  const MON = '2026-09-28';

  it('Montag: Zeilen Grammatik und Satzbau, kein Input; Grammatik-Block zählt ohne Folgeschritt', async () => {
    setup({ 'app/profile': { ...baseProfile(), days: { [MON]: 8 } } });
    useClock.setState({ today: MON, now: berlin(MON, 9) });
    const stored = buildUnitStored({ day: MON, nowMs: berlin(MON, 9), week: null, goalMin: 25, review: { goal: 12, due: 8, fresh: 3, repairs: 1 } });
    store.useTodayPlan.setState({ day: MON, plan: stored, status: 'ready', exhausted: null });
    const u = run.unitNow();
    expect(u?.rows.map((r) => r.id)).toEqual(['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again']);
    expect(u?.up.blocks.find((b) => b.block === 3)?.kind).toBe('task.order');
    useUnitRun.setState({ ...EMPTY_RUN, day: MON, block: 2, duty: 'ch:u-focus', kind: 'grammar', via: 'provider', routeName: 'unitFocus', route: { name: 'unitFocus' }, at: 1 }, true);
    run.handleUnitDone(2);
    expect(shadowStart).not.toHaveBeenCalled();
    expect(useNav.getState().route).toMatchObject({ name: 'unitCard', step: 'next' });
    await vi.waitFor(() => expect(actOf(MON)?.['u-focus']).toBe(1));
  });
});
