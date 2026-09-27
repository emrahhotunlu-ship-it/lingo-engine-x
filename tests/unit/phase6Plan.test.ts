import { describe, expect, it } from 'vitest';
import { assessPlanInput } from '../../src/domain/assessment/planInput';
import { buildPlan, deriveToday, pickDutyChannel } from '../../src/domain/plan/buildPlan';
import { rankChannels, type RankInput, type RankedChannel } from '../../src/domain/plan/channels';
import { normGoalMin, normNewPerDay, normRate, normSound, resolveVoice } from '../../src/domain/progress/settings';
import { playCue, resetSoundForTests, setSoundEnabled, soundSupported } from '../../src/platform/sound';
import { loadSeed } from './helpers';

// Tagesplan mit Kanalgewichtung aus der Einschätzung (Plan §5), Einstellungen (Plan §9), Ton.

const seed = loadSeed();
const today = '2026-09-21';
const round = { target: 22, due: 17, new: 5, ahead: 0 };
const data = { cloze: 12, order: 40, sprint: 60, vocab: 150 };
const base = (over: Partial<RankInput> = {}): RankInput => ({
  today,
  profile: { act: {}, ema: { recog: 0.7, write: 0.6, listen: 0.5, colloc: 0.65, all: 0.6 }, n: { recog: 50, write: 40, listen: 30, colloc: 25 } },
  focus: null,
  dueErrors: 0,
  dueCards: 5,
  data,
  env: { tts: true },
  ...over,
});

describe('Einschätzung → Tagesplan (Plan §5.2)', () => {
  it('Testdaten: Fokus gilt 3 Tage ab d (18.09.) → am 20.09. gültig, am 21.09. nicht mehr', () => {
    const a = seed['app/assess'];
    expect(assessPlanInput(a, '2026-09-20')?.focusValid).toBe(true);
    expect(assessPlanInput(a, '2026-09-21')?.focusValid).toBe(false);
    const p = assessPlanInput(a, '2026-09-20')!;
    expect(p.focusChannels).toEqual(['gram', 'order']);
    expect(p.focusRef).toBe('grammar:mixed-cond');
    expect(p.dims.speaking?.confidence).toBe('thin');
    expect(assessPlanInput(null, today)).toBeNull();
  });

  it('Fokus: +30 und Grund mit Kennung, zuerst genannt; ohne gültige Einschätzung die Regel aus Phase 2', () => {
    const assess = { focusValid: true, focusChannels: ['order'], focusRef: 'grammar:passive', dims: {} };
    const r = rankChannels(base({ assess })).find((c) => c.id === 'order')!;
    expect(r.why[0]).toEqual(['whyFocus', 0, 'grammar:passive']);
    const plain = rankChannels(base()).find((c) => c.id === 'order')!;
    expect(r.score - plain.score).toBe(30);
    const old = rankChannels(base({ focus: 'grammar:passive', assess: { ...assess, focusValid: false } })).find((c) => c.id === 'gram')!;
    expect(old.why[0]).toEqual(['whyFocus']);
  });

  it('dünne Datenlage und schwächster Bereich aus den Fertigkeiten', () => {
    const dims = {
      grammar: { rank: 3, confidence: 'good' as const },
      vocabulary: { rank: 4, confidence: 'good' as const },
      listening: { rank: 1, confidence: 'fair' as const },
      speaking: { rank: 2, confidence: 'thin' as const },
    };
    const ranked = rankChannels(base({ assess: { focusValid: false, focusChannels: [], focusRef: null, dims } }));
    const dictate = ranked.find((c) => c.id === 'dictate')!;
    expect(dictate.why.map((w) => w[0])).toContain('whyWeakest');
    const gram = ranked.find((c) => c.id === 'gram')!;
    expect(gram.why.map((w) => w[0])).not.toContain('whyThin');
    const sprint = ranked.find((c) => c.id === 'sprint')!;
    expect(sprint.why.map((w) => w[0])).not.toContain('whyWeakest');
  });

  it('ohne Zufall: gleiche Eingabe, gleiches Ergebnis; höchstens zwei Gründe; Wochenabzug wirkt', () => {
    const assess = assessPlanInput(seed['app/assess'], '2026-09-20');
    const a = rankChannels(base({ today: '2026-09-20', assess }));
    for (let k = 0; k < 20; k++) expect(rankChannels(base({ today: '2026-09-20', assess }))).toEqual(a);
    for (const r of a) expect(r.why.length).toBeLessThanOrEqual(2);
    const act = Object.fromEntries(['2026-09-18', '2026-09-19', '2026-09-20'].map((d) => [d, { gram: 1 }]));
    const b = rankChannels(base({ today: '2026-09-20', assess, profile: { ...base().profile, act } }));
    expect(b.find((c) => c.id === 'gram')!.score).toBeLessThan(a.find((c) => c.id === 'gram')!.score);
  });

  it('fällige Fehlersätze nennen ihren Grund mit dem Schlüssel der alten App', () => {
    const gram = rankChannels(base({ dueErrors: 4 })).find((c) => c.id === 'gram')!;
    expect(gram.why).toContainEqual(['whyDue', 4, 'gram']);
  });
});

