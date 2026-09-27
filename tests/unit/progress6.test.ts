import { describe, expect, it } from 'vitest';
import { canDoStatus, canDoSummary, CANDO_ITEMS, type CanDoEnv, type CanDoItem } from '../../src/domain/progress/cando';
import { heatmap, historyPatch, historySeries, historySnapshot, HISTORY_MAX } from '../../src/domain/progress/history';
import { bktMeasures, fsrsMeasures } from '../../src/domain/progress/measures';
import { catTopic, radarView } from '../../src/domain/progress/radar';
import { lastWeekOf, weekDays, weekFacts, weekStart } from '../../src/domain/progress/weekly';
import { vocabGoal } from '../../src/domain/vocab/goal';
import { buildTrainCards } from '../../src/domain/srs/cards';
import { dayKey } from '../../src/domain/date';
import { storedWeekly, weeklyOp, factLine } from '../../src/features/progress/weeklyRun';
import { weeklyExample, weeklyReport, weeklySchema } from '../../src/prompts/weeklyReport';
import { weeklyReply } from '../../src/platform/dev/canned/weekly';
import { berlin, loadSeed, type Doc } from './helpers';

const seed = loadSeed();
const DAY = 86_400_000;
const now = berlin('2026-09-20', 21);

// Zeitmatrix (Plan §13): Stichtag, Lerntagwechsel um 04:00, Ende der Sommerzeit, Jahreswechsel (W53).
const MATRIX = [
  { name: 'Stichtag', ms: berlin('2026-09-20', 21), day: '2026-09-20' },
  { name: '27.09. 00:30 (zählt zum Vortag)', ms: berlin('2026-09-27', 0, 30), day: '2026-09-26' },
  { name: '27.09. 04:30', ms: berlin('2026-09-27', 4, 30), day: '2026-09-27' },
  { name: 'Ende der Sommerzeit', ms: Date.parse('2026-10-25T12:00:00+01:00'), day: '2026-10-25' },
  { name: 'Silvester', ms: Date.parse('2026-12-31T20:00:00+01:00'), day: '2026-12-31' },
  { name: 'Neujahr 03:00 (noch 31.12.)', ms: Date.parse('2027-01-01T03:00:00+01:00'), day: '2026-12-31' },
];

function collection(name: string): Map<string, Doc> {
  const out = new Map<string, Doc>();
  for (const [p, d] of Object.entries(seed)) if (p.startsWith(`${name}/`) && p.split('/').length === 2) out.set(p.slice(name.length + 1), d);
  return out;
}

describe('Fehler-Radar (Plan §7.1)', () => {
  it('30 gegen 30 Tage, Trend, Quellen, höchstens zwei Beispiele, Aktion nur mit Thema', () => {
    const ev = [
      ...Array.from({ length: 5 }, (_, i) => ({ c: 'passive', s: 'g', t: now - i * DAY, q: 'q', g: `g${i}`, a: 'a' })),
      ...Array.from({ length: 2 }, (_, i) => ({ c: 'passive', s: 'w', t: now - (35 + i) * DAY, q: 'q', g: 'x', a: 'y' })),
      { c: 'tense', s: 'w', t: now - 40 * DAY, q: '', g: 'a', a: 'b' },
      { c: 'tense', s: 'w', t: now - 100 * DAY, q: '', g: 'a', a: 'b' },
      { c: 'mixed-cond', s: 'g', t: now - DAY, q: '', g: 'if I would', a: 'if I had' },
    ];
    const rows = radarView(ev, now);
    const p = rows.find((r) => r.c === 'passive')!;
    expect(p).toMatchObject({ kind: 'cat', n30: 5, nPrev30: 2, trend: 'more', sources: ['g'], action: 'errors:passive' });
    expect(p.examples).toHaveLength(2);
    const t = rows.find((r) => r.c === 'tense')!;
    expect(t).toMatchObject({ n30: 0, nPrev30: 1, trend: 'fewer', action: null });
    expect(rows.find((r) => r.c === 'mixed-cond')).toMatchObject({ kind: 'topic', action: 'errors:mixed-cond' });
    expect(catTopic('cond')).toBeNull();
    expect(radarView(null, now)).toEqual([]);
  });
  it('Testdaten: jede Zeile ohne undefined', () => {
    for (const r of radarView((seed['app/radar'] as Doc).events, now)) expect(JSON.stringify(r)).not.toContain('undefined');
  });
});

