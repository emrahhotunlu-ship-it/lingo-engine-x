import { beforeAll, describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { dayKey, isoWeek } from '../../src/domain/date';
import { drillTasks } from '../../src/domain/patterns/drill';
import { collectMistakes, uniqueMistakes, type Mistake } from '../../src/domain/patterns/mistakes';
import {
  capPatterns,
  countWeeks,
  focusLine,
  matchPattern,
  mergeHistory,
  patternHintsOf,
  patternsDue,
  patternSlug,
  readPatterns,
  recentWeeks,
  topPatterns,
  trendOf,
  weekFocus,
  withFocusLine,
  type Pattern,
  type PatternsDoc,
} from '../../src/domain/patterns/patterns';
import { addRepairs } from '../../src/domain/repair/repair';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { promptBytes, PROMPT_MAX_BYTES } from '../../src/prompts/common';
import { patternCheck } from '../../src/prompts/patternCheck';
import { mistakeLines, patterns as patternsTemplate, patternsSchema, type PatternsVars } from '../../src/prompts/patterns';
import { sayCheck } from '../../src/prompts/sayCheck';
import { turnAnalysis } from '../../src/prompts/turnAnalysis';

// Persönliche „Deutsch-Fallen“ (Lernberatung 27.09., V3) und Wochenfokus (V8/Nr. 9):
// Quellen, lokale Zählung, Verlauf, Fokus, Drill, Vorlagen und feste Testantworten.

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-24T12:00:00+02:00'); // Donnerstag, KW 39
const LAST_WEEK = NOW - 7 * DAY;
const TODAY = dayKey(NOW);

const SINCE: Pattern = {
  id: 'since-present',
  title_de: '„since“ mit Gegenwart',
  title_en: '“since” with the present tense',
  rule: 'Seit einem Zeitpunkt bis jetzt: Present Perfect.',
  examples: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }],
  count: 3,
  keys: ['since'],
  tasks: ['Say how long you have worked for your company.', 'Tell a client how long you have known their CFO.', 'Third task.'],
};
const ACTUAL: Pattern = {
  id: 'actual-current',
  title_de: '„actual“ = „aktuell“',
  title_en: '“actual” used for “current”',
  rule: '„aktuell“ heißt „current“.',
  examples: [{ wrong: 'Our actual price list is attached.', right: 'Our current price list is attached.' }],
  count: 1,
  keys: ['actual'],
  tasks: ['Describe the current status of your project.'],
};

const doc = (items: Pattern[], history: PatternsDoc['history'] = [], d = TODAY): PatternsDoc => ({ d, t: NOW, lang: 'de', pv: 'patterns@1', items, history });

