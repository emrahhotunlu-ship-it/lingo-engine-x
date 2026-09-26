import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/domain/date';
import { pflichtFor, pflichtSinceGate, pflichtSinceOp, pflichtSinceValue, dutiesFeasible, type PflichtInput } from '../../src/domain/plan/pflicht';
import type { StoredPlan } from '../../src/domain/plan/types';
import { profilePatch, type RoundEnd } from '../../src/domain/progress/profilePatch';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { computeStreak, pflichtDays } from '../../src/domain/streak';
import { newQuotaLeft } from '../../src/domain/srs/queue';
import type { AnswerEvent } from '../../src/domain/srs/types';
import { berlin } from './helpers';

const day = '2026-09-28';
const plan: StoredPlan = { d: day, ids: ['order', 'gram', 'sprint'], why: [], v: 1, duty: ['review', 'lesson', 'ch:order'], goal: { review: 10, ch: 6 }, lesson: 'l07', at: 1 };
const input = (over: Partial<PflichtInput> = {}): PflichtInput => ({
  day,
  plan,
  profile: { days: { [day]: 5 }, act: { [day]: { order: 1 } } },
  batchActivity: false,
  reviewDone: true,
  exhausted: false,
  course: { done: { l07: { d: day, t: 1 } } },
  pendingLessonDay: false,
  ...over,
});

describe('pflichtFor (Regel 1)', () => {
  it('(a) alle Punkte erfüllt', () => {
    expect(pflichtFor(input())).toBe(true);
    expect(pflichtFor(input({ reviewDone: false }))).toBe(false);
    expect(pflichtFor(input({ course: { done: {} } }))).toBe(false);
    expect(pflichtFor(input({ course: { done: {} }, pendingLessonDay: true }))).toBe(true);
    expect(pflichtFor(input({ profile: { days: { [day]: 5 }, act: { [day]: { 'order~': 1 } } } }))).toBe(false);
  });

  it('(b) Wiederholen erschöpft, Rest erfüllt', () => {
    expect(pflichtFor(input({ reviewDone: false, exhausted: true }))).toBe(true);
  });

  it('(c) leere Pflicht + eigene Aktivität zählt (behebt S3)', () => {
    expect(pflichtFor(input({ plan: { ...plan, duty: [] }, profile: { xpDays: { [day]: 10 } } }))).toBe(true);
  });

  it('ohne Aktivität nie; Plan eines anderen Tages nie', () => {
    expect(pflichtFor(input({ profile: { act: { [day]: { order: 1 } } } }))).toBe(false);
    expect(pflichtFor(input({ plan: { ...plan, duty: [] }, profile: {} }))).toBe(false);
    expect(pflichtFor(input({ plan: { ...plan, d: '2026-09-27' } }))).toBe(false);
    expect(pflichtFor(input({ profile: {}, batchActivity: true, pendingChannelDone: true }))).toBe(true);
  });
});

