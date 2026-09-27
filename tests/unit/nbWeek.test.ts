import { describe, expect, it } from 'vitest';
import { THEMES, THEME_ORDER } from '../../src/content/nb/themes';
import { TRAPS } from '../../src/content/nb/traps';
import { dayKey } from '../../src/domain/date';
import {
  block1Order,
  detectTargets,
  dowOf,
  isThemeCard,
  isoWeek,
  matchTrap,
  matchTraps,
  needsThemeConfirm,
  preplyRole,
  readWeekDoc,
  resolveBlock,
  suggestTheme,
  themeFor,
  themeRef,
  unitPlanFor,
  weekTargets,
  withTheme,
  type UnitEnv,
  type WeekDoc,
} from '../../src/domain/week';

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

describe('Wochenthema', () => {
  it('ohne Daten: erstes Thema der Reihenfolge, nie leer, Bestätigung nötig (M10)', () => {
    const p = themeFor('2026-09-30', null);
    expect(p.id).toBe('t01');
    expect(p.by).toBe('auto');
    expect(p.stored).toBe(false);
    expect(needsThemeConfirm('2026-09-30', null)).toBe(true);
  });
  it('gespeichertes Thema der Woche gilt, auf jedem Tag der Woche', () => {
    const week: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't05', by: 'user', at: 1 } };
    for (const d of W40) {
      expect(themeFor(d, week).id).toBe('t05');
      expect(needsThemeConfirm(d, week)).toBe(false);
    }
    expect(needsThemeConfirm('2026-10-05', week)).toBe(true);
  });
  it('Vorschlag folgt der Reihenfolge nach dem letzten Thema und beginnt danach von vorn', () => {
    const week: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't02', by: 'auto' } };
    expect(suggestTheme(week, '2026-W41')).toBe('t13');
    const last: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't11', by: 'auto' } };
    expect(suggestTheme(last, '2026-W41')).toBe(THEME_ORDER[0]);
  });
  it('Termin vor Preply vor Reihenfolge (N17)', () => {
    expect(suggestTheme(null, '2026-W41', { meeting: 't04', preply: 't07' })).toBe('t04');
    expect(suggestTheme(null, '2026-W41', { preply: 't07' })).toBe('t07');
  });
  it('withTheme schiebt die Vorwoche nach hist und kappt bei 26', () => {
    let doc: WeekDoc | null = null;
    for (let i = 0; i < 30; i++) {
      const wk = `2026-W${String(i + 10).padStart(2, '0')}`;
      doc = withTheme(doc, wk, THEME_ORDER[i % 16] ?? 't01', 'user', i);
    }
    expect(doc?.cur?.wk).toBe('2026-W39');
    expect(doc?.hist?.length).toBe(26);
    const again = withTheme(doc, '2026-W39', 't03', 'user', 99);
    expect(again.cur?.theme).toBe('t03');
    expect(again.hist?.some((h) => h.wk === '2026-W39')).toBe(false);
  });
  it('readWeekDoc liest tolerant und verwirft Unsinn', () => {
    const doc = readWeekDoc({ v: 1, cur: { wk: '2026-W40', theme: 't99', by: 'x' }, hist: [{ wk: 'bad', theme: 't01' }, { wk: '2026-W39', theme: 't02' }], preplyNext: '2026-10-01', extra: 1 });
    expect(doc.cur).toBeUndefined();
    expect(doc.hist).toEqual([{ wk: '2026-W39', theme: 't02', by: 'auto' }]);
    expect(doc.preplyNext).toBe('2026-10-01');
    expect(readWeekDoc(null)).toEqual({ v: 1 });
  });
});