const env = (o: Partial<CanDoEnv> = {}): CanDoEnv => ({
  grammar: new Map(),
  vtest: null,
  colloc: { ema: null, n: 0 },
  radar: { n30: 0, nPrev30: 0 },
  writing: [],
  listening: [],
  speaking: null,
  self: {},
  ...o,
});
const item = (evidence: string, level = 'B2'): CanDoItem => ({ id: `x-${evidence}`, level, dim: 'grammar', de: '', en: '', tip_de: '', tip_en: '', evidence });

describe('Weg nach C1 (Plan §7.2)', () => {
  it('jede Belegart: erreicht, offen, dünn', () => {
    expect(canDoStatus(item('vocab_passive'), env())).toBe('thin');
    expect(canDoStatus(item('vocab_passive'), env({ vtest: { passive: 6400, active: 3900 } }))).toBe('reached');
    expect(canDoStatus(item('vocab_passive', 'C1'), env({ vtest: { passive: 6400, active: 3900 } }))).toBe('open');
    expect(canDoStatus(item('vocab_active'), env({ vtest: { passive: 6400, active: 3900 } }))).toBe('open');
    expect(canDoStatus(item('colloc'), env({ colloc: { ema: 0.8, n: 150 } }))).toBe('reached');
    expect(canDoStatus(item('colloc'), env({ colloc: { ema: 0.8, n: 50 } }))).toBe('thin');
    expect(canDoStatus(item('errors'), env({ radar: { n30: 10, nPrev30: 30 } }))).toBe('reached');
    expect(canDoStatus(item('errors'), env({ radar: { n30: 25, nPrev30: 60 } }))).toBe('open');
    expect(canDoStatus(item('writing'), env({ writing: [{ cefr: 'B2', register: 4 }, { cefr: 'B2+', register: 4 }, { cefr: 'C1', register: 5 }] }))).toBe('reached');
    expect(canDoStatus(item('writing'), env({ writing: [{ cefr: 'B1', register: 4 }, { cefr: 'B2', register: 4 }, { cefr: 'B2', register: 4 }] }))).toBe('open');
    expect(canDoStatus(item('writing_register'), env({ writing: [{ cefr: 'B2', register: 4 }, { cefr: 'B2', register: 5 }, { cefr: 'B2', register: 4 }] }))).toBe('reached');
    expect(canDoStatus(item('listening'), env({ listening: [{ level: 'B2', n: 5, ok: 5 }, { level: 'B2', n: 5, ok: 4 }, { level: 'C1', n: 5, ok: 4 }] }))).toBe('reached');
    expect(canDoStatus(item('fluency'), env({ speaking: 'B1+' }))).toBe('open');
    expect(canDoStatus(item('fluency'), env({ speaking: 'B2' }))).toBe('reached');
    const g = new Map([...['pres-perf-cont', 'past-simple-perfect', 'modals-deduction', 'reported', 'conditionals', 'gerund-inf', 'passive', 'future-forms', 'relative', 'articles', 'prepositions', 'future-perf-cont'].map((t) => [t, { p: 0.8, n: 10 }] as const)]);
    expect(canDoStatus(item('grammar'), env({ grammar: g }))).toBe('reached');
    expect(canDoStatus(item('grammar'), env())).toBe('thin');
  });
  it('Selbstmarkierung zählt als „self", eine Belegart „self" ist sonst offen', () => {
    expect(canDoStatus(item('self'), env())).toBe('open');
    expect(canDoStatus(item('self'), env({ self: { 'x-self': '2026-09-20' } }))).toBe('self');
    expect(canDoStatus(item('vocab_passive'), env({ self: { 'x-vocab_passive': '2026-09-20' } }))).toBe('self');
  });
  it('Zusammenfassung je Stufe über die 40 Punkte', () => {
    const sum = canDoSummary(CANDO_ITEMS, (i) => canDoStatus(i, env()));
    expect(sum.map((s) => s.level)).toEqual(['B2', 'C1']);
    expect(sum.reduce((a, s) => a + s.total, 0)).toBe(40);
  });
});

