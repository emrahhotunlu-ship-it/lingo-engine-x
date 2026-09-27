import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/domain/date';
import { buildPlan, deriveToday, dutyMinutes, isPhase2Plan, readPlan, type DeriveInput } from '../../src/domain/plan/buildPlan';
import { DUTY_CHANNELS, rankChannels, weekCount, type RankInput } from '../../src/domain/plan/channels';
import type { StoredPlan } from '../../src/domain/plan/types';
import { berlin } from './helpers';

const round = { target: 22, due: 17, new: 5, ahead: 0 };
const data = { cloze: 12, order: 40, sprint: 60, vocab: 150 };
const base = (over: Partial<RankInput> = {}): RankInput => ({
  today: '2026-09-28',
  profile: { act: {}, ema: { recog: 0.7, write: 0.6, listen: 0.5, colloc: 0.65, all: 0.6 }, n: { recog: 50, write: 40, listen: 30, colloc: 25 } },
  focus: null,
  dueErrors: 0,
  dueCards: 5,
  data,
  env: { tts: true },
  ...over,
});

function plan2(i: RankInput, existing: unknown = null, lesson: { lid: string } | null = { lid: 'l07' }) {
  return buildPlan({ today: i.today, existing, round, nowMs: 1, phase2: { ranked: rankChannels(i), lesson } });
}

