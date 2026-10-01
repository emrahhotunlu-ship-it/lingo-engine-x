import { describe, expect, it } from 'vitest';
import { deriveToday } from '../../src/domain/plan/buildPlan';
import { forPhone, hiddenDuties, isPhoneView, phoneHides, rawPlan } from '../../src/domain/plan/phone';
import { pflichtFor } from '../../src/domain/plan/pflicht';
import type { StoredPlan } from '../../src/domain/plan/types';
import { computeStreak, pflichtDays } from '../../src/domain/streak';
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
  it('blendet Block 3 aus (Pflichtliste, Blockliste, Minuten); der gespeicherte Plan bleibt unberührt', () => {
    const p = thursday();
    const before = JSON.stringify(p);
    const v = forPhone(p);
    expect(v.duty).toEqual(['review', 'ch:u-in', 'ch:u-focus', 'ch:u-again']);
    expect(v.u?.b.map((b) => b[1])).toEqual(['review', 'input.listen', 'focus', 'again']);
    expect(v.u?.min).toBe(18);
    expect(v.goal).toEqual(p.goal);
    expect(JSON.stringify(p)).toBe(before);
    expect(rawPlan(v)).toBe(p);
    expect(isPhoneView(v)).toBe(true);
    expect(isPhoneView(p)).toBe(false);
    expect(hiddenDuties(v)).toEqual(['ch:u-task']);
  });

  it('dieselbe Eingabe liefert dasselbe Objekt (stabile Referenz für Stores)', () => {
    const p = thursday();
    expect(forPhone(p)).toBe(forPhone(p));
  });

  it('Wochen-Check (task.check, Sonntag) bleibt Pflicht; Pläne ohne Einheit bleiben unverändert', () => {
    const s = sunday();
    expect(forPhone(s)).toBe(s);
    expect(hiddenDuties(forPhone(s))).toEqual([]);
    const old: StoredPlan = { d: day, ids: ['gram'], why: [], v: 1, duty: ['review', 'ch:gram'], goal: { review: 5 }, lesson: null, at: 1 };
    expect(forPhone(old)).toBe(old);
  });

  it('Block 3 aller Wochentage außer dem Wochen-Check wird ausgeblendet', () => {
    for (const kind of ['task.say', 'task.fluency', 'task.inbox', 'task.tones', 'task.meeting', 'task.objection', 'task.roleplay']) expect(phoneHides(3, kind), kind).toBe(true);
    expect(phoneHides(3, 'task.check')).toBe(false);
    // Block 2 (auch der Posteingang als Lese-Input), Fokus, Nochmal und Wiederholen bleiben.
    expect(phoneHides(2, 'task.inbox')).toBe(false);
    for (const [block, kind] of [[1, 'review'], [2, 'input.read'], [4, 'focus'], [5, 'again']] as const) expect(phoneHides(block, kind), kind).toBe(false);
  });

  it('Kurzform (Tagesziel ≤ 15 Min.): Wiederholen und Nochmal bleiben', () => {
    const p = thursday();
    const short: StoredPlan = { ...p, duty: ['review', 'ch:u-task', 'ch:u-again'], u: { ...p.u!, shape: 'short', b: [[1, 'review', 5], [3, 'task.say', 4], [5, 'again', 2]], min: 11 } };
    expect(forPhone(short).duty).toEqual(['review', 'ch:u-again']);
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

  it('„x von n“ und Zeilen kommen aus derselben gefilterten Liste', () => {
    const v = forPhone(thursday());
    const st = derive(v);
    expect(st.duties.total).toBe(4);
    expect(st.duties.done).toBe(4);
    expect(st.status).toBe('allDone');
    const rows = unitRows(v, st.duties.items) ?? [];
    expect(rows.map((r) => r.block)).toEqual([1, 2, 4, 5]);
    expect(rows.every((r) => r.state === 'done')).toBe(true);
  });

  it('am Handy zählt die übrige Pflicht für `pflicht[tag]` – am Laptop mit voller Liste bliebe sie offen', () => {
    const profile = { days: { [day]: 5 }, act: { [day]: act } };
    const base = { day, profile, batchActivity: false, reviewDone: true, exhausted: false, course: null, pendingLessonDay: false };
    expect(pflichtFor({ ...base, plan: forPhone(thursday()) })).toBe(true);
    expect(pflichtFor({ ...base, plan: thursday() })).toBe(false);
  });

  it('Serie: ein Handy-Tag mit gesetzter Pflicht zählt, auch ohne die Aufgabe des Tages', () => {
    const profile = { days: { [day]: 5 }, act: { [day]: act } };
    const marked = pflichtFor({ day, plan: forPhone(thursday()), profile, batchActivity: false, reviewDone: true, exhausted: false, course: null, pendingLessonDay: false });
    expect(marked).toBe(true);
    const streak = computeStreak({ days: { [day]: 5 }, xpDays: {}, pflichtSince: '2026-09-28', pflichtDone: pflichtDays({ [day]: 1 }), today: day, legacyToday: day });
    expect(streak.count).toBeGreaterThanOrEqual(1);
  });

  it('ist die Aufgabe des Tages doch erledigt (am Laptop), zählt sie auch am Handy-Plan nicht doppelt', () => {
    const st = derive(forPhone(thursday()), { act: { ...act, 'u-task': 1 } });
    expect(st.duties.total).toBe(4);
    expect(st.duties.done).toBe(4);
  });
});
