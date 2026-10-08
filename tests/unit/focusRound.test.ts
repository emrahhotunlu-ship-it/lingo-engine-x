// Wochenfokus in der Pflichtrunde (Lernplattform 3.0 P50): wirkt auch bei eingefrorenem Plan (`u.gt`), aber nur für Pläne nach der Wahl.
import { describe, expect, it } from 'vitest';
import { chapters, patternsOf, topicsWithPatterns } from '../../src/domain/grammar/patterns';
import { selectRound, type RoundInput } from '../../src/domain/grammar/tasks';
import { focusFor, focusTopicOf } from '../../src/domain/progress/weekly3';

const WED = new Date('2026-10-07T10:00:00+02:00').getTime();
const DAY = 86_400_000;

function docs(): { docs: Map<string, Record<string, unknown>>; topics: string[] } {
  const m = new Map<string, Record<string, unknown>>();
  const topics: string[] = [];
  let n = 0;
  for (const ch of chapters()) {
    const topic = ch.topics.find((t) => topicsWithPatterns().includes(t) && !topics.includes(t));
    if (!topic) continue;
    const pats: Record<string, unknown> = {};
    for (const p of (patternsOf(topic)?.patterns ?? []).slice(0, 2)) pats[p.id] = { n: 3, c: 1, last: WED - (20 - n++) * DAY, h: 0, r: 1, k: 1, dd: [], i: '2026-09-01' };
    m.set(topic, { n: 6, c: 3, S: 5, D: 5, last: WED - DAY, pats, seen: [] });
    topics.push(topic);
  }
  return { docs: m, topics };
}

describe('Fokus-Thema bei eingefrorenem Plan', () => {
  const { docs: d, topics } = docs();
  const gt = { intro: null, pats: [] as string[], topics: topics.slice(0, 3) };
  const focusTopic = topics[4] as string;
  const base = (o: Partial<RoundInput>): RoundInput => ({ mode: 'duty', grammarDocs: d, dailyOpen: [], pool: [], nowMs: WED, size: 6, seed: 'fokus', errorsMax: 0, gt, ...o });
  const firstTopic = (o: Partial<RoundInput>): string | undefined => selectRound(base(o)).find((t) => t.errorT === null)?.topic;

  it('Plan mit gt: ohne Fokus kommen die Themen des Plans, mit Fokus steht das Fokus-Thema vorn', () => {
    expect(topics.length).toBeGreaterThan(4);
    expect(gt.topics).not.toContain(focusTopic);
    expect(selectRound(base({})).some((t) => t.topic === focusTopic)).toBe(false);
    const withFocus = selectRound(base({ focusTopic }));
    expect(firstTopic({ focusTopic })).toBe(focusTopic);
    expect(withFocus.some((t) => t.topic === focusTopic)).toBe(true);
  });

  it('Wahl vor dem Plan von heute (Plan später angelegt) → Fokus-Aufgaben; Wahl nach dem Plan → Plan unverändert', () => {
    const pat = patternsOf(focusTopic)?.patterns[0]?.id as string;
    const t = new Date('2026-10-07T09:00:00+02:00').getTime();
    const wf = [{ w: '2026-W41', a: pat, t }];
    const planLater = new Date('2026-10-07T09:30:00+02:00').getTime();
    const planEarlier = new Date('2026-10-07T08:00:00+02:00').getTime();
    const day = '2026-10-07';
    expect(firstTopic({ focusTopic: focusTopicOf(focusFor(wf, { planAt: planLater, day })) })).toBe(focusTopic);
    const same = selectRound(base({ focusTopic: focusTopicOf(focusFor(wf, { planAt: planEarlier, day })) })).map((x) => x.key);
    expect(same).toEqual(selectRound(base({})).map((x) => x.key));
  });

  it('das Thema des Tages (Einführung) bleibt: ein noch neues Fokus-Thema rückt nie vor', () => {
    const fresh = new Map(d);
    fresh.set(focusTopic, { n: 0 });
    const t = selectRound(base({ grammarDocs: fresh, focusTopic })).find((x) => x.errorT === null)?.topic;
    expect(t).not.toBe(focusTopic);
  });
});