describe('Fehlerquellen', () => {
  it('liest alle Quellen tolerant, Lücke gefüllt, Radar mit Satz, gleicher Satz am selben Tag einmal', () => {
    const grammar = new Map([['present_perfect', { errors: [{ q: 'I ___ here since 2020.', given: 'work', ans: 'have worked', t: NOW }, { q: 'kaputt', given: '', ans: 'x' }] }]]);
    const talk = new Map([['2026-09', { runs: [{ t: NOW - DAY, report: { focus: [{ said: 'I make my homework in the evening.', better: 'I do my homework in the evening.', cat: 'collocation' }] } }] }]]);
    const writing = new Map([['w1790000000000', { t: NOW - 2 * DAY, res: { errors: [{ orig: 'Our actual offer', fix: 'Our current offer', cat: 'vocabulary' }] } }]]);
    const preply = new Map([['pi1790000000000', { t: LAST_WEEK, corrections: [{ wrong: 'I become the report tomorrow.', right: 'I will get the report tomorrow.' }] }]]);
    const say = new Map([['2026-09', { items: [{ t: NOW, fb1: { corrections: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }] } }] }]]);
    const radar = { events: [{ q: 'She go to work.', g: 'go', a: 'goes', t: NOW - 3 * DAY, c: 'tenses' }] };
    const repair = { items: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.', t: NOW + 1000 }] };
    const list = collectMistakes({ grammar, talk, writing, preply, say, radar, repair, });
    const wrongs = list.map((m) => m.wrong);
    expect(wrongs).toContain('I work here since 2020.');
    expect(list.find((m) => m.wrong === 'I work here since 2020.')?.right).toBe('I have worked here since 2020.');
    expect(wrongs).toContain('She go to work.');
    expect(list.find((m) => m.src === 'radar')?.right).toBe('She goes to work.');
    expect(wrongs).toContain('Our actual offer');
    expect(wrongs).toContain('I become the report tomorrow.');
    expect(wrongs.filter((w) => w === 'We work together since 2019.')).toHaveLength(1);
    // Neueste zuerst.
    expect(list.map((m) => m.t)).toEqual([...list.map((m) => m.t)].sort((a, b) => b - a));
    // Fremd geformte Quellen: nichts, kein Fehler.
    expect(collectMistakes({ grammar: new Map([['x', { errors: 'kaputt' }]]), radar: { events: {} }, repair: { items: null } })).toEqual([]);
  });

  it('uniqueMistakes: jeder Satz nur einmal', () => {
    const m: Mistake[] = [
      { src: 'say', wrong: 'A since B.', right: 'C', t: 2 },
      { src: 'talk', wrong: 'a since b', right: 'C', t: 1 },
    ];
    expect(uniqueMistakes(m)).toHaveLength(1);
  });
});

describe('app/patterns lesen, kappen, prüfen', () => {
  it('tolerant, höchstens 8 Muster, keine doppelten Kennungen, Verlauf ≤ 26 Wochen', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...SINCE, id: `p-${i}` }));
    const r = readPatterns({ d: TODAY, items: [...many, { id: 'p-0', title_de: 'doppelt' }, 'kaputt', { id: '' }], history: [{ w: 'x' }, { w: '2026-W39', counts: { a: 2, b: 'x' } }] });
    expect(r?.items).toHaveLength(8);
    expect(r?.history).toEqual([{ w: '2026-W39', counts: { a: 2 } }]);
    expect(readPatterns(null)).toBeNull();
    expect(capPatterns([...many, SINCE])).toHaveLength(8);
    expect(patternSlug('Since + Present!!')).toBe('since-present');
  });

  it('das geschriebene Dokument besteht das Schema', () => {
    const d = { ...doc([SINCE, ACTUAL], [{ w: '2026-W39', counts: { 'since-present': 2 } }]) };
    expect(validateDoc('app/patterns', d).ok).toBe(true);
    expect(validateDoc('app/patterns', { items: [{ id: 1 }] }).ok).toBe(false);
  });
});

