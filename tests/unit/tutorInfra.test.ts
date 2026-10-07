import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tutorCtx, TUTOR_CTX_MAX } from '../../src/domain/tutor/ctx';
import { flagShown, noteQuality, readQuality, recordShown, resetQuality, sampleFile, shownSample, SHOWN_MAX, totalQuality } from '../../src/domain/tutor/quality';
import { registerReportSink, submitReport } from '../../src/ui/ReportSheet';

// P25: Berufsprofil-Zeile, Qualitätszähler, KI-Stichprobe, Meldung.

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
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  resetQuality();
});

describe('tutorCtx', () => {
  it('nimmt ctx2, sonst den Berufskontext, immer höchstens 300 Zeichen', () => {
    const a = tutorCtx({ ctx2: { v: 1, role: 'Sales Director', field: 'document management', who: ['CFO', 'IT lead'], sit: ['price negotiation'], terms: ['audit trail', 'archive'] } });
    expect(a).toContain('Sales Director');
    expect(a).toContain('audit trail');
    expect(tutorCtx({ ctx: 'I sell DMS software.' })).toBe('I sell DMS software.');
    expect(tutorCtx(null).length).toBeGreaterThan(5);
    const long = tutorCtx({ ctx2: { role: 'x'.repeat(500), who: Array.from({ length: 20 }, () => 'y'.repeat(100)), sit: Array.from({ length: 20 }, () => 'z'.repeat(100)) } });
    expect(long.length).toBeLessThanOrEqual(TUTOR_CTX_MAX);
  });
});

describe('Qualitätszähler und Stichprobe', () => {
  it('zählt je Vorlage und in Summe', () => {
    noteQuality('explain-answer@2', 'gen');
    noteQuality('explain-answer@2', 'gen');
    noteQuality('explain-answer@2', 'shown');
    noteQuality('c1-gen@1', 'flag');
    expect(readQuality()['explain-answer@2']).toEqual({ gen: 2, acc: 0, shown: 1, flag: 0 });
    expect(totalQuality()).toEqual({ gen: 2, acc: 0, shown: 1, flag: 1 });
  });

  it('die Stichprobe hält die letzten 30, derselbe Inhalt ersetzt sich, Meldung hängt am Inhalt', () => {
    for (let i = 0; i < 40; i++) recordShown({ id: `t${i}`, tpl: 'explain-answer@2', t: i, task: 'We ___ it.', given: 'did', text: 'x'.repeat(2000) });
    expect(shownSample()).toHaveLength(SHOWN_MAX);
    expect(shownSample()[0]?.id).toBe('t10');
    expect(shownSample()[0]?.text?.length).toBeLessThanOrEqual(600);
    recordShown({ id: 't39', tpl: 'explain-answer@2', t: 99, text: 'neu' });
    expect(shownSample()).toHaveLength(SHOWN_MAX);
    flagShown('t39', 'explain-answer@2', 'explain');
    const file = sampleFile(Date.parse('2026-10-07T10:00:00Z'));
    expect(file.name).toBe('ki-stichprobe-2026-10-07.json');
    const parsed = JSON.parse(file.data) as { v: number; items: Array<{ id: string; flag?: string }> };
    expect(parsed.v).toBe(1);
    expect(parsed.items.at(-1)).toMatchObject({ id: 't39', flag: 'explain' });
  });

  it('eine Meldung zählt, merkt sich den Grund und erreicht die angemeldeten Senken', () => {
    const got: string[] = [];
    registerReportSink((r) => got.push(`${r.tpl}|${r.id}|${r.reason}`));
    registerReportSink(() => {
      throw new Error('Senke kaputt');
    });
    recordShown({ id: 'a1', tpl: 'c1-gen@1', t: 1, text: 'Satz' });
    submitReport({ tpl: 'c1-gen@1', id: 'a1', reason: 'solution' });
    expect(got).toEqual(['c1-gen@1|a1|solution']);
    expect(readQuality()['c1-gen@1']?.flag).toBe(1);
    expect(shownSample()[0]?.flag).toBe('solution');
  });
});