describe('pflichtSince (Regel 2)', () => {
  it('S4: nachgehende Uhr setzt nie rückwirkend – nie vor dem letzten Aktivtag', () => {
    const now = berlin('2026-09-28', 10);
    const profile = { days: { '2026-09-29': 3, '2026-09-27': 2 } };
    // Die Uhr des Geräts geht einen Tag nach; die Datenbank kennt schon Aktivität am 29.
    const clockBehind = now - 86_400_000;
    expect(pflichtSinceValue({ nowMs: clockBehind, cutover: '2026-09-26', profile })).toBe('2026-09-29');
    expect(pflichtSinceValue({ nowMs: now, cutover: '2026-09-26', profile })).toBe('2026-09-29');
    expect(pflichtSinceValue({ nowMs: now, cutover: '2026-09-26', profile: { days: { '2026-09-27': 2 } } })).toBe('2026-09-28');
    // Weit in der Zukunft liegende Schlüssel (Datenmüll) zählen nicht.
    expect(pflichtSinceValue({ nowMs: now, cutover: null, profile: { act: { '2026-12-24': {} } } })).toBe('2026-09-28');
    expect(pflichtSinceValue({ nowMs: now, cutover: '2026-09-30', profile })).toBe('2026-09-30');
  });

  it('00:30: Kalendertag der alten App ist schon weiter → dieser Tag', () => {
    const t = berlin('2026-09-29', 0, 30);
    expect(dayKey(t)).toBe('2026-09-28');
    expect(pflichtSinceValue({ nowMs: t, cutover: null, profile: {} })).toBe('2026-09-29');
  });

  it('nur mit Phase-2-Plan von heute, einmal je Datenbank, nie geändert', () => {
    const schema = { version: 1, cutover: '2026-09-26', migratedAt: 1 };
    const p1: StoredPlan = { ...plan, ids: [], duty: ['review'], lesson: null };
    expect(pflichtSinceGate({ schema, plan: p1, today: day, tts: false, ai: false })).toEqual({ ok: false, reason: 'phase1_plan' });
    expect(pflichtSinceGate({ schema, plan, today: day, tts: false, ai: false })).toEqual({ ok: true });
    expect(pflichtSinceGate({ schema, plan, today: addDays(day, 1), tts: false, ai: false })).toMatchObject({ ok: false });
    expect(pflichtSinceGate({ schema: { ...schema, pflichtSince: day }, plan, today: day, tts: false, ai: false })).toMatchObject({ ok: false, reason: 'already_set' });
    expect(pflichtSinceGate({ schema: null, plan, today: day, tts: false, ai: false })).toMatchObject({ ok: false, reason: 'no_schema' });
    expect(pflichtSinceOp({ ...schema }, day)).toEqual({ update: { pflichtSince: day } });
    expect(pflichtSinceOp({ ...schema, pflichtSince: '2026-09-27' }, day)).toBeNull();
    expect(pflichtSinceOp({ ...schema, pflichtSince: 'gestern' }, day)).toBe('conflict');
    expect(pflichtSinceOp(undefined, day)).toBeNull();
  });

  it('Pflicht immer erfüllbar ohne KI und Sprachausgabe', () => {
    expect(dutiesFeasible(plan, { tts: false, ai: false })).toBe(true);
    expect(dutiesFeasible({ ...plan, duty: ['review', 'ch:dictate'] }, { tts: false, ai: false })).toBe(false);
    expect(dutiesFeasible({ ...plan, duty: ['ch:cloze'] }, { tts: false, ai: false }, { cloze: 3, order: 10 })).toBe(false);
  });
});

describe('Serie über die Einführung der Pflicht (Regressionen)', () => {
  it('S2/S3: Tage mit leerer Pflicht und Übung zählen weiter; Serie bleibt ≥ vorher', () => {
    const days: Record<string, number> = {};
    for (let k = 1; k <= 17; k++) days[addDays(day, -k)] = 3;
    const before = computeStreak({ days, today: day });
    expect(before.count).toBe(17);
    // pflichtSince = heute; heute leere Pflicht + Übung → pflicht[heute] gesetzt (Regel 1c).
    const set = pflichtFor(input({ plan: { ...plan, duty: [] }, profile: { days: { ...days, [day]: 2 } } }));
    expect(set).toBe(true);
    const after = computeStreak({ days: { ...days, [day]: 2 }, today: day, pflichtSince: day, pflichtDone: pflichtDays({ [day]: 1 }) });
    expect(after.count).toBe(18);
    // Folgetag mit leerer Pflicht und Übung: zählt ebenso.
    const next = addDays(day, 1);
    const after2 = computeStreak({ days: { ...days, [day]: 2, [next]: 1 }, today: next, pflichtSince: day, pflichtDone: pflichtDays({ [day]: 1, [next]: 1 }) });
    expect(after2.count).toBe(19);
  });
});