describe('lokale Zählung und Verlauf (ohne KI)', () => {
  const mistakes: Mistake[] = [
    { src: 'say', wrong: 'We work together since 2019.', right: 'x', t: NOW },
    { src: 'talk', wrong: 'I live in Hamburg since five years.', right: 'x', t: NOW - DAY },
    { src: 'write', wrong: 'Our actual price list is attached.', right: 'x', t: LAST_WEEK },
    { src: 'write', wrong: 'The actual numbers look good.', right: 'x', t: LAST_WEEK },
    { src: 'write', wrong: 'We lived there since ages.', right: 'x', t: LAST_WEEK },
    { src: 'grammar', wrong: 'She go to work.', right: 'x', t: NOW },
  ];

  it('Beispielsatz zuerst, dann Stichwort; kein Treffer → null', () => {
    expect(matchPattern({ wrong: 'we work together since 2019' }, [ACTUAL, SINCE])).toBe('since-present');
    expect(matchPattern({ wrong: 'The actual numbers look good.' }, [SINCE, ACTUAL])).toBe('actual-current');
    expect(matchPattern({ wrong: 'She go to work.' }, [SINCE, ACTUAL])).toBeNull();
    // Stichwort nur als ganzes Wort.
    expect(matchPattern({ wrong: 'This is factual.' }, [ACTUAL])).toBeNull();
  });

  it('Wochen zählen, Trend „letzte Woche → diese Woche“', () => {
    const weeks = recentWeeks(TODAY, 2);
    expect(weeks).toEqual([isoWeek(dayKey(LAST_WEEK)), isoWeek(TODAY)]);
    const counted = countWeeks(mistakes, [SINCE, ACTUAL], weeks);
    expect(counted[1]?.counts).toEqual({ 'since-present': 2 });
    expect(counted[0]?.counts).toEqual({ 'actual-current': 2, 'since-present': 1 });
    const tr = trendOf(counted, 'actual-current', weeks[0]!, weeks[1]!);
    expect(tr).toEqual({ id: 'actual-current', prev: 2, cur: 0, trend: 'fewer' });
    expect(trendOf(counted, 'since-present', weeks[0]!, weeks[1]!).trend).toBe('more');
    expect(trendOf(counted, 'x', weeks[0]!, weeks[1]!).trend).toBe('same');
  });

  it('Verlauf zusammenführen: je Woche das Maximum, sortiert, gekappt', () => {
    const merged = mergeHistory([{ w: '2026-W38', counts: { a: 3 } }], [{ w: '2026-W38', counts: { a: 1, b: 2 } }, { w: '2026-W39', counts: {} }]);
    expect(merged).toEqual([
      { w: '2026-W38', counts: { a: 3, b: 2 } },
      { w: '2026-W39', counts: {} },
    ]);
    const long = Array.from({ length: 40 }, (_, i) => ({ w: `2026-W${String(i + 1).padStart(2, '0')}`, counts: {} }));
    expect(mergeHistory(long, [])).toHaveLength(26);
  });

  it('Top-Muster nach den letzten zwei Wochen; Hinweise für die Prompts (Englisch)', () => {
    const d = doc([ACTUAL, SINCE], countWeeks(mistakes, [SINCE, ACTUAL], recentWeeks(TODAY, 2)));
    expect(topPatterns(d, TODAY, 1).map((p) => p.id)).toEqual(['since-present']);
    expect(patternHintsOf(d, TODAY)).toEqual(['“since” with the present tense', '“actual” used for “current”']);
    expect(patternHintsOf(null, TODAY)).toEqual([]);
  });

  it('neu erkennen höchstens einmal je ISO-Woche, nur wenn es schon Muster gibt', () => {
    expect(patternsDue(null, TODAY)).toBe(false);
    expect(patternsDue(doc([SINCE]), TODAY)).toBe(false);
    expect(patternsDue(doc([SINCE], [], dayKey(LAST_WEEK)), TODAY)).toBe(true);
    expect(patternsDue(doc([], [], dayKey(LAST_WEEK)), TODAY)).toBe(false);
  });
});

describe('Wochenfokus Preply ↔ App (V8)', () => {
  const names = (id: string) => (id === 'articles' ? { de: 'Artikel', en: 'Articles' } : null);

  it('Muster aus dem letzten Import zuerst, höchstens 3, Themen füllen auf', () => {
    const d = doc([SINCE, ACTUAL], [{ w: isoWeek(TODAY), counts: { 'since-present': 5 } }]);
    const imp = { corrections: [{ wrong: 'The actual plan is fine.', right: 'The current plan is fine.' }, { wrong: 'I need an information.', right: 'I need some information.', topic: 'articles' }] };
    const f = weekFocus(d, imp, TODAY, names);
    expect(f.map((x) => x.id)).toEqual(['actual-current', 'since-present', 'topic:articles']);
    expect(f[2]).toMatchObject({ de: 'Artikel', en: 'Articles', patternId: null });
    expect(weekFocus(null, null, TODAY, names)).toEqual([]);
  });

  it('Nachricht an den Lehrer: „Please pay attention to: …“ genau einmal', () => {
    const f = weekFocus(doc([SINCE, ACTUAL]), null, TODAY, names);
    expect(focusLine(f)).toBe('Please pay attention to: “since” with the present tense; “actual” used for “current”.');
    const msg = withFocusLine('Hi! Could we practice objections?', f);
    expect(msg).toBe('Hi! Could we practice objections?\n\nPlease pay attention to: “since” with the present tense; “actual” used for “current”.');
    expect(withFocusLine(msg, f)).toBe(msg);
    expect(withFocusLine('Hi', [])).toBe('Hi');
  });
});

