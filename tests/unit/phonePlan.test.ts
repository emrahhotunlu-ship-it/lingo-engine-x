import { describe, expect, it } from 'vitest';
import { deriveToday } from '../../src/domain/plan/buildPlan';
import { forPhone, isPhoneView, phoneKindFor, phoneReplaces, phoneUnitPlan, rawPlan, replacedKind } from '../../src/domain/plan/phone';
import { unitPlanFor } from '../../src/domain/week';
import { pflichtFor } from '../../src/domain/plan/pflicht';
import type { StoredPlan } from '../../src/domain/plan/types';
import { computeStreak, pflichtDays } from '../../src/domain/streak';
import { LAP_GOAL, lapPatch, lapThisWeek } from '../../src/domain/unit/plan';
import { unitRows } from '../../src/domain/unit/rows';

// Handy-Ansicht des Tagesplans (Emrahs Wunsch 01.10.2026): Block 3 (Sprech-/Schreibaufgabe) ist am
// Handy nicht Pflicht, der gespeicherte Plan bleibt unberührt, die Serie bleibt sicher.

const day = '2026-10-01'; // Donnerstag
const thursday = (): StoredPlan => ({
  d: day,
  ids: [],
  why: [],
  v: 1,
  duty: ['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again'],
  goal: { review: 10, due: 6, new: 4, ahead: 0 },
  lesson: null,
  at: 1,
  u: {
    v: 1,
    shape: 'full',
    goalMin: 25,
    theme: 't01',
    min: 27,
    b: [
      [1, 'review', 8],
      [2, 'input.listen', 5],
      [3, 'task.objection', 9],
      [4, 'focus', 3],
      [5, 'again', 2],
    ],
  },
});
const sunday = (): StoredPlan => ({
  ...thursday(),
  duty: ['review', 'ch:u-check'],
  u: { v: 1, shape: 'sun', goalMin: 25, theme: 't01', min: 10, b: [[1, 'review', 5], [3, 'task.check', 5]] },
});