describe('profilePatch v2', () => {
  const t0 = berlin('2026-09-28', 10);
  const profile = { days: {}, xpDays: {}, minutes: {}, act: {}, answers: 10, vAnswers: 8, gAnswers: 2, xp: 100, ema: { write: 0.5, all: 0.55 }, n: { write: 3 }, sprints: [], lxSeq: { old: t0 - 20 * 86_400_000, fresh: t0 - 86_400_000 } };

  it('gAnswers, act-Schlüssel mit ~, ema/n-Zuordnung, XP-Boni', () => {
    const rounds: RoundEnd[] = [
      { day, act: 'gram', partial: false, n: 8, right: 6, activeMs: 300_000 },
      { day, act: 'order', partial: true, n: 2, right: 1, activeMs: 60_000 },
      { day, act: 'lesson', partial: false, n: 12, right: 10, activeMs: 720_000, lessonAi: true },
      { day, act: 'cloze', partial: false, n: 8, right: 8, activeMs: 300_000 },
    ];
    const counts = [
      { day, kind: 'g' as const, channel: 'write' as const, ok: true },
      { day, kind: 'g' as const, channel: null, ok: false },
      { day, kind: 'v' as const, channel: 'colloc' as const, ok: true },
    ];
    const p = profilePatch(profile, [], rounds, { deviceId: 'tab1', seq: t0, counts, pruneSeqBefore: t0 - 14 * 86_400_000 })!;
    expect(p).toMatchObject({ answers: 13, gAnswers: 4, vAnswers: 9, act: { [day]: { gram: 1, 'order~': 1, lesson: 1, cloze: 1 } }, lxSeq: { tab1: t0, old: null } });
    expect((p.lxSeq as Record<string, unknown>).fresh).toBeUndefined();
    expect((p.n as Record<string, number>).write).toBe(4);
    expect((p.n as Record<string, number>).colloc).toBe(1);
    expect(p.days).toEqual({ [day]: 3 });
    // XP: 10 + 3 + 10 (Antworten) + 20 (gram) + 12 (order 1 richtig) + 40 (Lektion + KI) + 8·12 + 20 (cloze, alle richtig)
    expect(p.xp).toBe(100 + 23 + 20 + 12 + 40 + 116);
    expect(p).not.toHaveProperty('history');
    expect(p).not.toHaveProperty('canDo');
  });

  it('sprints höchstens 60; gleiche seq → nichts; W1: Wiederholung mit derselben seq wirkt einmal', () => {
    const sprints = Array.from({ length: 60 }, (_, i) => ({ t: i, score: 1, ok: 1, n: 1, avgMs: 1, combo: 1 }));
    const cur = { ...profile, sprints };
    const r: RoundEnd = { day, act: 'sprint', partial: false, n: 20, right: 15, activeMs: 90_000, sprintScore: 200 };
    const p = profilePatch(cur, [], [r], { deviceId: 'tab1', seq: t0, sprints: [{ t: t0, score: 200, ok: 15, n: 20, avgMs: 900, combo: 6 }] })!;
    expect((p.sprints as unknown[]).length).toBe(60);
    expect(p.xp).toBe(100 + 50);
    const after = applyUpdate(cur, p);
    // Das scheinbar gescheiterte update war doch angekommen: derselbe Stapel noch einmal → nichts.
    expect(profilePatch(after, [], [r], { deviceId: 'tab1', seq: t0, sprints: [{ t: t0, score: 200, ok: 15, n: 20, avgMs: 900, combo: 6 }] })).toBeNull();
    // Anderer Tab mit eigener Kennung wird nicht verworfen.
    expect(profilePatch(after, [], [r], { deviceId: 'tab2', seq: t0 - 5 })).not.toBeNull();
  });

  it('pflicht nur setzen, wenn noch nicht gesetzt – auch ohne weitere Deltas (Selbstheilung)', () => {
    expect(profilePatch(profile, [], [], { deviceId: 'tab1', seq: t0, pflichtDay: day })).toEqual({ pflicht: { [day]: 1 } });
    expect(profilePatch({ ...profile, pflicht: { [day]: 1 } }, [], [], { deviceId: 'tab1', seq: t0, pflichtDay: day })).toBeNull();
    const a: AnswerEvent = { t: t0, day, kind: 'v', id: 'w', ex: 'type', grade: 3, given: 'x', ans: 'x', ms: 1, lang: 'de', ctx: 'rev' };
    const applied = { ...profile, lxSeq: { tab1: t0 } };
    expect(profilePatch(applied, [a], [], { deviceId: 'tab1', seq: t0, pflichtDay: day })).toEqual({ pflicht: { [day]: 1 } });
  });
});

describe('K-04: Lektionswörter verdrängen nie alle eigenen neuen Karten (D17)', () => {
  it('mindestens min(2, newPerDay) andere neue Karten', () => {
    expect(newQuotaLeft(5, 0, 0)).toBe(5);
    expect(newQuotaLeft(5, 6, 6)).toBe(2);
    expect(newQuotaLeft(5, 7, 6)).toBe(1);
    expect(newQuotaLeft(2, 6, 6)).toBe(2);
    expect(newQuotaLeft(0, 6, 6)).toBe(0);
    expect(newQuotaLeft(5, 3, 0)).toBe(2);
  });
});
