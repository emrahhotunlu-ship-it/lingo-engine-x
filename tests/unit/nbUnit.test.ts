import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/domain/date';
import { deriveToday, readPlan } from '../../src/domain/plan/buildPlan';
import { dutiesFeasible, pflichtFor, pflichtSinceGate, pflichtSinceValue, type PflichtInput } from '../../src/domain/plan/pflicht';
import type { StoredPlan } from '../../src/domain/plan/types';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { buildUnitStored, unitDonePatch, unitPlanOf } from '../../src/domain/unit/plan';
import { unitRows, minutesLeft } from '../../src/domain/unit/rows';
import { unitPhrases } from '../../src/domain/unit/phrases';
import { resolveBlock, unitPlanFor } from '../../src/domain/unit/planFor';
import { EMPTY_TARGETS } from '../../src/domain/unit/types';
import { berlin } from './helpers';

// P1 (plan.md §1.5, N10/N12, Prüfung M2/M3/M5/S5; data-guard §8 00:35): Tagesplan der Einheit,
// Pflicht und Serie ohne Datenumbau, Schreibweg `app/week`.

const MON = '2026-09-28';
const TUE = '2026-09-29';
const SAT = '2026-10-03';
const SUN = '2026-10-04';
const review = { goal: 12, due: 8, fresh: 3, repairs: 1 };

const build = (day: string, goalMin = 25, r = review): StoredPlan => buildUnitStored({ day, nowMs: berlin(day, 9), week: null, goalMin, review: r, rv: 1 });

/** Profil mit Aktivität und den genannten Blöcken erledigt. */
const profileWith = (day: string, keys: string[]) => ({ days: { [day]: 12 }, act: { [day]: Object.fromEntries(keys.map((k) => [k, 1])) } });

const input = (plan: StoredPlan, keys: string[], over: Partial<PflichtInput> = {}): PflichtInput => ({
  day: plan.d,
  plan,
  profile: profileWith(plan.d, keys),
  batchActivity: false,
  reviewDone: true,
  exhausted: false,
  course: null,
  pendingLessonDay: false,
  ...over,
});

