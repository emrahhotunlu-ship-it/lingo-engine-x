import { beforeEach, describe, expect, it } from 'vitest';
import { useClock } from '../../src/app/clock';
import { useLive } from '../../src/data/live';
import { checkResumable, restoreCheck } from '../../src/features/check/resume';
import { startCheck, useCheck } from '../../src/features/check/session';
import { unitResumable as unit } from '../../src/areas/heute';
import { EMPTY_RUN, useUnitRun } from '../../src/features/unit/runStore';
import { berlin, loadSeed } from './helpers';

// G3 (plan.md §4.0): je Fortsetz-Vertrag Momentaufnahme → Herstellen → gleiche Position.

const DAY = '2026-09-20';

beforeEach(() => {
  const seed = loadSeed();
  const vocab = new Map<string, Record<string, unknown>>();
  const grammar = new Map<string, Record<string, unknown>>();
  for (const [path, doc] of Object.entries(seed)) {
    if (path.startsWith('vocab/')) vocab.set(path.slice(6), doc);
    if (path.startsWith('grammar/')) grammar.set(path.slice(8), doc);
  }
  useClock.setState({ now: berlin(DAY, 21), today: DAY });
  useLive.setState({ docs: { 'app/profile': seed['app/profile'] }, collections: { vocab, grammar }, invalid: {} });
  useUnitRun.setState(EMPTY_RUN, true);
});

describe('Fortsetzen (Resumable)', () => {
  it('Wochen-Check: gleiche Aufgaben, gleiche Position, bisherige Ergebnisse', () => {
    const first = startCheck({ unit: true });
    expect(first).not.toBe('empty');
    const s = useCheck.getState();
    useCheck.setState({ pos: 2, results: [{ kind: 'g', topic: 'x', ok: true }, { kind: 'g', topic: 'y', ok: false }] });
    const snap = checkResumable.snapshot();
    expect(snap).not.toBeNull();
    const raw = JSON.parse(JSON.stringify(snap)) as NonNullable<typeof snap>;
    useCheck.setState({ active: false, pos: 0, results: [], items: [] });
    expect(restoreCheck(raw)).toBe(true);
    const r = useCheck.getState();
    expect(r.active).toBe(true);
    expect(r.unit).toBe(true);
    expect(r.items.map((i) => (i.kind === 'v' ? i.key : i.task.key)).slice(0, 3)).toEqual(s.items.map((i) => (i.kind === 'v' ? i.key : i.task.key)).slice(0, 3));
    expect(r.pos).toBe(2);
    expect(r.results).toHaveLength(2);
    expect(checkResumable.route(raw)).toEqual({ name: 'check' });
    // Anderer Lerntag → verwerfen.
    expect(restoreCheck({ ...raw, day: '2026-09-19' })).toBe(false);
  });

  it('Tageseinheit: Block, Ersatzweg und Entwurf', () => {
    useUnitRun.setState({ ...EMPTY_RUN, day: DAY, block: 5, duty: 'ch:u-again', kind: 'again', via: 'own', routeName: 'unitStep', route: { name: 'unitStep', step: 'again', block: 5 }, draft: 'I would say it differently.' }, true);
    const snap = JSON.parse(JSON.stringify(unit.snapshot())) as Parameters<typeof unit.restore>[0];
    useUnitRun.setState(EMPTY_RUN, true);
    expect(unit.restore(snap)).toBe(true);
    expect(useUnitRun.getState()).toMatchObject({ block: 5, duty: 'ch:u-again', draft: 'I would say it differently.' });
    expect(unit.route(snap)).toEqual({ name: 'unitStep', step: 'again', block: 5 });
    useClock.setState({ today: '2026-09-21' });
    expect(unit.restore(snap)).toBe(false);
  });
});