describe('Kurzdrill', () => {
  it('bis zu 4 eigene Sätze (Beispiele zuerst), dann 2–3 freie – zusammen etwa 6', () => {
    const mistakes: Mistake[] = [
      { src: 'say', wrong: 'I live in Hamburg since five years.', right: 'I have lived in Hamburg for five years.', t: 3 },
      { src: 'talk', wrong: 'We know them since the fair.', right: 'We have known them since the fair.', t: 2 },
      { src: 'write', wrong: 'Our actual price list is attached.', right: 'Our current price list is attached.', t: 1 },
    ];
    const t = drillTasks(SINCE, mistakes, [SINCE, ACTUAL]);
    expect(t.map((x) => x.kind)).toEqual(['fix', 'fix', 'fix', 'free', 'free', 'free']);
    expect(t[0]).toMatchObject({ kind: 'fix', wrong: 'We work together since 2019.' });
    const few = drillTasks({ ...ACTUAL, tasks: [] }, mistakes, [SINCE, ACTUAL]);
    expect(few).toEqual([{ kind: 'fix', wrong: 'Our actual price list is attached.', right: 'Our current price list is attached.' }]);
  });

  it('Reparatur-Sätze mit Quelle „pattern“ werden angenommen', () => {
    const r = addRepairs([], [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.', src: 'pattern', ctx: SINCE.title_en }], NOW);
    expect(r?.[0]).toMatchObject({ src: 'pattern', box: 0 });
    expect(validateDoc('app/repair', { items: r }).ok).toBe(true);
  });
});

describe('patterns@1 und pattern-check@1', () => {
  const sample = createFakeSample(() => 'ok', () => ({}), 0);
  beforeAll(() => registerCannedReplies());
  const mistakes = [
    { wrong: 'We work together since 2019.', right: 'We have been working together since 2019.', src: 'say' },
    { wrong: 'I live in Hamburg since five years.', right: 'I have lived in Hamburg for five years.', src: 'talk' },
    { wrong: 'Our actual price list is attached.', right: 'Our current price list is attached.', src: 'write' },
    { wrong: 'I become the report tomorrow.', right: 'I will get the report tomorrow.', src: 'preply' },
    { wrong: 'We look forward to hear from you.', right: 'We look forward to hearing from you.', src: 'grammar' },
  ];

  it('Kopfzeile, complex, Fehlerliste im Prompt, 64-KiB-Grenze auch bei sehr vielen Fehlern', () => {
    const p = patternsTemplate.build({ mistakes, uiLang: 'de' });
    expect(p.split('\n')[0]).toBe('[patterns@1]');
    expect(patternsTemplate.tier).toBe('complex');
    expect(p).toContain('- [say] We work together since 2019. => We have been working together since 2019.');
    expect(p).toContain('Explanation language: German');
    const huge = Array.from({ length: 2000 }, (_, i) => ({ wrong: `Sentence number ${i} ${'x'.repeat(400)}`, right: 'y'.repeat(400), src: 'say' }));
    expect(promptBytes(patternsTemplate.build({ mistakes: huge, uiLang: 'en' }))).toBeLessThan(PROMPT_MAX_BYTES);
    expect(mistakeLines(huge).length).toBeLessThanOrEqual(300);
  });

  it('feste Testantwort besteht das Schema in beiden Sprachen; Beispiele wörtlich aus der Liste', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v: PatternsVars = { mistakes, uiLang };
      const r = patternsSchema(v).safeParse(await sample.json<unknown>(patternsTemplate.build(v)));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      const ids = r.data.patterns.map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining(['since-present', 'actual-current', 'become-get', 'look-forward-ing']));
      for (const p of r.data.patterns) for (const ex of p.examples) expect(mistakes.map((m) => m.wrong)).toContain(ex.wrong);
      expect(r.data.patterns.length).toBeLessThanOrEqual(8);
    }
  });

  it('erfundene Beispiele fallen weg, Muster ohne Beleg ganz; falsche Sprache → Neuversuch', () => {
    const v: PatternsVars = { mistakes, uiLang: 'de' };
    const base = { id: 'since', title_de: '„since“ mit Gegenwart', title_en: '“since” with present', rule: 'Seit einem Zeitpunkt bis jetzt steht das Present Perfect.', count: '2', keys: ['Since'], tasks: ['Say how long you have lived in your city.', 'Wie lange arbeitest du schon dort und warum?'] };
    const ok = patternsSchema(v).parse({ patterns: [{ ...base, examples: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }, { wrong: 'Invented sentence here.', right: 'x' }] }, { ...base, id: 'made-up', examples: [{ wrong: 'Nothing like this.', right: 'y' }] }] });
    expect(ok.patterns).toHaveLength(1);
    expect(ok.patterns[0]).toMatchObject({ id: 'since', count: 2, keys: ['since'], tasks: ['Say how long you have lived in your city.'] });
    expect(ok.patterns[0]?.examples).toHaveLength(1);
    expect(patternsSchema(v).parse({ patterns: [] }).patterns).toEqual([]);
    expect(patternsSchema(v).parse({}).patterns).toEqual([]);
    const wrongLang = patternsSchema(v).safeParse({ patterns: [{ ...base, rule: 'From a point in the past until now you should use the present perfect.', examples: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }] }] });
    expect(wrongLang.success).toBe(false);
  });

  it('pattern-check@1: quick, Urteil ohne Widerspruch, feste Antwort in beiden Richtungen', async () => {
    const v = { pattern: SINCE.title_en, example: 'We work together since 2019. => We have been working together since 2019.', task: SINCE.tasks[0]!, sentence: 'I have worked here since 2018.', uiLang: 'de' as const };
    expect(patternCheck.build(v).split('\n')[0]).toBe('[pattern-check@1]');
    expect(patternCheck.tier).toBe('quick');
    const good = patternCheck.schema(v).parse(await sample.json<unknown>(patternCheck.build(v)));
    expect(good).toMatchObject({ verdict: 'correct', avoided: true });
    const bad = patternCheck.schema(v).parse(await sample.json<unknown>(patternCheck.build({ ...v, sentence: 'zzno I work here since 2018.' })));
    expect(bad).toMatchObject({ verdict: 'wrong', avoided: false });
    expect(bad.fixed.length).toBeGreaterThan(0);
    expect(patternCheck.schema(v).safeParse({ verdict: 'correct', avoided: false, fixed: '', why: 'Der Satz ist gut und richtig gebaut.' }).success).toBe(false);
  });
});

describe('Hinweis auf die Top-3-Muster in Rollenspiel-Analyse und „Sag es“', () => {
  it('turn-analysis@2 und say-check@2 nennen die Muster, sonst „(none)“', () => {
    const ta = { goal: 'Keep Q2.', role: 'CFO', personaLine: 'Why?', history: [], sentence: 'We work since 2019 with them.', focusWords: [], uiLang: 'de' as const };
    expect(turnAnalysis.build({ ...ta, watch: ['“since” with the present tense', 'make/do'] })).toContain('pay special attention to these): “since” with the present tense; make/do');
    expect(turnAnalysis.build(ta)).toContain('pay special attention to these): (none)');
    const sc = { situation: 'A client asks.', kind: 'job' as const, text: 'We work with them since 2019 and it is good.', uiLang: 'en' as const };
    expect(sayCheck.build({ ...sc, watch: ['a', 'b', 'c', 'd'] })).toContain('pay special attention to these): a; b; c\n');
    expect(sayCheck.build(sc)).toContain('pay special attention to these): (none)');
  });
});
