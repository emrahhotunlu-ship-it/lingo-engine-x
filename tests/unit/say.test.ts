import { beforeAll, describe, expect, it } from 'vitest';
import { SITUATIONS } from '../../src/content/say/situations';
import { addDays } from '../../src/domain/date';
import { buildPlan, deriveToday, dutyMinutes, readPlan } from '../../src/domain/plan/buildPlan';
import { DUTY_CHANNELS, isSayDay, rankChannels, type RankInput } from '../../src/domain/plan/channels';
import { dutiesFeasible, pflichtFor } from '../../src/domain/plan/pflicht';
import type { StoredPlan } from '../../src/domain/plan/types';
import { profilePatch } from '../../src/domain/progress/profilePatch';
import { addRepairs } from '../../src/domain/repair/repair';
import { repairsFromCorrections, situationFor } from '../../src/domain/say/say';
import { compactSay, SAY_DOC_MAX_BYTES, sayId, upsertSayItem, type SayItem } from '../../src/domain/say/sayDoc';
import { jsonBytes } from '../../src/domain/speak/talkDoc';
import { validateDoc } from '../../src/data/validate';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { sayCheck, sayCheckSchema, type SayCheckVars } from '../../src/prompts/sayCheck';

// „Sag es“ (Lernberatung 27.09., V1/V2): Tagesauswahl, Plan, Pflicht, Monatsdokument,
// Reparatur-Sätze, Vorlage und feste Testantwort.

const round = { target: 22, due: 17, new: 5, ahead: 0 };
const data = { cloze: 12, order: 40, sprint: 60, vocab: 150 };
const base = (over: Partial<RankInput> = {}): RankInput => ({
  today: '2026-09-28',
  profile: { act: {}, ema: { recog: 0.7, write: 0.6, listen: 0.5, colloc: 0.65, all: 0.6 }, n: { recog: 50, write: 40, listen: 30, colloc: 25 } },
  focus: null,
  dueErrors: 0,
  dueCards: 5,
  data,
  env: { tts: true },
  ...over,
});

