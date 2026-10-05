import { describe, expect, it } from 'vitest';
import { forFocus } from '../../src/domain/plan/retire';
import { readUnitMeta } from '../../src/domain/plan/unitMeta';
import { buildUnitStored, unitPlanOf } from '../../src/domain/unit/plan';
import { unitPlanFor } from '../../src/domain/unit/planFor';
import { berlin } from './helpers';

// Plan nach Gesamtkonzept 3.2: „Fehler korrigieren“ entfällt, wenn nichts fällig ist; Wiedereinstieg ändert die Form des Plans.
// Montag 05.10.2026, Samstag 10.10., Sonntag 11.10.

const MON = '2026-10-05';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const NOW = berlin(MON, 9);
const review = { goal: 12, due: 8, fresh: 3, repairs: 0 };
const kinds = (p: { u?: { b: Array<[number, string, number]> } }) => p.u?.b.map((b) => b[1]);
type Stored = ReturnType<typeof buildUnitStored>;
const withU = (p: Stored) => p as Stored & { u: NonNullable<Stored['u']> };

describe('Schritt „Fehler korrigieren“ entfällt ohne fällige Fehlersätze', () => {
  it('fixDue 0: Block 5 fehlt, Minuten und Pflichtliste werden neu summiert (voller Plan)', () => {
    const full = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review });
    const none = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, fixDue: 0 });
    expect(kinds(full)).toEqual(['review', 'grammar', 'task.order', 'again']);
    expect(kinds(none)).toEqual(['review', 'grammar', 'task.order']);
    expect(none.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task']);
    expect(none.u?.min).toBe((full.u?.min ?? 0) - 3);
    expect(none.duty.length).toBe(none.u?.b.length);
  });

  it('fixDue > 0 oder unbekannt: Block 5 bleibt (ältere Pläne unverändert)', () => {
    expect(kinds(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, fixDue: 4 }))).toContain('again');
    expect(kinds(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review }))).toContain('again');
  });

  it('Kurz-Plan ohne Fehlersätze: Wiederholen und Grammatik; Sonntag hat nie Block 5', () => {
    expect(kinds(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 15, review, fixDue: 0 }))).toEqual(['review', 'grammar']);
    expect(kinds(buildUnitStored({ day: SUN, nowMs: NOW, week: null, goalMin: 25, review, fixDue: 0 }))).toEqual(['review', 'task.check']);
  });

  it('der gespeicherte Plan liefert nach dem Neuladen dieselben Blöcke samt Optionen zurück', () => {
    const stored = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, fixDue: 0 });
    const up = unitPlanOf(withU(stored), null);
    expect(up.blocks.map((b) => b.kind)).toEqual(['review', 'grammar', 'task.order']);
    expect(up.blocks[1]?.opts.n).toBe(6);
    expect(up.duty).toEqual(stored.duty);
    expect(up.minutes).toBe(stored.u?.min);
  });

  it('die Pflicht-Ansicht (forFocus) lässt den Plan ohne Block 5 unverändert', () => {
    const stored = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, fixDue: 0 });
    expect(forFocus(stored)).toBe(stored);
  });
});

describe('Wiedereinstieg im Plan', () => {
  it('reduced (7–13 Tage Pause, viel überfällig): nur 3 Grammatikaufgaben, Satzbau pausiert, Wiederholen bleibt', () => {
    const p = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, comeback: 'reduced' });
    expect(kinds(p)).toEqual(['review', 'grammar', 'again']);
    expect(p.u?.cb).toBe('reduced');
    const up = unitPlanOf(withU(p), null);
    expect(up.blocks[1]?.opts.n).toBe(3);
    expect(up.minutes).toBe(p.u?.min);
    // Tagesziel 15: das Wiederholen-Budget bleibt, nur die Grammatik schrumpft auf 3 Aufgaben
    const short = unitPlanFor(MON, null, { goalMin: 15, comeback: 'reduced' });
    expect(short.reviewSec).toBe(unitPlanFor(MON, null, { goalMin: 15 }).reviewSec);
    expect(short.blocks.find((b) => b.kind === 'grammar')?.opts.n).toBe(3);
  });

  it('restart (Neustart-Woche): kleinster Plan 3 + 4 + 2 Min., auch am Sonntag und bei Tagesziel 25', () => {
    for (const day of [MON, SAT, SUN]) {
      const p = buildUnitStored({ day, nowMs: NOW, week: null, goalMin: 25, review, comeback: 'restart' });
      expect(kinds(p)).toEqual(['review', 'grammar', 'again']);
      expect(p.u?.min).toBe(9);
      expect(p.u?.cb).toBe('restart');
      const up = unitPlanOf(withU(p), null);
      expect(up.blocks.map((b) => b.kind)).toEqual(['review', 'grammar', 'again']);
      expect(up.blocks[1]?.opts.n).toBe(3);
    }
  });

  it('restart ohne fällige Fehlersätze: Wiederholen + Grammatik', () => {
    const p = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, comeback: 'restart', fixDue: 0 });
    expect(kinds(p)).toEqual(['review', 'grammar']);
    expect(p.duty).toEqual(['review', 'ch:u-focus']);
  });

  it('Morgenwerte stehen additiv im Plan und werden tolerant gelesen', () => {
    const p = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review, ov: 17, sure: 41 });
    expect(p.u?.ov).toBe(17);
    expect(p.u?.sure).toBe(41);
    expect(readUnitMeta(p.u)).toMatchObject({ ov: 17, sure: 41 });
    expect(readUnitMeta({ ...p.u, cb: 'x', ov: -1, sure: 'a' })).not.toHaveProperty('cb');
    expect(readUnitMeta({ ...p.u, ov: -1, sure: 'a' })).not.toHaveProperty('ov');
    const old = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review });
    expect(readUnitMeta(old.u)).not.toHaveProperty('ov');
  });
});