describe('Wochenbericht (Plan §7.3)', () => {
  it('ISO-Woche Mo–So, auch über den Jahreswechsel (2026-W53)', () => {
    expect(weekStart('2026-09-20')).toBe('2026-09-14');
    expect(weekDays('2026-12-31').w).toBe('2026-W53');
    expect(weekDays('2027-01-03').days[0]).toBe('2026-12-28');
    expect(lastWeekOf('2026-09-21').w).toBe('2026-W38');
    for (const m of MATRIX) {
      const today = dayKey(m.ms);
      expect(today).toBe(m.day);
      const w = lastWeekOf(today);
      expect(w.days).toHaveLength(7);
      expect(w.days[6]! < today).toBe(true);
    }
  });
  it('Fakten aus den Testdaten: Kennungen eindeutig, Zeitzeile, Prompt-Zeilen', () => {
    const { days } = weekDays('2026-09-20');
    const facts = weekFacts({ days, vocab: collection('vocab'), grammar: collection('grammar'), writing: collection('writing'), talk: collection('talk'), profile: seed['app/profile']! });
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
    expect(facts.some((f) => f.kind === 'time')).toBe(true);
    for (const f of facts) expect(factLine(f)).not.toMatch(/undefined|NaN/);
  });
  it('Wörter: eingeführt in der Woche und nach ≥ 1 Tag richtig wiederholt', () => {
    const vocab = new Map<string, Doc>([
      ['a', { word: 'leverage', intro: '2026-09-15', hist: [{ t: now - 5 * DAY, g: 3 }, { t: now - 3 * DAY, g: 3 }] }],
      ['b', { word: 'upsell', intro: '2026-09-15', hist: [{ t: now - 5 * DAY, g: 3 }] }],
      ['c', { word: 'churn', intro: '2026-09-01', fsrs: { stability: 10 } }],
    ]);
    const facts = weekFacts({ days: weekDays('2026-09-20').days, vocab, grammar: new Map(), writing: new Map(), talk: new Map(), profile: {} });
    expect(facts.map((f) => f.id)).toEqual(['vw:a']);
  });
  it('weekly-report@1: Beispiel besteht das Schema, Verweise nur auf Fakten, feste Antwort gültig', () => {
    const facts = [
      { id: 'vw:a', text: 'new word "x"' },
      { id: 'gt:passive', text: 'passive 50% → 60%' },
      { id: 'wt:w1', text: 'wrote a text' },
    ];
    for (const lang of ['de', 'en'] as const) {
      expect(weeklySchema({ lang, facts }).safeParse(weeklyExample({ lang, facts })).success).toBe(true);
      const prompt = weeklyReport.build({ lang, week: '2026-W38', facts });
      expect(prompt.split('\n')[0]).toBe('[weekly-report@1]');
      expect(weeklySchema({ lang, facts }).safeParse(JSON.parse(weeklyReply(prompt))).success).toBe(true);
    }
    const bad = { ...weeklyExample({ lang: 'de', facts }), learned: [{ text: 'Etwas Neues gelernt heute.', ref: 'erfunden' }, { text: 'Noch etwas gelernt.', ref: 'vw:a' }] };
    expect(weeklySchema({ lang: 'de', facts }).safeParse(bad).success).toBe(false);
    expect(weeklySchema({ lang: 'en', facts }).safeParse(weeklyExample({ lang: 'de', facts })).success).toBe(false);
  });
  it('app/weekly: gleiche Woche und Sprache ersetzt, andere Sprache bleibt, höchstens 26', () => {
    const item = (w: string, lang: 'de' | 'en') => ({ w, lang, t: 1, pv: 'weekly-report@1', facts: [], text: { headline: 'h', learned: [], next: 'n' } });
    expect(weeklyOp(undefined, item('2026-W38', 'de'))).toEqual({ set: { items: [item('2026-W38', 'de')] } });
    const cur = { items: [item('2026-W38', 'de'), item('2026-W38', 'en'), ...Array.from({ length: 30 }, (_, i) => item(`2025-W${i}`, 'de'))] };
    const op = weeklyOp(cur, item('2026-W38', 'de')) as { update: { items: Doc[] } };
    expect(op.update.items).toHaveLength(26);
    expect(storedWeekly({ items: [item('2026-W38', 'en')] }, '2026-W38', 'de')).toBeNull();
    expect(storedWeekly({ items: [item('2026-W38', 'en')] }, '2026-W38', 'en')).not.toBeNull();
  });
});