describe('Pflichtkanal im Minutenbudget (Plan §5.3)', () => {
  const ranked: RankedChannel[] = [
    { id: 'vocab', score: 50, why: [['whyRotation']], days: null },
    { id: 'cloze', score: 40, why: [['whyThin']], days: null },
    { id: 'gram', score: 30, why: [['whyRotation']], days: null },
  ];
  it('erster Pflichtkanal nach Rang, der ins Budget passt; sonst der kürzeste', () => {
    expect(pickDutyChannel(ranked, { goalMin: 25, lesson: true, reviewCards: 10 })?.id).toBe('cloze');
    expect(pickDutyChannel(ranked, { goalMin: 10, lesson: true, reviewCards: 40 })?.id).toBe('cloze');
    expect(pickDutyChannel(ranked, { lesson: true, reviewCards: 10 })?.id).toBe('cloze');
    expect(pickDutyChannel([], { goalMin: 25, lesson: true, reviewCards: 10 })).toBeNull();
  });

  it('der Plan von heute bleibt unverändert, auch wenn sich die Einschätzung ändert', () => {
    const i1 = base({ assess: null });
    const first = buildPlan({ today, existing: null, round, nowMs: 1, phase2: { ranked: rankChannels(i1), lesson: { lid: 'l07' }, goalMin: 25 } }).plan;
    const i2 = base({ assess: { focusValid: true, focusChannels: ['order'], focusRef: 'grammar:passive', dims: {} } });
    const again = buildPlan({ today, existing: first, round, nowMs: 2, phase2: { ranked: rankChannels(i2), lesson: { lid: 'l07' }, goalMin: 25 } });
    expect(again.changed).toBe(false);
    expect(again.plan).toEqual(first);
    const tomorrow = buildPlan({ today: '2026-09-22', existing: first, round, nowMs: 3, phase2: { ranked: rankChannels({ ...i2, today: '2026-09-22' }), lesson: { lid: 'l07' }, goalMin: 25 } });
    expect(tomorrow.changed).toBe(true);
    expect(tomorrow.plan.why.flat()).toContainEqual(['whyFocus', 0, 'grammar:passive']);
  });

  it('der Zähler steigt mit jeder Pflichtaufgabe (Kap. 12), drei Pflichten', () => {
    const plan = buildPlan({ today, existing: null, round, nowMs: 1, phase2: { ranked: rankChannels(base()), lesson: { lid: 'l07' }, goalMin: 25 } }).plan;
    expect(plan.duty).toHaveLength(3);
    const ch = plan.duty[2]!.slice(3);
    const entries = Array.from({ length: 22 }, (_, k) => ({ t: k, id: `c${k}`, k: 'v', ok: true, ctx: 'rev' }));
    const s0 = deriveToday({ day: today, plan, entries: [], minutes: 0 });
    const s1 = deriveToday({ day: today, plan, entries, minutes: 0 });
    const s2 = deriveToday({ day: today, plan, entries, minutes: 0, course: { done: { l07: { d: today } } } });
    const s3 = deriveToday({ day: today, plan, entries, minutes: 0, course: { done: { l07: { d: today } } }, act: { [today]: { [ch]: 1 } } });
    expect([s0, s1, s2, s3].map((s) => s.duties.done)).toEqual([0, 1, 2, 3]);
    expect(s3.status).toBe('allDone');
  });
});

describe('Einstellungen normalisieren (Plan §9)', () => {
  it('Tagesziel, neue Wörter, Tempo, Ton', () => {
    expect(normGoalMin(undefined)).toBe(25);
    expect(normGoalMin(27)).toBe(25);
    expect(normGoalMin(40)).toBe(40);
    expect(normGoalMin(-3)).toBe(25);
    expect(normNewPerDay(undefined)).toBe(5);
    expect(normNewPerDay(3)).toBe(2);
    expect(normNewPerDay(0)).toBe(0);
    expect(normRate(0.95)).toBe(0.9);
    expect(normRate('x')).toBe(1);
    expect(normSound(undefined)).toBe(false);
    expect(normSound(true)).toBe(true);
  });
  it('Stimme fehlt auf dem Gerät → beste US-Stimme und Hinweis', () => {
    const voices = [{ name: 'Samantha', lang: 'en-US' }, { name: 'Daniel', lang: 'en-GB' }];
    expect(resolveVoice('Daniel', voices, 'Samantha')).toEqual({ name: 'Daniel', missing: false });
    expect(resolveVoice('Alex', voices, 'Samantha')).toEqual({ name: 'Samantha', missing: true });
    expect(resolveVoice('', voices, 'Samantha')).toEqual({ name: 'Samantha', missing: false });
  });
});

describe('Ton (Kap. 4.7)', () => {
  it('ohne AudioContext kein Fehler, nichts gespielt; aus = nie gespielt', () => {
    resetSoundForTests();
    expect(soundSupported()).toBe(false);
    expect(playCue('correct')).toBe(false);
    setSoundEnabled(true);
    expect(playCue('done')).toBe(false);
    resetSoundForTests();
  });
});
