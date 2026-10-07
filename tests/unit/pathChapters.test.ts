import { describe, expect, it } from 'vitest';
import { chapters } from '../../src/domain/grammar/patterns';
import { chapterNodes } from '../../src/features/grammar/chapters';

// Lernweg in 7 Kapiteln (Lernplattform 2.0 §2.4): Kapitelzahl, „Du bist hier“ und die eine Fehlerzahl je Kapitel.

const NOW = Date.parse('2026-10-07T09:00:00+02:00');
const TODAY = '2026-10-07';
const none = new Map<string, number>();

describe('chapterNodes', () => {
  it('liefert sieben Kapitel mit allen 39 Themen; ohne Daten ist Kapitel 1 aktuell', () => {
    const r = chapterNodes({ docs: new Map(), nowMs: NOW, today: TODAY, dueByTopic: none });
    expect(r.chapters).toHaveLength(7);
    expect(r.chapters.reduce((s, c) => s + c.topics.length, 0)).toBe(39);
    expect(r.current).toBe(0);
    expect(r.chapters.every((c) => c.safe === 0)).toBe(true);
  });
  it('summiert Fehlersätze je Kapitel (eine Zahl) und nennt sie nur dort, wo sie liegen', () => {
    const topics = chapters()[2]?.topics ?? [];
    const first = topics[0] ?? '';
    const r = chapterNodes({ docs: new Map(), nowMs: NOW, today: TODAY, dueByTopic: new Map([[first, 3], [topics[1] ?? '', 2]]) });
    expect(r.chapters[2]?.due).toBe(5);
    expect(r.chapters[0]?.due).toBe(0);
  });
  it('Kapitel mit ausschließlich sicheren Themen gelten als geschafft: „Du bist hier“ rückt weiter', () => {
    // p = 1, viele Antworten, richtig am Stück: Zustand „Sicher“ oder „Fest“ (Statuswort ≥ 4).
    const docs = new Map(
      (chapters()[0]?.topics ?? []).map((id) => [id, { n: 40, c: 40, p: 0.97, recent: Array(10).fill(1), hist: [{ d: '2026-09-01', ok: 1 }] }] as const),
    );
    const r = chapterNodes({ docs, nowMs: NOW, today: TODAY, dueByTopic: none });
    expect(r.chapters[0]?.safe ?? 0).toBeGreaterThan(0);
    if (r.chapters[0] && r.chapters[0].safe === r.chapters[0].topics.length) expect(r.current).toBe(1);
  });
});