describe('Tagesplan der Einheit (gespeichertes Format)', () => {
  it('Montag voll: 4 Blöcke (Wortschatz · Grammatik · Satzbau · Fehler korrigieren), Pflicht review + ch:u-*, Umfang von Block 1 eingefroren', () => {
    const p = build(MON);
    expect(p.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again']);
    expect(p.goal).toMatchObject({ review: 12, due: 8, new: 3 });
    expect(p.lesson).toBeNull();
    expect(p.u?.b).toEqual([
      [1, 'review', 8],
      [2, 'grammar', 7],
      [3, 'task.order', 5],
      [5, 'again', 3],
    ]);
    expect(p.u?.min).toBe(23);
    // Rückweg-sicher gelesen (readPlan behält `u`), unverändert nach JSON.
    expect(readPlan(JSON.parse(JSON.stringify(p)), MON)).toEqual(p);
  });

  it('Kurz-Einheit (Tagesziel ≤ 20): 3 Blöcke mit Grammatik; Samstag wie Werktag; Sonntag 2 (Wiederholen + Wochen-Check)', () => {
    expect(build(TUE, 15).duty).toEqual(['review', 'ch:u-focus', 'ch:u-again']);
    expect(build(TUE, 15).u?.b.map((b) => b[1])).toEqual(['review', 'grammar', 'again']);
    expect(build(SAT).duty).toEqual(['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again']);
    expect(build(SUN).duty).toEqual(['review', 'ch:u-check']);
  });

  it('Block 1 entfällt ohne Karten (M2); „x von n“ aus duty.length', () => {
    const p = build(MON, 25, { goal: 0, due: 0, fresh: 0, repairs: 0 });
    expect(p.duty).toEqual(['ch:u-focus', 'ch:u-task', 'ch:u-again']);
    const st = deriveToday({ day: MON, plan: p, entries: [], minutes: 0, act: {} });
    expect(st.duties.total).toBe(p.duty.length);
  });

  it('M5: derselbe Tag mit KI/Stimme an oder aus ergibt dasselbe duty; Rückfälle erst beim Blockstart', () => {
    for (const day of [MON, TUE, '2026-09-30', '2026-10-01', '2026-10-02', SAT, SUN]) {
      const p = unitPlanFor(day, null, { goalMin: 25 });
      for (const b of p.blocks) {
        for (const env of [{ ai: false, tts: false }, { ai: true, tts: false }, { ai: false, tts: true }]) {
          const r = resolveBlock(b, env);
          expect(r.block).toBe(b.block);
        }
      }
      expect(build(day).duty).toEqual([...p.duty]);
    }
  });

  it('eingefrorener Plan bleibt, auch wenn sich das Tagesziel ändert (M3: erst ab dem nächsten Lerntag)', () => {
    const p = build(MON, 25);
    const up = unitPlanOf(p as StoredPlan & { u: NonNullable<StoredPlan['u']> }, null);
    expect(up.duty).toEqual(p.duty);
    expect(up.blocks.map((b) => b.kind)).toEqual(p.u?.b.map((b) => b[1]));
  });
});

describe('Pflicht und Serie ohne Datenumbau (pflichtFor unverändert)', () => {
  const shapes: Array<[string, StoredPlan]> = [
    ['voll (Mo)', build(MON)],
    ['kurz (Di, 15 Min.)', build(TUE, 15)],
    ['Samstag', build(SAT)],
    ['Sonntag', build(SUN)],
    ['ohne Block 1', build(MON, 25, { goal: 0, due: 0, fresh: 0, repairs: 0 })],
  ];
  for (const [name, plan] of shapes) {
    it(`${name}: erfüllt genau dann, wenn alle Blöcke gezählt sind`, () => {
      const keys = plan.duty.filter((d) => d.startsWith('ch:')).map((d) => d.slice(3));
      expect(pflichtFor(input(plan, keys))).toBe(true);
      for (const k of keys) expect(pflichtFor(input(plan, keys.filter((x) => x !== k)))).toBe(false);
      if (plan.duty.includes('review')) expect(pflichtFor(input(plan, keys, { reviewDone: false }))).toBe(false);
      // Ohne eigene Aktivität zählt der Tag nie (Regel 1).
      expect(pflichtFor(input(plan, keys, { profile: { act: profileWith(plan.d, keys).act } }))).toBe(false);
      // Ein abgebrochener Block (`u-in~`) zählt nicht.
      if (keys[0]) expect(pflichtFor(input(plan, keys.slice(1), { profile: { days: { [plan.d]: 3 }, act: { [plan.d]: { ...Object.fromEntries(keys.slice(1).map((k) => [k, 1])), [`${keys[0]}~`]: 1 } } } }))).toBe(false);
    });
  }

  it('dutiesFeasible: jeder Block ist ohne KI und ohne Sprachausgabe erfüllbar (Voraussetzung pflichtSince)', () => {
    for (const [, plan] of shapes) expect(dutiesFeasible(plan, { tts: false, ai: false }, { cloze: 0, order: 0 })).toBe(true);
    const gate = pflichtSinceGate({ schema: { version: 1 }, plan: build(MON), today: MON, tts: false, ai: false, data: { cloze: 0, order: 0 } });
    expect(gate).toEqual({ ok: true });
  });

  it('pflichtSince nie rückwirkend: nie vor heute oder dem letzten Aktivtag', () => {
    const now = berlin(MON, 9);
    const v = pflichtSinceValue({ nowMs: now, cutover: '2026-09-20', profile: { days: { '2026-09-27': 4 } } });
    expect(v >= MON).toBe(true);
    const later = pflichtSinceValue({ nowMs: now, cutover: null, profile: { act: { [addDays(MON, 1)]: { 'u-in': 1 } } } });
    expect(later).toBe(addDays(MON, 1));
  });

  it('0–4-Uhr-Regel: ein Block um 01:30 zählt zum Vortag', () => {
    expect(dayKey(berlin(TUE, 1, 30))).toBe(MON);
    expect(dayKey(berlin(TUE, 4, 0))).toBe(TUE);
  });

  it('Block zählen: act[tag][u-*] = 1, idempotent, andere Blöcke im selben Stapel bleiben erhalten', () => {
    const cur = { act: { [MON]: { review: 1, 'u-in': 1 } } };
    const p1 = unitDonePatch(cur, MON, 'u-task');
    expect(p1).toEqual({ act: { [MON]: { 'u-in': 1, 'u-task': 1 } } });
    const next = applyUpdate(cur, p1 ?? {});
    expect(unitDonePatch(next, MON, 'u-task')).toBeNull();
    // Zwei Feld-Patches eines Stapels werden flach zusammengelegt: der zweite trägt den ersten mit.
    const p2 = unitDonePatch(next, MON, 'u-focus');
    expect({ ...p1, ...p2 }).toEqual({ act: { [MON]: { 'u-in': 1, 'u-task': 1, 'u-focus': 1 } } });
    expect(applyUpdate(cur, { ...p1, ...p2 })).toEqual({ act: { [MON]: { review: 1, 'u-in': 1, 'u-task': 1, 'u-focus': 1 } } });
  });

  it('Blockliste: Zustand je Block, „jetzt“ = erster offener, Restminuten', () => {
    const p = build(MON);
    const st = deriveToday({ day: MON, plan: p, entries: [], minutes: 0, act: { [MON]: { 'u-focus': 1 } }, exhausted: true });
    const rows = unitRows(p, st.duties.items) ?? [];
    expect(rows.map((r) => r.state)).toEqual(['done', 'done', 'now', 'open']);
    // Satzbau 5 + Fehler korrigieren 3
    expect(minutesLeft(rows)).toBe(5 + 3);
  });
});

describe('UnitCtx.phrases (M8)', () => {
  const targets = { ...EMPTY_TARGETS, phrases: ['pain point', 'touch base', 'follow up', 'loop in', 'circle back', 'bandwidth'] };
  it('Karten aus Lesen/Hören von heute zuerst, sonst die 5 Wendungen der Woche', () => {
    expect(unitPhrases([], MON, targets)).toEqual(targets.phrases.slice(0, 5));
    const cards = [
      { word: 'pain point', src: 'read', added: MON },
      { word: 'old', src: 'read', added: '2026-09-01' },
      { word: 'lookup', src: 'lookup', added: MON },
    ];
    expect(unitPhrases(cards, MON, targets)).toEqual(['pain point']);
  });
});