describe('Kanäle und Tagesplan v2', () => {
  it('P-01: 50× neu zeichnen → gleiche ids/why', () => {
    const first = plan2(base()).plan;
    for (let k = 0; k < 50; k++) {
      const p = plan2(base()).plan;
      expect(p.ids).toEqual(first.ids);
      expect(p.why).toEqual(first.why);
    }
    expect(first.duty).toEqual(['review', 'lesson', `ch:${first.ids[0]}`]);
    expect(first.goal).toMatchObject({ review: 22, due: 17, new: 5, ahead: 0 });
    expect(first.lesson).toBe('l07');
  });

  it('P-02: jede Zeile hat einen Grund (nur Schlüssel der alten App)', () => {
    const keys = new Set(['agoNever', 'agoDaysN', 'whyFocus', 'whyThin', 'whyWeakest', 'whyDue', 'whyRotation']);
    const act: Record<string, Record<string, number>> = {};
    for (let d = 0; d < 7; d++) act[addDays('2026-09-28', -d)] = { gram: 1, cloze: 1, order: 1, sprint: 1, dictate: 1, cards: 1 };
    for (const profile of [base().profile, { act, ema: {}, n: { recog: 99, write: 99, listen: 99, colloc: 99 } }]) {
      const p = plan2(base({ profile })).plan;
      expect(p.why).toHaveLength(p.ids.length);
      for (const w of p.why) {
        expect(w.length).toBeGreaterThan(0);
        for (const k of w) expect(keys.has(k[0])).toBe(true);
      }
    }
  });

  it('P-03: Pflichtkanal ∈ {gram, cloze}, nie vocab, dictate, sprint oder (seit „Sag es“) order', () => {
    const focusDictate = base({ focus: 'dictate', profile: { act: {}, ema: { listen: 0.1 }, n: { listen: 0 } } });
    const p = plan2(focusDictate).plan;
    expect(DUTY_CHANNELS).toContain(p.ids[0]);
    expect(p.ids.slice(1)).toContain('dictate');
    // Ohne genug Material für Lückenjagd und Satzbau bleibt Grammatik – immer machbar.
    const thin = plan2(base({ data: { cloze: 3, order: 2, sprint: 0, vocab: 0 }, env: { tts: false } })).plan;
    expect(thin.ids[0]).toBe('gram');
  });

  it('P-04: Wochenstrafe −6 je Tag', () => {
    const act = { '2026-09-27': { gram: 1 }, '2026-09-26': { gram: 1 }, '2026-09-25': { gram: 1 } };
    expect(weekCount(act, 'gram', '2026-09-28')).toBe(3);
    const r0 = rankChannels(base()).find((c) => c.id === 'gram')!.score;
    const r1 = rankChannels(base({ profile: { ...base().profile, act } })).find((c) => c.id === 'gram')!.score;
    expect(r1).toBeLessThan(r0);
  });

  it('P-05: über 14 Lerntage kommt jeder machbare Pflichtkanal dran, keiner öfter als 4× je Woche (zwei Pflichtkanäle seit „Sag es“)', () => {
    const act: Record<string, Record<string, number>> = {};
    const counts: Record<string, number[]> = { gram: [0, 0], cloze: [0, 0], order: [0, 0] };
    for (let d = 0; d < 14; d++) {
      const today = addDays('2026-09-28', d);
      const p = plan2(base({ today, profile: { act, ema: base().profile.ema, n: base().profile.n } })).plan;
      const ch = p.ids[0]!;
      counts[ch]![d < 7 ? 0 : 1]!++;
      act[today] = { ...(act[today] ?? {}), [ch]: 1 };
    }
    for (const ch of DUTY_CHANNELS) {
      expect(counts[ch]![0]! + counts[ch]![1]!, ch).toBeGreaterThanOrEqual(1);
      expect(counts[ch]![0], ch).toBeLessThanOrEqual(4);
      expect(counts[ch]![1], ch).toBeLessThanOrEqual(4);
    }
  });

  it('P-06: Pflicht-Minuten ≤ 30', () => {
    expect(dutyMinutes(plan2(base()).plan)).toBeLessThanOrEqual(30);
    expect(dutyMinutes(plan2(base()).plan)).toBe(27);
  });

  it('Plan von heute bleibt nach dem Update gleich; die neue Pflicht gilt ab dem nächsten Lerntag', () => {
    const t = berlin('2026-09-26', 15);
    const today = dayKey(t);
    const phase1 = buildPlan({ today, existing: null, round, nowMs: t }).plan;
    expect(isPhase2Plan(phase1)).toBe(false);
    // Update mitten am Tag: Phase-2-Bau sieht den gespeicherten Phase-1-Plan und lässt ihn stehen.
    const after = buildPlan({ today, existing: phase1, round, nowMs: t + 3600_000, phase2: { ranked: rankChannels(base({ today })), lesson: { lid: 'l07' } } });
    expect(after).toEqual({ plan: phase1, changed: false });
    // 03:59 gehört noch zum selben Lerntag.
    const night = berlin('2026-09-27', 3, 59);
    expect(buildPlan({ today: dayKey(night), existing: phase1, round, nowMs: night, phase2: { ranked: rankChannels(base({ today })), lesson: null } }).changed).toBe(false);
    // Ab 04:00: neuer Plan mit Phase-2-Pflicht.
    const next = berlin('2026-09-27', 4);
    const fresh = buildPlan({ today: dayKey(next), existing: phase1, round, nowMs: next, phase2: { ranked: rankChannels(base({ today: dayKey(next) })), lesson: { lid: 'l07' } } });
    expect(fresh.changed).toBe(true);
    expect(isPhase2Plan(fresh.plan)).toBe(true);
    expect(readPlan(fresh.plan, '2026-09-27')).toEqual(fresh.plan);
  });

  it('Altplan von heute: mit ids[0] = sprint nicht übernommen, mit Pflichtkanal übernommen', () => {
    const old = { d: '2026-09-28', ids: ['sprint', 'gram', 'order'], why: [[['whyWeakest']]] };
    const p = plan2(base(), old).plan;
    expect(p.ids[0]).not.toBe('sprint');
    const good = { d: '2026-09-28', ids: ['cloze', 'gram', 'sprint'], why: [[['agoDaysN', 4]], [['whyWeakest']], [['agoNever']]] };
    expect(plan2(base(), good).plan).toMatchObject({ ids: good.ids, why: good.why, duty: ['review', 'lesson', 'ch:cloze'] });
    // Satzbau ist seit „Sag es“ nur noch Angebot: ein Altplan mit ids[0] = order wird nicht übernommen.
    const order = { d: '2026-09-28', ids: ['order', 'gram', 'sprint'], why: [[['agoDaysN', 4]], [['whyWeakest']], [['agoNever']]] };
    expect(plan2(base(), order).plan.ids[0]).not.toBe('order');
    const listen = { d: '2026-09-28', ids: ['gram', 'listen'], why: [] };
    expect(plan2(base(), listen).plan.ids).not.toEqual(listen.ids);
  });

  it('ohne Wiederholen und ohne offene Lektion: nur der Pflichtkanal', () => {
    const p = buildPlan({ today: '2026-09-28', existing: null, round: { ...round, target: 0 }, nowMs: 1, phase2: { ranked: rankChannels(base()), lesson: null } }).plan;
    expect(p.duty).toEqual([`ch:${p.ids[0]}`]);
  });
});