describe('forPhone', () => {
  it('ersetzt Block 3 durch eine kurze Handy-Übung; der gespeicherte Plan bleibt unberührt', () => {
    const p = { ...thursday(), d: '2026-09-30' }; // Mittwoch
    const before = JSON.stringify(p);
    const v = forPhone(p);
    expect(v.duty).toEqual(p.duty);
    expect(v.u?.b.map((b) => b[1])).toEqual(['review', 'input.listen', 'focus.colloc', 'focus', 'again']);
    expect(v.u?.b[2]).toEqual([3, 'focus.colloc', 6]);
    expect(v.u?.min).toBe(24);
    expect(v.goal).toEqual(p.goal);
    expect(JSON.stringify(p)).toBe(before);
    expect(rawPlan(v)).toBe(p);
    expect(isPhoneView(v)).toBe(true);
    expect(isPhoneView(p)).toBe(false);
    expect(replacedKind(v)).toBe('task.objection');
  });

  it('Donnerstag bis Samstag: Einwand-Training mit 3 kurzen Antworten; Montag bis Mittwoch: Kollokationen', () => {
    const kind = (d: string) => forPhone({ ...thursday(), d }).u?.b[2]?.[1];
    expect([kind('2026-09-28'), kind('2026-09-29'), kind('2026-09-30')]).toEqual(['focus.colloc', 'focus.colloc', 'focus.colloc']);
    expect([kind('2026-10-01'), kind('2026-10-02'), kind('2026-10-03')]).toEqual(['task.objection', 'task.objection', 'task.objection']);
    expect(phoneKindFor(1)).toBe('focus.colloc');
    expect(phoneKindFor(4)).toBe('task.objection');
  });

  it('dieselbe Eingabe liefert dasselbe Objekt (stabile Referenz für Stores)', () => {
    const p = thursday();
    expect(forPhone(p)).toBe(forPhone(p));
  });

  it('Wochen-Check (task.check, Sonntag) bleibt Pflicht; Pläne ohne Einheit bleiben unverändert', () => {
    const s = sunday();
    expect(forPhone(s)).toBe(s);
    expect(replacedKind(forPhone(s))).toBeNull();
    const old: StoredPlan = { d: day, ids: ['gram'], why: [], v: 1, duty: ['review', 'ch:gram'], goal: { review: 5 }, lesson: null, at: 1 };
    expect(forPhone(old)).toBe(old);
  });

  it('phoneReplaces: nur Block 3 außer dem Wochen-Check', () => {
    for (const kind of ['task.say', 'task.fluency', 'task.inbox', 'task.tones', 'task.meeting', 'task.objection', 'task.roleplay']) expect(phoneReplaces(3, kind), kind).toBe(true);
    expect(phoneReplaces(3, 'task.check')).toBe(false);
    expect(phoneReplaces(2, 'task.inbox')).toBe(false);
    for (const [block, kind] of [[1, 'review'], [2, 'input.read'], [4, 'focus'], [5, 'again']] as const) expect(phoneReplaces(block, kind), kind).toBe(false);
  });

  it('Kurzform und Samstag: Minuten der Handy-Übung höchstens 6', () => {
    const p = thursday();
    const short: StoredPlan = { ...p, d: '2026-09-28', duty: ['review', 'ch:u-task', 'ch:u-again'], u: { ...p.u!, shape: 'short', b: [[1, 'review', 5], [3, 'task.say', 4], [5, 'again', 2]], min: 11 } };
    expect(forPhone(short).u?.b[1]).toEqual([3, 'focus.colloc', 4]);
    const sat: StoredPlan = { ...p, d: '2026-10-03', u: { ...p.u!, shape: 'sat', b: [[1, 'review', 8], [3, 'task.roleplay', 12], [4, 'focus', 3], [5, 'again', 2]] }, duty: ['review', 'ch:u-task', 'ch:u-focus', 'ch:u-again'] };
    expect(forPhone(sat).u?.b[1]).toEqual([3, 'task.objection', 6]);
  });

  it('phoneUnitPlan ersetzt Block 3 im Einheit-Plan (Art, Schritte, Optionen, Minuten)', () => {
    // Älterer gespeicherter Plan (vor dem 04.10.2026) mit Sprechaufgabe in Block 3: am Handy weiter ersetzt.
    const base = unitPlanFor('2026-10-01', null, {});
    const old = base.blocks.filter((b) => b.block !== 3).concat({ block: 3, kind: 'task.roleplay', steps: ['task.roleplay'], opts: {}, min: 12, channel: 'ch:u-task' }).sort((a, b) => a.block - b.block);
    const up = { ...base, blocks: old, minutes: old.reduce((sum, b) => sum + b.min, 0) };
    const ph = phoneUnitPlan(up);
    const b3 = ph.blocks.find((b) => b.block === 3);
    expect(b3?.kind).toBe('task.objection');
    expect(b3?.opts).toEqual({ short: true });
    expect(b3?.min).toBe(6);
    expect(ph.duty).toEqual(up.duty);
    expect(ph.minutes).toBe(up.minutes - up.blocks.find((b) => b.block === 3)!.min + 6);
    expect(phoneUnitPlan(unitPlanFor('2026-09-27', null, {})).blocks.map((b) => b.kind)).toContain('task.check');
  });

  it('Satzbau (Block 3 seit 04.10.2026) bleibt am Handy: phoneReplaces false, Plan und Ansicht unverändert', () => {
    expect(phoneReplaces(3, 'task.order')).toBe(false);
    const up = unitPlanFor('2026-10-01', null, {});
    expect(up.blocks.find((b) => b.block === 3)?.kind).toBe('task.order');
    const ph = phoneUnitPlan(up);
    expect(ph.blocks).toEqual(up.blocks);
    expect(ph.minutes).toBe(up.minutes);
    const p = thursday();
    const order: StoredPlan = { ...p, u: { ...p.u!, b: p.u!.b.map((x) => (x[0] === 3 ? ([3, 'task.order', 5] as typeof x) : x)) } };
    expect(forPhone(order)).toBe(order);
    expect(isPhoneView(forPhone(order))).toBe(false);
  });

  it('uneinheitliche Plandaten (duty und u.b verschieden lang): unverändert statt zu raten', () => {
    const p = thursday();
    const broken: StoredPlan = { ...p, duty: ['review', 'ch:u-task'] };
    expect(forPhone(broken)).toBe(broken);
  });
});