describe('unitPlanFor: Wochenplan (N12, M2, M3, M5, M7, S5)', () => {
  const week: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't03', by: 'user' } };

  it('volle Woche: Blöcke, Minuten, duty je Tag', () => {
    const plans = W40.map((d) => unitPlanFor(d, week, { goalMin: 30 }));
    expect(plans.map((p) => p.blocks.length)).toEqual([5, 5, 5, 5, 5, 4, 2]);
    expect(plans[0]?.duty).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
    expect(plans[5]?.duty).toEqual(['review', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
    expect(plans[6]?.duty).toEqual(['review', 'ch:u-check']);
    expect(plans[0]?.minutes).toBe(27);
    expect(plans.map((p) => p.blocks.find((b) => b.block === 3)?.kind)).toEqual([
      'task.say',
      'task.fluency',
      'task.tones', // gerade Woche
      'task.objection',
      'task.fluency',
      'task.roleplay',
      'task.check',
    ]);
    expect(plans[0]?.reviewSec).toBe(480);
    expect(plans[6]?.reviewSec).toBe(300);
    expect(plans[6]?.minutes).toBe(10);
    expect(plans.every((p) => p.theme === 't03' && !p.confirmTheme)).toBe(true);
  });

  it('Block-2-Quellen je Tag (M7) und Hörtext 150–180 Wörter (S1)', () => {
    const src = W40.slice(0, 5).map((d) => unitPlanFor(d, week, { goalMin: 30 }).blocks.find((b) => b.block === 2)?.opts.src);
    expect(src).toEqual(['theme-text', 'theme-listen', 'feed', 'dialog', 'feed-life']);
    const tue = unitPlanFor(W40[1] ?? '', week, { goalMin: 30 }).blocks.find((b) => b.block === 2);
    expect(tue?.opts.words).toEqual([150, 180]);
    expect(tue?.steps).toEqual(['input.listen', 'pron.shadow']);
    const lifeWeek: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't13', by: 'user' } };
    expect(unitPlanFor(W40[4] ?? '', lifeWeek, { goalMin: 30 }).blocks.find((b) => b.block === 2)?.opts.src).toBe('feed');
  });

  it('Mittwoch in ungerader Woche: Mail lesen (Block 2), antworten (Block 3)', () => {
    const p = unitPlanFor(W41_WED, null, { goalMin: 30 });
    expect(p.blocks.find((b) => b.block === 2)).toMatchObject({ kind: 'task.inbox', opts: { part: 'read' } });
    expect(p.blocks.find((b) => b.block === 3)).toMatchObject({ kind: 'task.inbox', opts: { part: 'reply' } });
    const short = unitPlanFor(W41_WED, null, { goalMin: 15 });
    expect(short.blocks.find((b) => b.block === 3)).toMatchObject({ kind: 'task.inbox', opts: { part: 'full' } });
  });

  it('Donnerstag: Generalprobe nur bei Termin in 0–3 Tagen', () => {
    const thu = W40[3] ?? '';
    expect(unitPlanFor(thu, week, { goalMin: 30, meetingInDays: 2 }).blocks.find((b) => b.block === 3)?.kind).toBe('task.meeting');
    expect(unitPlanFor(thu, week, { goalMin: 30, meetingInDays: 5 }).blocks.find((b) => b.block === 3)?.kind).toBe('task.objection');
  });

  it('Kurz-Einheit bei Tagesziel ≤ 20 (M3): Blöcke 1, 3, 5 mit festen Minuten', () => {
    const t10 = unitPlanFor(W40[0] ?? '', week, { goalMin: 10 });
    expect(t10.duty).toEqual(['review', 'ch:u-task', 'ch:u-again']);
    expect(t10.blocks.map((b) => b.min)).toEqual([3, 5, 2]);
    expect(t10.reviewSec).toBe(180);
    const t20 = unitPlanFor(W40[0] ?? '', week, { goalMin: 20 });
    expect(t20.blocks.map((b) => b.min)).toEqual([5, 7, 3]);
    expect(t20.reviewSec).toBe(300);
    expect(unitPlanFor(W40[0] ?? '', week, { goalMin: 25 }).short).toBe(false);
    const sat = unitPlanFor(W40[5] ?? '', week, { goalMin: 15 });
    expect(sat.blocks.find((b) => b.block === 3)).toMatchObject({ kind: 'task.objection', opts: { short: true } });
    const sun = unitPlanFor(W40[6] ?? '', week, { goalMin: 10 });
    expect(sun.duty).toEqual(['review', 'ch:u-check']);
    expect(sun.reviewSec).toBe(300);
  });

  it('goal.review = 0 → Block 1 entfällt, duty bleibt stimmig (M2)', () => {
    const p = unitPlanFor(W40[0] ?? '', week, { goalMin: 30, reviewCount: 0 });
    expect(p.duty).toEqual(['ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
    expect(p.blocks.length).toBe(p.duty.length);
    expect(unitPlanFor(W40[6] ?? '', week, { reviewCount: 0 }).duty).toEqual(['ch:u-check']);
  });

  it('7 Tage × KI an/aus × Sprachausgabe an/aus × Kurz: duty unabhängig von env, jeder Block ausführbar (M5, N12)', () => {
    const kinds = new Set(['review', 'input.read', 'input.listen', 'pron.shadow', 'task.say', 'task.fluency', 'task.tones', 'task.inbox', 'task.objection', 'task.meeting', 'task.roleplay', 'task.check', 'focus', 'focus.colloc', 'again']);
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
            expect(r.steps.length).toBeGreaterThan(0);
            if (!env.ai) expect(['task.roleplay', 'task.meeting', 'task.tones']).not.toContain(r.kind);
            if (!env.tts) {
              expect(r.steps).not.toContain('pron.shadow');
              expect(r.steps).not.toContain('input.listen');
            }
          }
        }
      }
    }
  });

  it('Rückfälle beim Blockstart (M4a, M7)', () => {
    const tue = unitPlanFor(W40[1] ?? '', week, { goalMin: 30 }).blocks.find((b) => b.block === 2);
    if (!tue) throw new Error('Block 2 fehlt');
    expect(resolveBlock(tue, { ai: false, tts: true })).toMatchObject({ kind: 'input.listen', opts: { src: 'theme-text', summary: true }, fallback: true });
    expect(resolveBlock(tue, { ai: true, tts: false })).toMatchObject({ kind: 'input.read', steps: ['input.read'], fallback: true });
    expect(resolveBlock(tue, { ai: true, tts: true })).toMatchObject({ kind: 'input.listen', fallback: false });
    const thu = unitPlanFor(W40[3] ?? '', week, { goalMin: 30 }).blocks.find((b) => b.block === 2);
    if (!thu) throw new Error('Block 2 fehlt');
    expect(resolveBlock(thu, { ai: false, tts: true }).opts.src).toBe('feed');
    const sat = unitPlanFor(W40[5] ?? '', week, { goalMin: 30 }).blocks.find((b) => b.block === 3);
    if (!sat) throw new Error('Block 3 fehlt');
    expect(resolveBlock(sat, { ai: false, tts: true })).toMatchObject({ kind: 'task.objection', offline: true });
    const wed = unitPlanFor(W40[2] ?? '', week, { goalMin: 30 }).blocks.find((b) => b.block === 3);
    if (!wed) throw new Error('Block 3 fehlt');
    expect(resolveBlock(wed, { ai: false, tts: true })).toMatchObject({ kind: 'task.inbox', opts: { part: 'full' } });
  });

  it('Montag ohne gespeichertes Thema: Bestätigungskarte, Thema aus dem Vorschlag', () => {
    const p = unitPlanFor(W40[0] ?? '', { v: 1, cur: { wk: '2026-W39', theme: 't01', by: 'user' } }, { goalMin: 30 });
    expect(p.confirmTheme).toBe(true);
    expect(p.theme).toBe('t02');
    expect(p.themeBy).toBe('auto');
  });
});

