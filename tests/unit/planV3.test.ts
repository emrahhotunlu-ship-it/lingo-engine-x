import { describe, expect, it } from 'vitest';
import { readPlan } from '../../src/domain/plan/buildPlan';
import { forFocus } from '../../src/domain/plan/retire';
import { unitRows } from '../../src/domain/unit/rows';
import { buildUnitStored, unitPlanOf, unitStep3 } from '../../src/domain/unit/plan';
import type { StoredPlan } from '../../src/domain/plan/types';

// Plan 3.0 (Lernplattform 3.0 §2.1, §2.4, P23): Format von Schritt 3 und Check-Tag werden beim Anlegen eingefroren; alles ergänzend.

const NOW = Date.parse('2026-10-05T10:00:00+02:00');
const review = { goal: 30, due: 25, fresh: 3, repairs: 0, sec: 470, overdue: 4 };
const base = { nowMs: NOW, week: null, goalMin: 25, review, fixDue: 8, rv: 2 as const };
const rowsOfPlanForTest = (p: StoredPlan) => unitRows(p, p.duty.map((id) => ({ id, state: 'open' as const, progress: null }))) ?? [];
const OCL = { mode: 'format' as const, fmt: 'ocl' as const };

describe('Schritt 3 trägt das Format im 4. Tupel-Element', () => {
  it('Dienstag: Block 3 bleibt Satzbau-Blockart und trägt {mode, fmt}; Dauer und Pflicht unverändert', () => {
    const plain = buildUnitStored({ ...base, day: '2026-10-06' });
    const fmt = buildUnitStored({ ...base, day: '2026-10-06', step3: OCL });
    expect(fmt.duty).toEqual(plain.duty);
    expect(fmt.u!.min).toBe(plain.u!.min);
    const b3 = fmt.u!.b.find(([b]) => b === 3)!;
    expect(b3[1]).toBe('task.order');
    expect(b3[3]).toEqual(OCL);
    expect(plain.u!.b.find(([b]) => b === 3)![3]).toBeUndefined();
    expect(unitStep3(fmt)).toEqual(OCL);
    expect(unitStep3(plain)).toBeNull();
  });
  it('Tempo-Runde am Samstag steht als {mode: tempo}', () => {
    const sat = buildUnitStored({ ...base, day: '2026-10-10', step3: { mode: 'tempo' } });
    expect(unitStep3(sat)).toEqual({ mode: 'tempo' });
    expect(sat.u!.shape).toBe('sat');
  });
  it('kurze Tage, Sonntag und Wiedereinstieg haben keinen Schritt 3 und damit kein Format', () => {
    for (const [day, goalMin, comeback] of [['2026-10-06', 15, undefined], ['2026-10-06', 10, undefined], ['2026-10-11', 25, undefined], ['2026-10-06', 25, 'reduced'], ['2026-10-06', 25, 'restart']] as const) {
      const p = buildUnitStored({ ...base, day, goalMin, step3: OCL, ...(comeback ? { comeback } : {}) });
      expect(p.u!.b.some(([b]) => b === 3 && p.u!.shape !== 'sun'), `${day} ${goalMin} ${comeback ?? ''}`).toBe(false);
      expect(unitStep3(p)).toBeNull();
    }
  });
  it('Regelversion 1 schreibt nie ein Format, Check oder Ziel', () => {
    const p = buildUnitStored({ ...base, rv: 1, day: '2026-10-06', step3: OCL, c1: 'check', nx: 'fest250' });
    expect(unitStep3(p)).toBeNull();
    expect(p.u!.c1).toBeUndefined();
    expect(p.u!.nx).toBeUndefined();
  });
  it('die Blockliste liefert die Art fürs Heute-Kärtchen und der eingefrorene Plan behält Art und Argumente', () => {
    const p = buildUnitStored({ ...base, day: '2026-10-07', step3: { mode: 'format', fmt: 'wf' } });
    const up = unitPlanOf(p as StoredPlan & { u: NonNullable<StoredPlan['u']> });
    expect(up.blocks.find((b) => b.block === 3)?.args).toEqual({ mode: 'format', fmt: 'wf' });
    expect(rowsOfPlanForTest(p).find((r) => r.block === 3)?.fmt).toBe('wf');
    expect(rowsOfPlanForTest(buildUnitStored({ ...base, day: '2026-10-05' })).find((r) => r.block === 3)?.fmt).toBeUndefined();
  });
});

