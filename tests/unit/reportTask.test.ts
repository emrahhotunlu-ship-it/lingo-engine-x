import { describe, expect, it } from 'vitest';
import { addTaskReport, isTaskReport, reportId, TASK_REPORTS_MAX } from '../../src/features/tutor/reportTask';

// UX-Neuanfang D: Kennungen gemeldeter Aufgaben in `app/c1.bad` bleiben kurz (Grenze 30 KB des Dokuments, data-guard 02.11.2026).

describe('reportId', () => {
  it('lässt kurze Kennungen unverändert', () => {
    expect(reportId('gr:g:present-perfect:3')).toBe('gr:g:present-perfect:3');
  });
  it('kürzt lange Kennungen stabil auf höchstens 32 Zeichen, verschiedene bleiben verschieden', () => {
    const a = `gr:${'a'.repeat(80)}`;
    const b = `gr:${'a'.repeat(79)}b`;
    expect(reportId(a).length).toBeLessThanOrEqual(32);
    expect(reportId(a)).toBe(reportId(a));
    expect(reportId(a)).not.toBe(reportId(b));
    expect(reportId(a).startsWith('gr:')).toBe(true);
  });
  it('300 Meldungen höchster Länge passen weit unter 30 KB; Obergrenze für Aufgaben-Meldungen', () => {
    expect(TASK_REPORTS_MAX * 35).toBeLessThan(8 * 1024);
    expect(isTaskReport('c1:x')).toBe(true);
    expect(isTaskReport('out1')).toBe(false);
  });
  it('ab der Grenze verdrängt eine neue Meldung die älteste Aufgaben-Meldung, andere Meldungen bleiben', () => {
    const bad = ['out1', ...Array.from({ length: TASK_REPORTS_MAX }, (_, i) => `gr:t${i}`)];
    const r = addTaskReport({ bad }, 'c1:neu');
    expect(r?.bad).toContain('out1');
    expect(r?.bad).not.toContain('gr:t0');
    expect(r?.bad.at(-1)).toBe('c1:neu');
    expect(r?.bad.filter(isTaskReport)).toHaveLength(TASK_REPORTS_MAX);
    expect(addTaskReport({ bad: ['gr:x'] }, 'gr:x')).toBeNull();
  });
});