describe('Tagesauswahl isSayDay', () => {
  it('je Kalenderwoche (Mo–So) an 4 oder 5 Tagen, über zwei Jahre', () => {
    let monday = '2026-09-28'; // Montag
    const perWeek: number[] = [];
    for (let w = 0; w < 104; w++) {
      let n = 0;
      for (let d = 0; d < 7; d++) if (isSayDay(addDays(monday, d))) n++;
      perWeek.push(n);
      monday = addDays(monday, 7);
    }
    expect(perWeek.every((n) => n === 4 || n === 5)).toBe(true);
    // Beide Anzahlen kommen vor.
    expect(new Set(perWeek).size).toBe(2);
  });

  it('deterministisch: gleiche Wahl bei jedem Aufruf; ungültiger Schlüssel → nie', () => {
    for (let d = 0; d < 30; d++) {
      const day = addDays('2026-09-20', d);
      const first = isSayDay(day);
      for (let k = 0; k < 5; k++) expect(isSayDay(day)).toBe(first);
    }
    expect(isSayDay('kein-tag')).toBe(false);
    // Stichtage der Testdaten sind keine Sag-es-Tage (übrige E2E-Tests), der 23.09. ist einer (say.spec).
    for (const d of ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']) expect(isSayDay(d), d).toBe(false);
    expect(isSayDay('2026-09-23')).toBe(true);
  });
});

describe('Tagesplan mit „Sag es“', () => {
  const plan = (say: boolean, existing: unknown = null, today = '2026-09-28') =>
    buildPlan({ today, existing, round, nowMs: 1, phase2: { ranked: rankChannels(base({ today })), lesson: { lid: 'l07' }, say } });

  it('Sag-es-Tag mit Claude: Pflichtkanal say (8 Min.), Lektion nur Angebot, die beiden besten Kanäle bleiben Angebote', () => {
    const p = plan(true).plan;
    expect(p.ids[0]).toBe('say');
    // Lektion 2–3× je Woche statt täglich (Lernberatung): an Sag-es-Tagen keine Pflicht.
    expect(p.duty).toEqual(['review', 'ch:say']);
    expect(plan(false).plan.duty).toContain('lesson');
    expect(p.why[0]).toEqual([['whySay']]);
    expect(p.goal.ch).toBe(1);
    const ranked = rankChannels(base()).slice(0, 2).map((r) => r.id);
    expect(p.ids.slice(1)).toEqual(ranked);
    expect(dutyMinutes(p)).toBe(10 + 8);
  });

  it('ohne Sag-es-Tag bzw. ohne Claude: bisherige Wahl aus {gram, cloze}; Satzbau nie Pflicht', () => {
    const p = plan(false).plan;
    expect(DUTY_CHANNELS).toContain(p.ids[0]);
    expect(p.ids[0]).not.toBe('say');
    // Auch wenn Satzbau am höchsten steht, bleibt er Angebot.
    const focus = base({ focus: 'order' });
    const q = buildPlan({ today: '2026-09-28', existing: null, round, nowMs: 1, phase2: { ranked: rankChannels(focus), lesson: null } }).plan;
    expect(rankChannels(focus)[0]?.id).toBe('order');
    expect(q.ids[0]).not.toBe('order');
    expect(q.ids.slice(1)).toContain('order');
  });

  it('ein gespeicherter Plan von heute wird nie umgewürfelt – auch nicht an einem Sag-es-Tag', () => {
    const old = plan(false).plan;
    expect(buildPlan({ today: '2026-09-28', existing: old, round, nowMs: 5, phase2: { ranked: rankChannels(base()), lesson: null, say: true } })).toEqual({ plan: old, changed: false });
    const withSay = plan(true).plan;
    expect(readPlan(withSay, '2026-09-28')).toEqual(withSay);
    expect(buildPlan({ today: '2026-09-28', existing: withSay, round, nowMs: 5, phase2: { ranked: rankChannels(base()), lesson: null, say: false } }).plan).toEqual(withSay);
  });

  it('50× neu zeichnen → gleicher Plan', () => {
    const first = plan(true).plan;
    for (let k = 0; k < 50; k++) expect(plan(true).plan).toEqual(first);
  });
});

describe('Pflicht ch:say', () => {
  const day = '2026-09-28';
  const p: StoredPlan = { d: day, ids: ['say', 'gram', 'cloze'], why: [[['whySay']]], v: 1, duty: ['review', 'ch:say'], goal: { review: 2, ch: 1 }, lesson: null, at: 1 };

  it('erledigt mit act.say ≥ 1 (live oder Puffer); Einträge type:say zählen nicht als Antworten', () => {
    const open = deriveToday({ day, plan: p, entries: [], minutes: 0, exhausted: true, act: {} });
    expect(open.duties.missing).toEqual(['ch:say']);
    const done = deriveToday({ day, plan: p, entries: [{ t: 1, type: 'say', ok: true, id: 'cfo-price' }], minutes: 8, exhausted: true, act: { [day]: { say: 1 } } });
    expect(done.status).toBe('allDone');
    expect(done.balance.answers).toBe(0);
    const pending = deriveToday({ day, plan: p, entries: [], minutes: 0, exhausted: true, act: {}, pending: { lessonDays: [], rounds: [{ day, act: 'say', partial: false }] } });
    expect(pending.status).toBe('allDone');
  });

  it('pflichtFor und dutiesFeasible: auch ohne Claude erfüllbar (Speichern ohne Prüfung)', () => {
    const input = { day, plan: p, profile: { days: { [day]: 1 }, act: { [day]: { say: 1 } } }, batchActivity: false, reviewDone: true, exhausted: false, course: null, pendingLessonDay: false };
    expect(pflichtFor(input)).toBe(true);
    expect(pflichtFor({ ...input, profile: { days: { [day]: 1 }, act: { [day]: {} } } })).toBe(false);
    expect(dutiesFeasible(p, { tts: false, ai: false }, { cloze: 0, order: 0 })).toBe(true);
  });

  it('Rundenende act:say zählt act, Minuten und 20 XP', () => {
    const cur = { days: {}, xpDays: {}, minutes: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0, ema: { recog: 0.5, write: 0.5, listen: 0.5, colloc: 0.5 }, n: { recog: 0, write: 0, listen: 0, colloc: 0 } };
    const patch = profilePatch(cur, [], [{ day, act: 'say', partial: false, n: 1, right: 1, activeMs: 7 * 60_000, countAs: 1 }], { deviceId: 'tab1', seq: 1 });
    expect(patch).toMatchObject({ act: { [day]: { say: 1 } }, minutes: { [day]: 7 } });
    expect(Number((patch as { xp: number }).xp)).toBeGreaterThanOrEqual(20);
  });
});

describe('say/<Monat>', () => {
  const item = (over: Partial<SayItem> = {}): SayItem => ({
    id: sayId('cfo-price', 1_790_000_000_000),
    t: 1_790_000_000_000,
    day: '2026-09-28',
    sit: 'cfo-price',
    kind: 'job',
    a1: 'We are working with them since 2019.',
    a2: '',
    fb1: null,
    fb2: null,
    ms: 60_000,
    lang: 'de',
    ai: true,
    ...over,
  });

  it('anlegen, idempotent ersetzen, Schema tolerant gültig', () => {
    const first = upsertSayItem(undefined, item());
    expect(first).toMatchObject({ set: { v: 1, month: '2026-09' } });
    const doc = (first as { set: Record<string, unknown> }).set;
    expect(validateDoc('say/2026-09', doc).ok).toBe(true);
    const second = upsertSayItem(doc, item({ a2: 'We have been working with them since 2019.' }));
    const items = (second as { update: { items: SayItem[] } }).update.items;
    expect(items).toHaveLength(1);
    expect(items[0]?.a2).toContain('have been');
    expect(upsertSayItem({ items: 'kaputt' }, item())).toBeNull();
  });

  it('kappt unter 200 KiB: zuerst die Rückmeldungen, dann die Texte, Kennzahlen bleiben', () => {
    const fb = { corrections: [], upgrades: [], better: 'x'.repeat(1400), praise: 'Gut.' };
    const many = Array.from({ length: 60 }, (_, i) => item({ id: `say-${i}`, t: i, a1: 'a'.repeat(1400), a2: 'b'.repeat(1400), fb1: fb, fb2: fb }));
    const out = compactSay(many, '2026-09') as SayItem[];
    expect(jsonBytes({ v: 1, month: '2026-09', items: out })).toBeLessThanOrEqual(SAY_DOC_MAX_BYTES);
    expect(out).toHaveLength(60);
    expect(out[0]?.fb1).toBeNull();
    expect(out.at(-1)?.fb1).not.toBeNull();
    expect(out.every((x) => x.sit === 'cfo-price' && x.ms === 60_000)).toBe(true);
  });
});

describe('Situationen und Reparatur-Sätze', () => {
  it('etwa 40 Situationen, eindeutige Kennungen, zwei Drittel Beruf, beide Sprachen', () => {
    expect(SITUATIONS.length).toBeGreaterThanOrEqual(38);
    expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length);
    const job = SITUATIONS.filter((s) => s.kind === 'job').length;
    expect(job / SITUATIONS.length).toBeGreaterThan(0.6);
    expect(job / SITUATIONS.length).toBeLessThan(0.72);
    for (const s of SITUATIONS) {
      expect(s.de.length).toBeGreaterThan(20);
      expect(s.en.length).toBeGreaterThan(20);
    }
  });

  it('Situation des Tages: fest je Tag, „Andere Situation“ wechselt', () => {
    const a = situationFor(SITUATIONS, '2026-09-28');
    expect(situationFor(SITUATIONS, '2026-09-28')).toEqual(a);
    expect(situationFor(SITUATIONS, '2026-09-28', 1)?.id).not.toBe(a?.id);
    expect(situationFor([], '2026-09-28')).toBeNull();
  });

  it('Korrektur → ganzer eigener Satz mit Ersetzung; ohne Treffer bleibt der Ausschnitt', () => {
    const text = 'Thanks for your question. We are working with them since 2019 and they are happy. Can we discuss about the price next week?';
    const r = repairsFromCorrections(
      text,
      [
        { wrong: 'We are working with them since 2019', right: 'We have been working with them since 2019', why: 'Present Perfect Continuous.' },
        { wrong: 'discuss about', right: 'discuss', why: 'Ohne „about“.' },
        { wrong: 'not in the text', right: 'fixed', why: 'x' },
      ],
      'CFO: zu teuer',
    );
    expect(r[0]).toMatchObject({ wrong: 'We are working with them since 2019 and they are happy.', right: 'We have been working with them since 2019 and they are happy.', src: 'say', ctx: 'CFO: zu teuer' });
    expect(r[1]).toMatchObject({ wrong: 'Can we discuss about the price next week?', right: 'Can we discuss the price next week?' });
    expect(r[2]).toMatchObject({ wrong: 'not in the text', right: 'fixed' });
    // Die Ablage nimmt sie an (Boxen 1/3/9, eigene Logik unverändert).
    expect(addRepairs([], r, 1)?.length).toBe(3);
  });
});

