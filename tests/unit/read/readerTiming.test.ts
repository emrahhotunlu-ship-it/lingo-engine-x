import { describe, expect, it } from 'vitest';
import { summarizeChecks, judgeCheck } from '../../../src/modules/read/domain/readerCheck';
import { buildStatePatch, canFinish, clockSeconds, newClock, pauseClock, resumeClock, SESSION_CAP_SEC } from '../../../src/modules/read/domain/readerTiming';
import { mergeState } from '../../../src/modules/read/domain/day';
import { goodItem } from './fixtures';

describe('Leser: Lesezeit', () => {
  it('zählt nur sichtbare Zeit und zieht die Zeit mit offenem Nachschlage-Fenster ab', () => {
    let c = newClock();
    c = resumeClock(c, 1_000, 0);
    // 30 s lang sichtbar, davon 10 s mit offenem Fenster
    expect(clockSeconds(c, 31_000, 10_000)).toBe(20);
    c = pauseClock(c, 31_000, 10_000);
    expect(c.since).toBeNull();
    expect(clockSeconds(c, 99_000, 99_000)).toBe(20);
    // zweiter Abschnitt
    c = resumeClock(c, 100_000, 10_000);
    c = pauseClock(c, 105_000, 10_000);
    expect(clockSeconds(c, 200_000, 10_000)).toBe(25);
  });

  it('doppeltes Starten oder Anhalten ändert nichts', () => {
    let c = resumeClock(newClock(), 0, 0);
    expect(resumeClock(c, 5_000, 0)).toBe(c);
    c = pauseClock(c, 4_000, 0);
    expect(pauseClock(c, 9_000, 0)).toBe(c);
    expect(clockSeconds(c, 9_000, 0)).toBe(4);
  });

  it('ist je Sitzung auf 20 Minuten gedeckelt', () => {
    const c = resumeClock(newClock(), 0, 0);
    expect(clockSeconds(c, 3 * 3_600_000, 0)).toBe(SESSION_CAP_SEC);
  });

  it('Fenster-Zeit größer als die sichtbare Zeit ergibt nie negative Sekunden', () => {
    const c = resumeClock(newClock(), 0, 0);
    expect(clockSeconds(c, 2_000, 60_000)).toBe(0);
  });

  it('„Gelesen“ braucht Ende gesehen UND Zeit (2 s je Satz, höchstens 60 s)', () => {
    expect(canFinish(20, 10)).toBe(false);
    expect(canFinish(20, 40)).toBe(true);
    expect(canFinish(100, 59)).toBe(false);
    expect(canFinish(100, 60)).toBe(true);
    expect(canFinish(0, 500)).toBe(false);
  });
});

describe('Leser: Lesezustand als Patch', () => {
  const base = { prior: null, sec: 0, pos: 1, opened: 0, saved: 0, reachedEnd: false, total: 30, now: 1_790_000_000_000 };

  it('nichts getan: nichts schreiben', () => {
    expect(buildStatePatch(base)).toBeNull();
    expect(buildStatePatch({ ...base, sec: 2 })).toBeNull();
  });

  it('Zeit, Position und Aufgedecktes werden auf den bisherigen Stand aufgesetzt', () => {
    const p = buildStatePatch({ ...base, prior: { sec: 100, open: 4, saved: 1, t0: 5, pos: 3 }, sec: 60, pos: 14, opened: 3, saved: 2 });
    expect(p).toMatchObject({ sec: 160, pos: 14, open: 7, saved: 3 });
    expect(p?.t0).toBeUndefined();
    expect(p?.done).toBeUndefined();
  });

  it('der erste Besuch setzt den Beginn', () => {
    expect(buildStatePatch({ ...base, sec: 10, pos: 2 })?.t0).toBe(base.now);
  });

  it('Ende erreicht: gelesen, Position am Ende; bereits gelesen und nichts Neues: nichts schreiben', () => {
    expect(buildStatePatch({ ...base, sec: 80, pos: 25, reachedEnd: true })).toMatchObject({ done: true, pos: 30 });
    expect(buildStatePatch({ ...base, prior: { done: true, sec: 80 }, reachedEnd: true })).toBeNull();
  });

  it('Antworten der Prüffragen und Karten lösen auch ohne Zeit einen Patch aus', () => {
    expect(buildStatePatch({ ...base, saved: 1 })?.saved).toBe(1);
    expect(buildStatePatch({ ...base, answered: { n: 2, ok: 1 } })?.q).toEqual({ n: 2, ok: 1 });
  });

  it('`open` übersteigt nie die Satzzahl', () => {
    expect(buildStatePatch({ ...base, prior: { open: 29 }, sec: 5, opened: 9 })?.open).toBe(30);
  });

  it('ein Patch zweier Sitzungen fügt sich über mergeState zusammen (Zeit wächst, Position folgt dem Neueren, gelesen bleibt)', () => {
    const first = buildStatePatch({ ...base, sec: 50, pos: 10 }) ?? {};
    const merged1 = mergeState(null, first);
    const second = buildStatePatch({ ...base, prior: merged1, sec: 30, pos: 22, reachedEnd: true }) ?? {};
    const merged2 = mergeState(merged1, second);
    expect(merged2).toMatchObject({ sec: 80, pos: 30, done: true });
    // ein anderes Gerät mit älterem Stand schreibt später: Zeit und gelesen gehen nie zurück
    const stale = mergeState(merged2, { sec: 10, pos: 5 });
    expect(stale.sec).toBe(80);
    expect(stale.done).toBe(true);
  });
});

describe('Leser: Verständnis-Check', () => {
  const checks = goodItem().check ?? [];

  it('urteilt über die gewählte Antwort', () => {
    expect(judgeCheck(checks[0]!, 1)).toEqual({ right: true, picked: 1, correct: 1 });
    expect(judgeCheck(checks[0]!, 0)).toEqual({ right: false, picked: 0, correct: 1 });
  });

  it('fasst Antworten zusammen; ohne Antwort null', () => {
    expect(summarizeChecks(checks, {})).toBeNull();
    expect(summarizeChecks(checks, { 0: 1 })).toEqual({ n: 1, ok: 1 });
    expect(summarizeChecks(checks, { 0: 0, 1: 0 })).toEqual({ n: 2, ok: 1 });
  });
});