describe('Preply-Verschiebung (N16, S2)', () => {
  const week: WeekDoc = { v: 1, cur: { wk: '2026-W40', theme: 't07', by: 'user' } };
  it('Tag davor, Tag der Stunde, Tag danach', () => {
    const lessons = ['2026-09-30']; // Mittwoch
    const before = unitPlanFor('2026-09-29', week, { goalMin: 30, preplyDays: lessons });
    expect(before.preply).toBe('before');
    expect(before.blocks.find((b) => b.block === 3)).toMatchObject({ kind: 'task.say', opts: { preply: 'before' }, alt: { kind: 'task.fluency' } });
    const day = unitPlanFor('2026-09-30', week, { goalMin: 30, preplyDays: lessons });
    expect(day.shape).toBe('preply-day');
    expect(day.duty).toEqual(['review', 'ch:u-in']);
    expect(day.blocks.map((b) => b.min)).toEqual([5, 3]);
    const after = unitPlanFor('2026-10-01', week, { goalMin: 30, preplyDays: lessons });
    expect(after.blocks.find((b) => b.block === 2)).toMatchObject({ opts: { src: 'preply-import' } });
    // Ohne KI: normaler Wochenplan, gleiche Blockzahl (S2c, M4a).
    const b2 = after.blocks.find((b) => b.block === 2);
    if (!b2) throw new Error('Block 2 fehlt');
    expect(resolveBlock(b2, { ai: false, tts: true }).opts.src).toBe('feed');
  });
  it('Kollisionen: Tag der Stunde > Tag danach > Tag davor; mindestens 3 normale Tage Mo–Sa', () => {
    const lessons = ['2026-09-29', '2026-10-01']; // Di + Do
    expect(preplyRole('2026-09-30', lessons)).toBe('after'); // Mi ist Tag danach (Di) und Tag davor (Do)
    const roles = W40.map((d) => preplyRole(d, lessons));
    expect(roles.filter((r) => r === null).length).toBeGreaterThanOrEqual(3 + 1); // + Sonntag
    const many = ['2026-09-29', '2026-10-01', '2026-10-03'];
    const r2 = W40.slice(0, 6).map((d) => preplyRole(d, many));
    expect(r2.filter((r) => r === null).length).toBeGreaterThanOrEqual(3);
    expect(r2.filter((r) => r === 'day').length).toBe(3);
    expect(preplyRole('2026-10-04', ['2026-10-04'])).toBeNull();
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

describe('isThemeCard (anki-regeln §5 Stufe 4)', () => {
  it('Herkunft, Wendung, Stichwort', () => {
    expect(isThemeCard({ word: 'anything', src: themeRef('t03') }, 't03')).toBe(true);
    expect(isThemeCard({ word: 'total cost of ownership' }, 't03')).toBe(true);
    expect(isThemeCard({ word: 'pays for itself' }, 't03')).toBe(true);
    expect(isThemeCard({ word: 'return on investment' }, 't03')).toBe(true);
    expect(isThemeCard({ word: 'discounts' }, 't03')).toBe(true);
    expect(isThemeCard({ word: 'umbrella' }, 't03')).toBe(false);
    expect(isThemeCard({ word: 'price', doc: { origin: { kind: 'say', ref: 'theme:t05' } } }, 't03')).toBe(false);
    expect(isThemeCard({ word: 'hotel' }, null)).toBe(false);
  });
  it('Stichwörter nur als Wortanfang mit kurzer Endung (keine Fehltreffer)', () => {
    expect(isThemeCard({ word: 'eventually' }, 't12')).toBe(false);
    expect(isThemeCard({ word: 'events' }, 't12')).toBe(true);
    expect(isThemeCard({ word: 'career' }, 't13')).toBe(false);
    expect(isThemeCard({ word: 'rental car' }, 't13')).toBe(true);
    expect(isThemeCard({ word: 'aim' }, 't15')).toBe(false);
    expect(isThemeCard({ word: 'certificate' }, 't04')).toBe(true);
    expect(isThemeCard({ word: 'e-invoicing' }, 't05')).toBe(true);
  });
  it('jedes Thema erkennt seine eigenen Wendungen', () => {
    for (const t of THEMES) for (const p of t.phrases) expect(isThemeCard({ word: p.en }, t)).toBe(true);
  });
});

describe('Wochenziele und Erkennen (N13)', () => {
  it('weekTargets: eigene Fallen zuerst, dann Themenfalle, höchstens 3; gespeicherte Ziele gehen vor', () => {
    const t = weekTargets('t03', { day: '2026-09-28', own: ['p:since-for'] });
    expect(t.traps).toEqual(['p:since-for', 'f19', 'f20']);
    expect(t.tool).toBe('c1-hedging');
    expect(t.phrases).toHaveLength(5);
    const stored = weekTargets('t03', { day: '2026-09-28', week: { v: 1, targets: { wk: '2026-W40', traps: ['f01'], tool: 'passive', preply: 'Fewer fillers' } } });
    expect(stored).toMatchObject({ traps: ['f01'], tool: 'passive', preply: 'Fewer fillers' });
    expect(weekTargets(null).traps).toEqual([]);
  });
  it('detectTargets zählt Abschwächungen, Überleitungen und Wendungen', () => {
    const targets = weekTargets('t03');
    const text =
      "I understand it may seem high at first glance. That said, it should save you roughly 30 percent. " +
      "On top of that, the system pays for itself within 18 months. To sum up, I'd argue it's worth a pilot.";
    const r = detectTargets(text, targets);
    expect(r.hedge).toBeGreaterThanOrEqual(4); // may, should, roughly 30, I'd argue
    expect(r.transition).toBe(3); // That said, On top of that, To sum up
    expect(r.phrasesUsed).toEqual(['I understand it may seem high at first glance', 'pays for itself within 18 months']);
    expect(r.progress).toEqual([
      { kind: 'hedge', need: 2, have: r.hedge },
      { kind: 'phrase', need: 2, have: 2 },
    ]);
  });
  it('„Could you …“ ist eine Bitte, keine Abschwächung; Kurzformen zählen wie Langformen', () => {
    expect(detectTargets('Could you send me the file?').hedge).toBe(0);
    const t = weekTargets('t09');
    expect(detectTargets('We have identified the root cause and I will keep you posted.', t).phrase).toBe(2);
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
    ];
    for (const s of ok) expect(matchTraps(s), s).toEqual([]);
  });
});