describe('Verlauf und Tagesbild (Plan §7.4)', () => {
  const profile = seed['app/profile']!;
  it('einmal je Tag, höchstens 120, gekennzeichnet mit lx:1', () => {
    const snap = historySnapshot({ day: '2026-09-20', nowMs: now, profile, grammar: collection('grammar'), vocabNow: 6500 });
    expect(snap.lx).toBe(1);
    expect(snap.vs).toBe(6500);
    expect(snap.gr).toBeGreaterThan(0);
    const patch = historyPatch({ ...profile, history: Array.from({ length: 130 }, (_, i) => ({ d: `2026-01-${i}` })) }, snap);
    expect((patch!.history as unknown[]).length).toBe(HISTORY_MAX);
    expect(historyPatch({ history: [{ d: '2026-09-20' }] }, snap)).toBeNull();
  });
  it('Reihen und Nahtstelle; Heatmap 26 Wochen ohne Zukunftstage', () => {
    const p = { history: [{ d: '2026-09-10', gr: 0.5, vo: 0.7 }, { d: '2026-09-19', gr: 0.55, vo: 0.72, lx: 1 }] };
    const { series, seam } = historySeries(p, '2026-09-20');
    expect(series.gr).toHaveLength(2);
    expect(seam).toBe('2026-09-19');
    const hm = heatmap(profile, '2026-09-20');
    expect(hm).toHaveLength(26);
    expect(hm.flat().every((c) => c.d <= '2026-09-20')).toBe(true);
  });
});

describe('Messwerte (Plan §7.5)', () => {
  it('FSRS-Zustände, Abrufwahrscheinlichkeit, Trefferquote', () => {
    const m = fsrsMeasures(collection('vocab'), now, collection('log'));
    const s = m.byState;
    expect(s.new + s.learning + s.review + s.relearning).toBeGreaterThan(100);
    expect(m.meanR).toBeGreaterThan(0);
    expect(m.meanR).toBeLessThanOrEqual(1);
  });
  it('BKT mit Anzeige-Verfall p0 + (p−p0)·e^(−t/45)', () => {
    const g = new Map<string, Doc>([['passive', { p: 0.9, n: 40, last: now - 45 * DAY, recent: [1, 0, 1] }]]);
    const row = bktMeasures(g, now).find((r) => r.id === 'passive')!;
    const p0 = 0.5;
    expect(row.p).toBeLessThan(0.9);
    expect(row.p).toBeGreaterThan(p0 - 0.2);
    expect(row.last10).toEqual({ ok: 2, n: 3 });
  });
});

describe('Wortschatzziel 8.000 (phase1-plan §4.9)', () => {
  it('Messwert aus dem letzten Test plus gefestigte Karten, Tempo und Wochen', () => {
    const cards = buildTrainCards(collection('vocab'), now);
    const g = vocabGoal({ profile: seed['app/profile'], cards, today: '2026-09-20' });
    expect(g.measured).toBe(true);
    expect(g.now).toBeGreaterThanOrEqual(6400);
    expect(g.band).toEqual([5900, 6900]);
    if (g.perWeek >= 1) expect(g.weeks).toBeGreaterThan(0);
  });
  it('ohne Test und Verlauf: nicht gemessen', () => {
    const g = vocabGoal({ profile: {}, cards: [], today: '2026-09-20' });
    expect(g).toMatchObject({ now: null, measured: false, weeks: null });
  });
});
