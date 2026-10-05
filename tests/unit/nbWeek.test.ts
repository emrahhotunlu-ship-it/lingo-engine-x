import { describe, expect, it } from 'vitest';
import { TRAPS } from '../../src/content/nb/traps';
import { dayKey, isoWeek } from '../../src/domain/date';
import { block1Order } from '../../src/domain/unit/block1';
import { dowOf, resolveBlock, unitPlanFor } from '../../src/domain/unit/planFor';
import type { UnitBlock, UnitEnv } from '../../src/domain/unit/types';
import { matchTrap, matchTraps } from '../../src/domain/patterns/traps';

// Woche 2026-W40: Mo 28.09. … So 04.10.2026 (gerade Kalenderwoche). W41: Mo 05.10. (ungerade).
const W40 = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const W41_WED = '2026-10-07';
const ENVS: UnitEnv[] = [
  { ai: true, tts: true },
  { ai: false, tts: true },
  { ai: true, tts: false },
  { ai: false, tts: false },
];

describe('isoWeek und Lerntag', () => {
  it('rechnet ISO-Wochen über den Jahreswechsel', () => {
    expect(isoWeek('2026-09-28')).toBe('2026-W40');
    expect(isoWeek('2026-10-04')).toBe('2026-W40');
    expect(isoWeek('2021-01-03')).toBe('2020-W53');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
  });
  it('Montag 02:30 gehört noch zum Sonntag der Vorwoche (Tageswechsel 04:00)', () => {
    const ms = new Date(2026, 8, 28, 2, 30).getTime();
    expect(dayKey(ms)).toBe('2026-09-27');
    expect(isoWeek(dayKey(ms))).toBe('2026-W39');
    expect(isoWeek(dayKey(new Date(2026, 8, 28, 4, 0).getTime()))).toBe('2026-W40');
  });
  it('dowOf: 1 = Montag … 7 = Sonntag', () => {
    expect(W40.map(dowOf)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('unitPlanFor: Wochenplan (N12, M2, M3, M5, M7, S5)', () => {
  // Seit 04.10.2026 (Emrahs Vorgabe „Fokus nur noch Vokabeln und Grammatik“): Mo–Sa Wortschatz · Grammatik ·
  // Satzbau · Fehler korrigieren, Sonntag unverändert Wiederholen + Wochen-Check.
  const week = null;
  const VG_DUTY = ['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again'];

  it('volle Woche: Blöcke, Minuten, duty je Tag', () => {
    const plans = W40.map((d) => unitPlanFor(d, week, { goalMin: 30 }));
    expect(plans.map((p) => p.blocks.length)).toEqual([4, 4, 4, 4, 4, 4, 2]);
    expect(plans.map((p) => p.shape)).toEqual(['full', 'full', 'full', 'full', 'full', 'sat', 'sun']);
    for (const p of plans.slice(0, 6)) {
      expect(p.duty).toEqual(VG_DUTY);
      expect(p.blocks.map((b) => b.block)).toEqual([1, 2, 3, 5]);
      expect(p.blocks.map((b) => b.min)).toEqual([8, 7, 5, 3]);
      expect(p.minutes).toBe(23);
    }
    expect(plans[6]?.duty).toEqual(['review', 'ch:u-check']);
    expect(plans.map((p) => p.blocks.find((b) => b.block === 3)?.kind)).toEqual([
      'task.order',
      'task.order',
      'task.order',
      'task.order',
      'task.order',
      'task.order',
      'task.check',
    ]);
    expect(plans[0]?.reviewSec).toBe(480);
    expect(plans[6]?.reviewSec).toBe(300);
    expect(plans[6]?.minutes).toBe(10);
    // Kein Wochenthema mehr im Plan (Fokus-Umbau).
    expect(plans.every((p) => !('theme' in p) && !('confirmTheme' in p))).toBe(true);
  });

  it('Block 2 ist an jedem Werktag der Grammatik-Block (grammar, 6 Hauptaufgaben); kein Input-Block mehr', () => {
    for (const d of [...W40.slice(0, 6), W41_WED]) {
      const b2 = unitPlanFor(d, week, { goalMin: 30 }).blocks.find((b) => b.block === 2);
      expect(b2, d).toEqual({ block: 2, kind: 'grammar', steps: ['grammar'], opts: { n: 6 }, min: 7, channel: 'ch:u-focus' });
    }
    for (const goalMin of [10, 20, 30])
      for (const d of [...W40, W41_WED]) {
        const kinds = unitPlanFor(d, week, { goalMin }).blocks.map((b) => b.kind);
        expect(kinds.some((k) => k.startsWith('input.') || k === 'pron.shadow'), `${d} ${goalMin}`).toBe(false);
      }
  });

  it('Mittwoch in ungerader Woche: kein Posteingang mehr, derselbe Plan wie an anderen Werktagen', () => {
    const p = unitPlanFor(W41_WED, null, { goalMin: 30 });
    expect(p.duty).toEqual(VG_DUTY);
    expect(p.blocks.some((b) => b.kind === 'task.inbox')).toBe(false);
    const short = unitPlanFor(W41_WED, null, { goalMin: 15 });
    expect(short.blocks.map((b) => b.kind)).toEqual(['review', 'grammar', 'again']);
  });

  it('Donnerstag: ein naher Termin ändert den Plan nicht mehr (Satzbau statt Generalprobe)', () => {
    const thu = W40[3] ?? '';
    expect(unitPlanFor(thu, week, { goalMin: 30, meetingInDays: 2 }).blocks.find((b) => b.block === 3)?.kind).toBe('task.order');
    expect(unitPlanFor(thu, week, { goalMin: 30, meetingInDays: 2 })).toEqual(unitPlanFor(thu, week, { goalMin: 30, meetingInDays: 5 }));
  });

  it('Kurz-Einheit bei Tagesziel ≤ 20 (M3): Blöcke 1, 2 (Grammatik), 5 mit festen Minuten', () => {
    const t10 = unitPlanFor(W40[0] ?? '', week, { goalMin: 10 });
    expect(t10.duty).toEqual(['review', 'ch:u-focus', 'ch:u-again']);
    expect(t10.blocks.map((b) => b.min)).toEqual([3, 4, 2]);
    expect(t10.blocks.find((b) => b.block === 2)?.opts).toEqual({ n: 3 });
    expect(t10.reviewSec).toBe(180);
    const t20 = unitPlanFor(W40[0] ?? '', week, { goalMin: 20 });
    expect(t20.blocks.map((b) => b.min)).toEqual([5, 5, 2]);
    expect(t20.blocks.find((b) => b.block === 2)?.opts).toEqual({ n: 4 });
    expect(t20.reviewSec).toBe(300);
    expect(unitPlanFor(W40[0] ?? '', week, { goalMin: 25 }).short).toBe(false);
    // Samstag kurz wie die anderen Werktage (keine eigene Samstagsaufgabe mehr).
    const sat = unitPlanFor(W40[5] ?? '', week, { goalMin: 15 });
    expect(sat.duty).toEqual(['review', 'ch:u-focus', 'ch:u-again']);
    expect(sat.blocks.find((b) => b.block === 3)).toBeUndefined();
    const sun = unitPlanFor(W40[6] ?? '', week, { goalMin: 10 });
    expect(sun.duty).toEqual(['review', 'ch:u-check']);
    expect(sun.reviewSec).toBe(300);
  });

  it('goal.review = 0 → Block 1 entfällt, duty bleibt stimmig (M2)', () => {
    const p = unitPlanFor(W40[0] ?? '', week, { goalMin: 30, reviewCount: 0 });
    expect(p.duty).toEqual(['ch:u-focus', 'ch:u-task', 'ch:u-again']);
    expect(p.blocks.length).toBe(p.duty.length);
    expect(p.minutes).toBe(15);
    expect(unitPlanFor(W40[6] ?? '', week, { reviewCount: 0 }).duty).toEqual(['ch:u-check']);
  });

  it('7 Tage × KI an/aus × Sprachausgabe an/aus × Kurz: duty unabhängig von env, jeder Block ausführbar ohne Rückfall (M5, N12)', () => {
    const kinds = new Set(['review', 'grammar', 'task.order', 'task.check', 'again']);
    for (const goalMin of [10, 20, 30]) {
      for (const d of [...W40, W41_WED]) {
        const plan = unitPlanFor(d, week, { goalMin, meetingInDays: 1 });
        expect(plan.duty.length).toBe(plan.blocks.length);
        for (const env of ENVS) {
          // Derselbe Tag mit anderem env ergibt denselben Plan (env gehört nicht zum Plan).
          expect(unitPlanFor(d, week, { goalMin, meetingInDays: 1 })).toEqual(plan);
          for (const b of plan.blocks) {
            const r = resolveBlock(b, env);
            expect(kinds.has(r.kind)).toBe(true);
            // Wortschatz, Grammatik, Satzbau und Korrektur gehen ohne KI und ohne Sprachausgabe.
            expect(r).toMatchObject({ kind: b.kind, steps: b.steps, fallback: false });
          }
        }
      }
    }
  });

  it('Rückfälle beim Blockstart für ältere gespeicherte Pläne (M4a, M7)', () => {
    // Blöcke im Format der Pläne vor dem 04.10.2026: `resolveBlock` muss sie weiter auflösen.
    const tue: UnitBlock = { block: 2, kind: 'input.listen', steps: ['input.listen', 'pron.shadow'], opts: { src: 'theme-listen', ladder: true, words: [150, 180] }, min: 5, channel: 'ch:u-in' };
    expect(resolveBlock(tue, { ai: false, tts: true })).toMatchObject({ kind: 'input.listen', opts: { src: 'theme-text', summary: true }, fallback: true });
    expect(resolveBlock(tue, { ai: false, tts: true }).opts.words).toBeUndefined();
    expect(resolveBlock(tue, { ai: true, tts: false })).toMatchObject({ kind: 'input.read', steps: ['input.read'], fallback: true });
    expect(resolveBlock(tue, { ai: true, tts: true })).toMatchObject({ kind: 'input.listen', steps: ['input.listen', 'pron.shadow'], fallback: false });
    const thu: UnitBlock = { block: 2, kind: 'input.listen', steps: ['input.listen', 'pron.shadow'], opts: { src: 'dialog' }, min: 5, channel: 'ch:u-in' };
    expect(resolveBlock(thu, { ai: false, tts: true }).opts.src).toBe('feed');
    const sat: UnitBlock = { block: 3, kind: 'task.roleplay', steps: ['task.roleplay'], opts: {}, min: 12, channel: 'ch:u-task' };
    expect(resolveBlock(sat, { ai: false, tts: true })).toMatchObject({ kind: 'task.objection', offline: true });
    const wed: UnitBlock = { block: 3, kind: 'task.tones', steps: ['task.tones'], opts: {}, min: 9, channel: 'ch:u-task' };
    expect(resolveBlock(wed, { ai: false, tts: true })).toMatchObject({ kind: 'task.inbox', opts: { part: 'full' } });
    const meet: UnitBlock = { block: 3, kind: 'task.meeting', steps: ['task.meeting'], opts: {}, min: 9, channel: 'ch:u-task' };
    expect(resolveBlock(meet, { ai: false, tts: true })).toMatchObject({ kind: 'task.objection', fallback: true });
  });
});

describe('block1Order (M1, M2)', () => {
  const c = (id: string, sec = 10, theme = false) => ({ item: id, sec, theme });
  it('Reparatur ≤ 3 und ≤ 120 s, dann fällige (Thema zuerst), neue an 2, 5, 8', () => {
    const r = block1Order({
      repairs: [c('r1', 40), c('r2', 40), c('r3', 40), c('r4', 10)],
      due: [c('d1'), c('d2', 10, true), c('d3'), c('d4'), c('d5'), c('d6')],
      fresh: [c('n1', 20), c('n2', 20), c('n3', 20)],
      budgetSec: 300,
      quotaLeft: 5,
    });
    expect(r.repairs).toBe(3);
    expect(r.order.slice(0, 3).map((e) => e.item)).toEqual(['r1', 'r2', 'r3']);
    const cards = r.order.slice(3).map((e) => e.item);
    expect(cards[0]).toBe('d2');
    expect(cards[2]).toBe('n1');
    expect(cards[5]).toBe('n2');
    expect(r.goal).toBe(r.order.length);
  });
  it('Untergrenze min(2, Kontingent) auch bei vielen Fälligen; nie über das Kontingent', () => {
    const due = Array.from({ length: 80 }, (_, i) => c(`d${i}`));
    const fresh = Array.from({ length: 10 }, (_, i) => c(`n${i}`, 60));
    const r = block1Order({ repairs: [], due, fresh, budgetSec: 180, quotaLeft: 5 });
    expect(r.fresh).toBe(2);
    const r1 = block1Order({ repairs: [], due, fresh, budgetSec: 180, quotaLeft: 1 });
    expect(r1.fresh).toBe(1);
    const r0 = block1Order({ repairs: [], due, fresh, budgetSec: 480, quotaLeft: 0 });
    expect(r0.fresh).toBe(0);
  });
  it('nichts fällig und nichts neu → goal 0', () => {
    expect(block1Order({ repairs: [], due: [], fresh: [], budgetSec: 480, quotaLeft: 5 }).goal).toBe(0);
  });
});

describe('matchTrap (Startsatz)', () => {
  it('jede Falle mit Erkennung findet ihr Beispiel und ihre Übungssätze, nicht aber die Lösungen', () => {
    for (const trap of TRAPS) {
      if (!trap.detect.length) continue;
      expect(matchTraps(trap.wrong, [trap]).length, `${trap.id}: ${trap.wrong}`).toBeGreaterThan(0);
      expect(matchTraps(trap.right, [trap]), `${trap.id}: ${trap.right}`).toEqual([]);
      for (const d of trap.drills) {
        expect(matchTraps(d.wrong, [trap]).length, `${trap.id}: ${d.wrong}`).toBeGreaterThan(0);
        for (const r of d.right) expect(matchTraps(r, [trap]), `${trap.id}: ${r}`).toEqual([]);
      }
    }
  });
  it('findet die erste Falle im Text', () => {
    expect(matchTrap('We discussed about the price. I look forward to hear from you.')?.id).toBe('f15');
    expect(matchTrap('We have been working together for two years.')).toBeNull();
    expect(matchTraps('Thanks for the informations. Let us discuss about it.').map((h) => h.id)).toEqual(['f14', 'f15']);
  });
  it('kein Fehlalarm bei korrekten Sätzen', () => {
    const ok = [
      'The actual numbers were lower than the forecast.',
      'Eventually, the customer signed the contract.',
      'The provision of cloud services is regulated.',
      'We have a strong pipeline with many prospects.',
      'The customer was very sympathetic to our situation.',
      'Nice to meet you, I am the new account manager.',
      'Let me explain it to you.',
      'We waited until Friday, then we called again.',
      // Prüfung der Inhalte (Englischlehrer, 28.09.), §1: korrekte Sätze, die nie gemeldet werden dürfen
      'How can we become a partner?',
      'It became the answer to our problem.',
      'I sent the prospect our pricing.',
      "You have to read the prospect's mood.",
      'We have a good chance to win this deal.',
      'Can we set a date for the kickoff?',
      "We can't confirm until Monday.",
      'They postponed the decision until next quarter.',
      'We are flexible since the budget is fixed.',
      'We offer a feedback session every month.',
      'We need an information security policy.',
      'Let me know if you do the demo.',
      'I wonder why they did it.',
      'What we need is a clear timeline.',
      "When we have the numbers, we'll decide.",
      "I can't make the meeting on Friday.",
      'We have signed three partners since last month.',
      "We've made progress over the last year.",
      'I understand your caution.',
      'You must be Anna!',
      'You must have had a long flight.',
      'Eventually, we could roll it out to HR.',
      'The outage looks serious.',
      'Can you explain her decision?',
      'That makes the picture clearer.',
      // Nachprüfung Englischlehrer (28.09.)
      'Do we have a date for the go-live yet?',
      'We cannot confirm until Monday.',
      'Can you tell me who does the invoicing today?',
      'When you have a minute, could you take a look?',
      'You must have heard about the new mandate.',
      "Can you send me the prospect's email address?",
      'We have signed 12 new partners since the end of last year.',
      'We are flexible since this is a pilot.',
      'We have a feedback culture.',
    ];
    for (const s of ok) expect(matchTraps(s), s).toEqual([]);
  });
});