describe('Check-Tag und Ziel (u.c1, u.nx)', () => {
  it('nur der volle Samstag trägt den Check; Block 2 und 3 stehen als Alternative im selben Plan, Pflicht und Minuten unverändert', () => {
    const plain = buildUnitStored({ ...base, day: '2026-10-31' });
    const chk = buildUnitStored({ ...base, day: '2026-10-31', c1: 'check' });
    expect(chk.u!.c1).toBe('check');
    expect(chk.duty).toEqual(plain.duty);
    expect(chk.duty).toContain('ch:u-focus');
    expect(chk.duty).toContain('ch:u-task');
    expect(chk.u!.b).toEqual(plain.u!.b);
    expect(chk.u!.min).toBe(plain.u!.min);
    const wd = buildUnitStored({ ...base, day: '2026-10-30', c1: 'check' });
    expect(wd.u!.c1).toBeUndefined();
  });
  it('nächstes Ziel: Kennung wird eingefroren, lang genug aber nie über 24 Zeichen', () => {
    const p = buildUnitStored({ ...base, day: '2026-10-06', nx: 'fest250' });
    expect(p.u!.nx).toBe('fest250');
    const stored = JSON.parse(JSON.stringify(p)) as unknown;
    expect(readPlan(stored, '2026-10-06')!.u!.nx).toBe('fest250');
    const bad = JSON.parse(JSON.stringify(p)) as { u: { nx: string } };
    bad.u.nx = 'x'.repeat(30);
    expect(readPlan(bad, '2026-10-06')!.u!.nx).toBeUndefined();
    bad.u.nx = 'Ziel mit Leerzeichen';
    expect(readPlan(bad, '2026-10-06')!.u!.nx).toBeUndefined();
  });
});

describe('Eingefroren: ein später fällig werdender Check ändert den Plan von heute nie', () => {
  it('der gespeicherte Samstagsplan ohne Check bleibt nach dem Lesen ohne Check', () => {
    const saved = JSON.parse(JSON.stringify(buildUnitStored({ ...base, day: '2026-10-31', step3: undefined }))) as unknown;
    const again = readPlan(saved, '2026-10-31')!;
    expect(again.u!.c1).toBeUndefined();
    expect(unitStep3(again)).toBeNull();
    expect(forFocus(again).duty).toEqual(again.duty);
  });
  it('Lesen und Schreiben ergibt denselben Plan, auch mit allen neuen Feldern', () => {
    const p = buildUnitStored({ ...base, day: '2026-10-31', step3: { mode: 'tempo' }, c1: 'check', nx: 'c1check' });
    const rt = readPlan(JSON.parse(JSON.stringify(p)), '2026-10-31')!;
    expect(rt.u).toEqual(p.u);
  });
  it('unlesbares Format im Plan wird ignoriert, der Plan bleibt lesbar', () => {
    const p = JSON.parse(JSON.stringify(buildUnitStored({ ...base, day: '2026-10-06', step3: OCL }))) as { u: { b: unknown[][] } };
    (p.u.b.find((x) => x[0] === 3) as unknown[])[3] = { mode: 'quatsch', fmt: 'zzz' };
    const r = readPlan(p, '2026-10-06')!;
    expect(r.u!.b.find(([b]) => b === 3)).toHaveLength(3);
    expect(unitStep3(r)).toBeNull();
  });
});