describe('Handy-Ansicht in Zählern, Zeilen und Pflicht (Serie bleibt sicher)', () => {
  const act = { 'u-in': 1, 'u-focus': 1, 'u-again': 1 };
  const derive = (plan: StoredPlan, over: { act?: unknown; pflichtMarked?: boolean } = {}) =>
    deriveToday({ day, plan, entries: [], minutes: 12, pflichtMarked: !!over.pflichtMarked, exhausted: true, course: null, act: { [day]: over.act ?? act } });

  it('„x von n“ und Zeilen kommen aus derselben Liste: Block 3 bleibt Pflichtpunkt, nur als kurze Übung', () => {
    const v = forPhone(thursday());
    const st = derive(v);
    expect(st.duties.total).toBe(5);
    expect(st.duties.done).toBe(4);
    expect(st.status).toBe('open');
    const rows = unitRows(v, st.duties.items) ?? [];
    expect(rows.map((r) => r.block)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((r) => r.kind)).toEqual(['review', 'input.listen', 'task.objection', 'focus', 'again']);
    expect(rows.find((r) => r.block === 3)?.min).toBe(6);
  });

  it('die Handy-Übung erfüllt denselben Pflichtpunkt: danach ist der Tag fertig (`pflicht[tag]`)', () => {
    const done = { ...act, 'u-task': 1 };
    const st = derive(forPhone(thursday()), { act: done });
    expect(st.duties.done).toBe(5);
    expect(st.status).toBe('allDone');
    const profile = { days: { [day]: 5 }, act: { [day]: done } };
    const base = { day, profile, batchActivity: false, reviewDone: true, exhausted: false, course: null, pendingLessonDay: false };
    expect(pflichtFor({ ...base, plan: forPhone(thursday()) })).toBe(true);
    expect(pflichtFor({ ...base, plan: thursday() })).toBe(true);
    // Ohne die Übung bleibt die Pflicht offen – auf Handy und Laptop gleich (kein Gerät kommt billiger davon).
    const open = { ...base, profile: { days: { [day]: 5 }, act: { [day]: act } } };
    expect(pflichtFor({ ...open, plan: forPhone(thursday()) })).toBe(false);
    expect(pflichtFor({ ...open, plan: thursday() })).toBe(false);
  });

  it('Serie: ein Handy-Tag mit gesetzter Pflicht zählt', () => {
    const streak = computeStreak({ days: { [day]: 5 }, xpDays: {}, pflichtSince: '2026-09-28', pflichtDone: pflichtDays({ [day]: 1 }), today: day, legacyToday: day });
    expect(streak.count).toBeGreaterThanOrEqual(1);
  });
});

describe('Wochenbilanz der Laptop-Aufgabe', () => {
  it('lapPatch ist idempotent und zählt nur Tage dieser Woche bis heute', () => {
    expect(lapPatch({}, '2026-10-01')).toEqual({ lap: { '2026-10-01': 1 } });
    expect(lapPatch({ lap: { '2026-10-01': 1 } }, '2026-10-01')).toBeNull();
    const profile = { lap: { '2026-09-28': 1, '2026-09-30': 1, '2026-09-21': 1, '2026-10-03': 1 } };
    expect(lapThisWeek(profile, '2026-10-01')).toBe(2); // 28. und 30.; Vorwoche und Zukunft zählen nicht
    expect(lapThisWeek(null, '2026-10-01')).toBe(0);
    expect(lapThisWeek({ lap: [1] }, '2026-10-01')).toBe(0);
    expect(LAP_GOAL).toBe(2);
  });
});