describe('deriveToday v2 (P-07 Widerspruchstest)', () => {
  const plan: StoredPlan = { d: '2026-09-28', ids: ['order', 'gram', 'sprint'], why: [], v: 1, duty: ['review', 'lesson', 'ch:order'], goal: { review: 2, ch: 6 }, lesson: 'l07', at: 1 };
  const rev = (id: string) => ({ t: id.length, id, k: 'v', ok: true, ctx: 'rev' });

  it('alle 2³ Zustände × live/Puffer: Status, Zähler, missing, Häkchen und Heldenziel stimmen überein', () => {
    for (let mask = 0; mask < 8; mask++) {
      for (const where of ['live', 'pending'] as const) {
        const reviewDone = !!(mask & 1);
        const lessonDone = !!(mask & 2);
        const chDone = !!(mask & 4);
        const i: DeriveInput = {
          day: '2026-09-28',
          plan,
          entries: reviewDone ? [rev('a'), rev('bb')] : [rev('a'), { t: 9, id: 'x', k: 'v', ok: true, ctx: 'xtra' }, { t: 10, id: 'y', k: 'v', ok: true }],
          minutes: 10,
          course: lessonDone && where === 'live' ? { done: { l07: { d: '2026-09-28', t: 1 } } } : { done: {} },
          act: chDone && where === 'live' ? { '2026-09-28': { order: 1 } } : { '2026-09-28': { 'order~': 1, gram: 1 } },
          pending: {
            lessonDays: lessonDone && where === 'pending' ? ['2026-09-28'] : [],
            rounds: chDone && where === 'pending' ? [{ day: '2026-09-28', act: 'order', partial: false }] : [{ day: '2026-09-28', act: 'order', partial: true }],
          },
        };
        const s = deriveToday(i);
        const expected = [reviewDone, lessonDone, chDone];
        expect(s.duties.items.map((x) => x.state === 'done')).toEqual(expected);
        expect(s.duties.done).toBe(expected.filter(Boolean).length);
        expect(s.duties.total).toBe(3);
        expect(s.duties.missing).toEqual(plan.duty.filter((_, k) => !expected[k]));
        expect(s.status).toBe(expected.every(Boolean) ? 'allDone' : 'open');
        // Heldenziel = erster offener Punkt.
        expect(s.duties.missing[0] ?? null).toBe(plan.duty.find((_, k) => !expected[k]) ?? null);
        // xtra und Einträge ohne ctx zählen nie zur Pflicht.
        expect(s.review.done).toBe(reviewDone ? 2 : 1);
      }
    }
  });

  it('pflicht gesetzt → alles erledigt; duty leer → nothing; kein Plan → noPlan', () => {
    expect(deriveToday({ day: '2026-09-28', plan, entries: [], minutes: 0, pflichtMarked: true }).status).toBe('allDone');
    expect(deriveToday({ day: '2026-09-28', plan: { ...plan, duty: [] }, entries: [], minutes: 0 }).status).toBe('nothing');
    expect(deriveToday({ day: '2026-09-28', plan: null, entries: [], minutes: 0 }).status).toBe('noPlan');
    expect(deriveToday({ day: '2026-09-28', plan, entries: [], minutes: 0, exhausted: true }).duties.items[0]!.state).toBe('done');
  });

  it('Phase-1-Plan: Verhalten unverändert', () => {
    const p1: StoredPlan = { ...plan, ids: [], duty: ['review'], lesson: null };
    expect(deriveToday({ day: '2026-09-28', plan: p1, entries: [rev('a')], minutes: 0 })).toMatchObject({ status: 'open', review: { done: 1, total: 2 } });
    expect(deriveToday({ day: '2026-09-28', plan: p1, entries: [rev('a'), rev('bb')], minutes: 0 }).status).toBe('allDone');
  });
});
