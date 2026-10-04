import { describe, expect, it } from 'vitest';
import { deriveToday, mergeEntries } from '../../src/domain/plan/buildPlan';
import type { StoredPlan } from '../../src/domain/plan/types';
import { activityEntry, mergeLogEntries } from '../../src/domain/progress/logPatch';
import { profilePatch, roundBonus, type RoundEnd } from '../../src/domain/progress/profilePatch';
import { activityCounts, speakDutyDone } from '../../src/domain/speak/duty';
import { validateDoc } from '../../src/data/validate';

// Sprechen und Business im gemeinsamen Puffer (Plan §3.6, §3.7, B3, B6).

const profile = () => ({ days: { '2026-09-19': 10 }, xpDays: { '2026-09-19': 30 }, minutes: {}, act: {}, answers: 100, vAnswers: 100, xp: 500, ema: { all: 0.6 }, n: { recog: 3 } });
const speakRound = (n: number, over: Partial<RoundEnd> = {}): RoundEnd => ({ day: '2026-09-20', act: 'speak', partial: n < 4, n, right: 2, activeMs: 600_000, countAs: n, ...over });

describe('profilePatch mit Sprechen und Business', () => {
  it('Gespräch mit 6 Zügen: days und answers steigen um 6, xpDays, act.speak, Minuten; Trefferquote unberührt', () => {
    const p = profilePatch(profile(), [], [speakRound(6)], { deviceId: 'dev1', seq: 5 })!;
    expect(p.days).toEqual({ '2026-09-20': 6 });
    expect(p.answers).toBe(106);
    expect(p.vAnswers).toBeUndefined();
    expect(p.ema).toBeUndefined();
    expect(p.xpDays).toEqual({ '2026-09-20': 60 });
    expect(p.act).toEqual({ '2026-09-20': { speak: 1 } });
    expect(p.minutes).toEqual({ '2026-09-20': 10 });
    expect(p.lxSeq).toEqual({ dev1: 5 });
  });

  it('Abbruch unter 4 Zügen zählt als speak~ (Konvention der alten App)', () => {
    const p = profilePatch(profile(), [], [speakRound(2)], { deviceId: null, seq: 1 })!;
    expect(p.act).toEqual({ '2026-09-20': { 'speak~': 1 } });
  });

  it('Business: 15 XP, act.biz, zählt als 1 Antwort', () => {
    const p = profilePatch(profile(), [], [{ day: '2026-09-20', act: 'biz', partial: false, n: 1, right: 1, activeMs: 120_000, countAs: 1 }], { deviceId: null, seq: 1 })!;
    expect(p).toMatchObject({ answers: 101, days: { '2026-09-20': 1 }, xpDays: { '2026-09-20': 15 }, act: { '2026-09-20': { biz: 1 } } });
    expect(roundBonus({ day: '2026-09-20', act: 'speak', partial: false, n: 20, right: 20, activeMs: 0 })).toBe(150);
  });

  it('dieselbe Folgenummer zweimal wirkt einmal (lxSeq)', () => {
    const cur = { ...profile(), lxSeq: { dev1: 5 } };
    expect(profilePatch(cur, [], [speakRound(6)], { deviceId: 'dev1', seq: 5 })).toBeNull();
  });
});

describe('Log-Eintrag Sprechen/Business', () => {
  it('nie k:"v", nie ctx rev/xtra; gültig im Log-Schema; doppelt nur einmal', () => {
    const e = activityEntry({ t: 1, ok: true, lang: 'de', type: 'speak', id: 'sc-vida', m: 'speak', q: 'x'.repeat(300), n: 6.2, ms: 720_000.4, ctx: 'spk' });
    expect(e).not.toHaveProperty('k');
    expect(e.ctx).toBe('spk');
    expect(e.q).toHaveLength(160);
    expect(e.n).toBe(6);
    expect(validateDoc('log/2026-09-20', { date: '2026-09-20', entries: mergeLogEntries([], [e, e]) }).ok).toBe(true);
    expect(mergeLogEntries([], [e, e])).toHaveLength(1);
  });
});

describe('Pflicht Sprechen und Tagesbilanz', () => {
  const plan: StoredPlan = { d: '2026-09-20', ids: [], why: [], v: 1, duty: ['review'], goal: { review: 2 }, lesson: null, at: 0 };
  const vocab = (id: string, ok = true) => ({ t: Math.random(), id, k: 'v', ok, ctx: 'rev' });
  const speakE = (n: number) => ({ t: n, id: 'sc-vida', type: 'speak', n, ok: true, ctx: 'spk' });

  it('speakDutyDone: offen / 3 Züge offen / 4 Züge erledigt', () => {
    expect(speakDutyDone([])).toBe(false);
    expect(speakDutyDone([speakE(3)])).toBe(false);
    expect(speakDutyDone([speakE(3), speakE(4)])).toBe(true);
    expect(activityCounts([speakE(3), { type: 'biz' }, vocab('a')])).toEqual({ talks: 1, biz: 1 });
  });

  it('B3: Sprech-Einträge zählen nie als „Wiederholen“ und nicht in die Trefferquote', () => {
    const entries = mergeEntries([vocab('a'), speakE(6), { t: 9, id: 'mail', type: 'biz', ok: true, ctx: 'biz' }], []);
    const s = deriveToday({ day: '2026-09-20', plan, entries, minutes: 12 });
    expect(s.review).toEqual({ done: 1, total: 2 });
    expect(s.balance).toEqual({ answers: 1, correct: 1, minutes: 12, talks: 1, biz: 1, repaired: 0 });
    expect(s.status).toBe('open');
    // Ein Sprech-Eintrag mit ctx:'rev' (darf nie entstehen) zählt trotzdem nicht als Vokabel.
    const bad = deriveToday({ day: '2026-09-20', plan, entries: [{ t: 1, id: 'sc-vida', type: 'speak', ctx: 'rev' }], minutes: 0 });
    expect(bad.review.done).toBe(0);
  });
});