describe('say-check@2', () => {
  const sample = createFakeSample(() => 'ok', () => ({}), 0);
  beforeAll(() => registerCannedReplies());
  const text = 'Thank you for the feedback. I understand your concern about the price. We are working with them since 2019 and they save a lot of time. Can we discuss about the numbers next week? Please send me your current costs.';

  it('Kopfzeile, Situation, Text im Rahmen, Erklärungssprache', () => {
    const v: SayCheckVars = { situation: 'The CFO says: "Too expensive."', kind: 'job', text, uiLang: 'en' };
    const p = sayCheck.build(v);
    expect(p.startsWith('[say-check@2]')).toBe(true);
    expect(p).toContain('Explanation language: English');
    expect(p).toContain('<<<TEXT');
    expect(p).toContain('British spelling and British words are ALWAYS correct');
    expect(sayCheck.tier).toBe('default');
  });

  it('feste Testantwort besteht das Schema in beiden Sprachen; Korrekturen stehen wörtlich im Text', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v: SayCheckVars = { situation: 'The CFO says: "Too expensive."', kind: 'job', text, uiLang };
      const raw = await sample.json<unknown>(sayCheck.build(v));
      const r = sayCheckSchema(v).safeParse(raw);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      expect(r.data.corrections.length).toBe(2);
      for (const c of r.data.corrections) expect(text).toContain(c.wrong);
      expect(r.data.upgrades[0]?.phrase).toBe("I'd suggest that we");
      expect(r.data.better.length).toBeGreaterThan(50);
    }
    // Zweiter Durchgang ohne Fehler: keine Korrekturen, keine Aufwertung.
    const clean = 'Thank you for your feedback. We have been working with similar companies since 2019. Could we discuss the numbers next week? I would be happy to walk you through the savings in detail.';
    const v2: SayCheckVars = { situation: 'x situation text', kind: 'job', text: clean, uiLang: 'de' };
    const r2 = sayCheckSchema(v2).parse(await sample.json<unknown>(sayCheck.build(v2)));
    expect(r2.corrections).toEqual([]);
    expect(r2.upgrades).toEqual([]);
  });

  it('tolerant: fehlende Listen, zu viele Einträge, Wendung nicht im Satz → geleert statt abgelehnt', () => {
    const v = { text, uiLang: 'de' as const };
    const ok = sayCheckSchema(v).parse({ better: 'We have been working with them since 2019.', praise: 'Guter, klarer Aufbau deiner Antwort.' });
    expect(ok).toMatchObject({ corrections: [], upgrades: [] });
    const five = Array.from({ length: 6 }, (_, i) => ({ wrong: `w${i}`, right: `r${i}`, why: 'Hier fehlt das Hilfsverb.' }));
    const up = { from: 'a', to: 'I would suggest a short call.', why: 'Höflicher als eine Anweisung.', phrase: 'not in there', de: 'x', def: 'y' };
    const r = sayCheckSchema(v).parse({ corrections: five, upgrades: [up, up, up], better: 'Better text in English.', praise: 'Gut gemacht, klarer Aufbau.' });
    expect(r.corrections).toHaveLength(4);
    expect(r.upgrades).toHaveLength(2);
    expect(r.upgrades[0]?.phrase).toBe('');
  });

  it('Sprachtreue: Begründung in der falschen Sprache wird abgelehnt (Neuversuch des KI-Tors)', () => {
    const v = { text, uiLang: 'de' as const };
    const bad = sayCheckSchema(v).safeParse({ corrections: [{ wrong: 'a', right: 'b', why: 'You need the present perfect here because the action continues.' }], upgrades: [], better: 'Text.', praise: 'Gut gemacht, klarer Aufbau.' });
    expect(bad.success).toBe(false);
  });
});
