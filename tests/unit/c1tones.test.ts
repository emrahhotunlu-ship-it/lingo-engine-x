import { beforeAll, describe, expect, it } from 'vitest';
import grammarJson from '../../src/content/legacy/grammar.json';
import c1Json from '../../src/content/c1/toolkit.json';
import { TONE_MESSAGES, TONE_REGISTERS } from '../../src/content/tones/messages';
import { C1_TOPICS, LEGACY_TOPICS, TOPICS, topicById } from '../../src/domain/content';
import { actionTopic, allowedActions, isKnownAction } from '../../src/domain/assessment/actions';
import { toUS } from '../../src/domain/answer/spelling';
import { p0Of, topicP } from '../../src/domain/grammar/bkt';
import { checkGrammar } from '../../src/domain/grammar/check';
import { dueErrors } from '../../src/domain/grammar/errors';
import { topicCat } from '../../src/domain/grammar/radar';
import { ruleOf, examplesFor } from '../../src/domain/grammar/rules';
import { rankTopics, seedTasks, selectRound } from '../../src/domain/grammar/tasks';
import { grammarWrite } from '../../src/domain/grammar/write';
import { detectLang, isWrongLang } from '../../src/domain/lang/detect';
import { roundBonus } from '../../src/domain/progress/profilePatch';
import { jsonBytes } from '../../src/domain/monthDoc';
import { compactTones, messageFor, repairsFromTones, toneId, tonesPath, TONES_DOC_MAX_BYTES, upsertToneItem, type ToneItem } from '../../src/domain/tones/tones';
import { validateDoc } from '../../src/data/validate';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { ERROR_CATS } from '../../src/prompts/threeLayers';
import { toneCheck, toneCheckExample, toneCheckSchema, type ToneCheckVars } from '../../src/prompts/toneCheck';
import { grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { normalizeTask } from '../../src/domain/grammar/tasks';
import { answer } from './learnHelpers';
import { berlin } from './helpers';

// Lernberatung 27.09., Vorschlag 7 (C1-Werkzeugkasten) und 8 (Eine Botschaft, drei Tonlagen):
// Themen gültig und lösbar, Sprachtreue, alles läuft in Grammatik, BKT, Fehler-Wiederholung,
// Einschätzung und Tagesplan mit; tone-check@1, feste Testantwort, Monatsdokument, Reparatur-Sätze.

const now = berlin('2026-09-27', 10);
const C1_IDS = ['c1-hedging', 'c1-diplomacy', 'c1-emphasis', 'c1-discourse', 'c1-nominal', 'c1-participle', 'c1-precision'];
const c1Seed = () => seedTasks().filter((t) => t.topic.startsWith('c1-'));

describe('C1-Werkzeugkasten: Themen', () => {
  it('7 neue Themen mit Präfix c1-, die 16 alten unverändert und zuerst', () => {
    expect(C1_TOPICS.map((t) => t.id)).toEqual(C1_IDS);
    expect(LEGACY_TOPICS.map((t) => t.id)).toEqual(grammarJson.topics.map((t) => t.id));
    expect(LEGACY_TOPICS).toHaveLength(16);
    expect(TOPICS.map((t) => t.id)).toEqual([...grammarJson.topics.map((t) => t.id), ...C1_IDS]);
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
  });

  it('gleiches Format wie die alten Themen: Gruppe, Stufe, p0, Name und Regel DE/EN, Beispiele', () => {
    const legacyKeys = Object.keys(grammarJson.topics[0]!).sort();
    for (const tp of C1_TOPICS) {
      expect(Object.keys(tp).sort(), tp.id).toEqual(legacyKeys);
      expect(tp.level).toBe('C1');
      expect(tp.group).toBe('C1-Werkzeugkasten');
      expect(tp.p0).toBeGreaterThan(0.3);
      expect(tp.p0).toBeLessThan(0.7);
      expect(p0Of(tp.id)).toBe(tp.p0);
      expect(topicP(tp.id, undefined, now)).toBe(tp.p0);
      expect(tp.ex?.length).toBeGreaterThanOrEqual(2);
      expect(topicById(tp.id)).toBe(tp);
    }
  });

  it('Regelblatt je Thema in beiden Sprachen (Kern, Warum, Kontrast, Schritte, Formen, Fallen)', () => {
    const bad: string[] = [];
    for (const id of C1_IDS) {
      for (const lang of ['de', 'en'] as const) {
        const r = ruleOf(id, lang);
        expect(r, `${id} ${lang}`).not.toBeNull();
        if (!r) continue;
        for (const text of [r.core, r.why, r.contrast, ...r.steps]) {
          expect(text.trim(), `${id} ${lang}`).not.toBe('');
          if (isWrongLang(text, lang)) bad.push(`${id} ${lang}: ${text}`);
        }
        expect(r.forms.length).toBeGreaterThanOrEqual(3);
        expect(r.traps.length).toBeGreaterThanOrEqual(1);
      }
      expect(examplesFor(id).length).toBeGreaterThanOrEqual(2);
    }
    expect(bad).toEqual([]);
  });

  it('Sprachtreue: Namen/Regeln in ihrer Sprache, englische Inhalte in US-Schreibweise', () => {
    for (const tp of C1_TOPICS) {
      expect(/[äöüß]/.test(tp.name_en ?? ''), tp.id).toBe(false);
      expect(detectLang(tp.rule ?? ''), `${tp.id}: ${tp.rule}`).not.toBe('en');
      expect(detectLang((tp as { rule_en?: string }).rule_en ?? '')).not.toBe('de');
    }
    const english: string[] = [];
    for (const tp of C1_TOPICS) english.push(...(tp.ex ?? []));
    for (const t of c1Json.tasks) english.push(t.prompt, t.answer, ...(t.accepted ?? []), ...(t.options ?? []));
    for (const r of Object.values(c1Json.rules)) {
      for (const f of r.forms) english.push(f[2] as string);
      for (const tr of r.traps) english.push(tr.bad, tr.good);
    }
    for (const s of english) {
      for (const w of s.toLowerCase().match(/[a-z]+/g) ?? []) expect(toUS(w), `${w} in „${s}“`).toBe(w);
      expect(/[äöüß]/.test(s), s).toBe(false);
    }
  });
});

describe('C1-Werkzeugkasten: Aufgaben', () => {
  it('Prüfbefunde Paket 2: Abschwächen mit Auftrag, „Roughly“ ehrlich begründet', () => {
    const tasks = (c1Json as { tasks: Array<{ prompt: string; expl?: string; expl_en?: string; answer?: string }> }).tasks;
    expect(tasks.some((x) => x.prompt === 'Soften this for a client: Your price ___ a bit above our budget.')).toBe(true);
    const rough = tasks.find((x) => x.answer === 'Roughly');
    expect(rough?.expl).toContain('gerundete Zahl');
    expect(rough?.expl_en).toContain('rounded figure');
  });

  it('je Thema mindestens 12 eigene Aufgaben, alle vier Aufgabentypen', () => {
    for (const id of C1_IDS) {
      const own = c1Seed().filter((t) => t.topic === id && t.ref === 'content/c1');
      expect(own.length, id).toBeGreaterThanOrEqual(12);
      expect(new Set(own.map((t) => t.type)), id).toEqual(new Set(['mc', 'gap', 'transform', 'correct']));
    }
    // Jede Rohaufgabe übersteht die Normalisierung (kein stilles Wegfallen).
    expect(c1Seed().filter((t) => t.ref === 'content/c1')).toHaveLength(c1Json.tasks.length);
  });

  it('lösbar: Lösung und jede akzeptierte Variante gelten als richtig; Lücken haben ___', () => {
    for (const t of c1Seed()) {
      expect(checkGrammar(t, t.answer).verdict, `${t.topic}: ${t.prompt}`).toBe('correct');
      for (const a of t.accepted) expect(checkGrammar(t, a).verdict, `${t.prompt} → ${a}`).toBe('correct');
      if (t.type === 'mc') expect(t.options, t.prompt).toContain(t.answer);
      if (t.type === 'gap') expect(t.prompt, t.prompt).toMatch(/_{3,}/);
      if (t.type === 'correct') expect(checkGrammar(t, t.prompt).verdict, t.prompt).toBe('wrong');
      if (t.type === 'mc') for (const o of (t.options ?? []).filter((o) => o !== t.answer)) expect(checkGrammar(t, o).verdict, `${t.prompt}: ${o}`).toBe('wrong');
    }
  });

  it('Erklärungen je Aufgabe in beiden Sprachen, jeweils in der richtigen Sprache', () => {
    const bad: string[] = [];
    for (const t of c1Seed()) {
      expect(t.expl.de, t.prompt).toBeTruthy();
      expect(t.expl.en, t.prompt).toBeTruthy();
      if (isWrongLang(t.expl.de ?? '', 'de', 3) || detectLang(t.expl.de ?? '') === 'en') bad.push(`DE ${t.expl.de}`);
      if (isWrongLang(t.expl.en ?? '', 'en', 3) || detectLang(t.expl.en ?? '') === 'de') bad.push(`EN ${t.expl.en}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('C1-Werkzeugkasten läuft überall mit', () => {
  it('Grammatik-Runde je Thema und in der freien Runde (Planlogik unverändert)', () => {
    const round = selectRound({ mode: 'topic', topic: 'c1-hedging', grammarDocs: new Map(), dailyOpen: [], pool: [], lessonTasks: [], nowMs: now, size: 8, seed: 'x' });
    expect(round).toHaveLength(8);
    expect(round.every((t) => t.topic === 'c1-hedging')).toBe(true);
    const ranked = rankTopics({ grammarDocs: new Map(), nowMs: now, seed: 's' }).map((r) => r.topic);
    for (const id of C1_IDS) expect(ranked).toContain(id);
  });

  it('BKT und Fehler-Wiederholung: Antwort legt grammar/c1-* an, der Fehler wird fällig', () => {
    const task = c1Seed().find((t) => t.topic === 'c1-diplomacy' && t.type === 'gap')!;
    const w = grammarWrite(undefined, answer({ t: now, verdict: 'wrong', given: 'wonder' }, task));
    expect(w.kind).toBe('create');
    if (w.kind !== 'create') return;
    expect(w.doc.p as number).toBeLessThan(p0Of('c1-diplomacy'));
    expect(validateDoc('grammar/c1-diplomacy', w.doc).ok).toBe(true);
    const due = dueErrors(new Map([['c1-diplomacy', w.doc]]), now + 2 * 86_400_000);
    expect(due.map((d) => d.topic)).toEqual(['c1-diplomacy']);
    expect(due[0]?.task.answer).toBe(task.answer);
  });

  it('„Neue Aufgaben“ (grammar-items): Prompt mit Regel des C1-Themas, Antwort wird gültige Aufgabe', async () => {
    registerCannedReplies();
    const sample = createFakeSample(() => 'ok', () => ({}), 0);
    const rule = ruleOf('c1-hedging', 'en')!;
    const v: GrammarItemsVars = { topic: 'c1-hedging', nameEn: 'Hedging and softening', ruleEn: rule.core, examples: examplesFor('c1-hedging'), p: 0.5, types: ['gap', 'transform'], seenText: [], errors: [], count: 6 };
    const p = grammarItems.build(v);
    expect(p).toContain('Topic id: c1-hedging');
    expect(p).toContain('It might be worth');
    const out = grammarItems.schema(v).parse(await sample.json<unknown>(p));
    expect(out.items.length).toBeGreaterThanOrEqual(3);
    expect(out.items.every((it) => normalizeTask(it, 'ai')?.topic === 'c1-hedging')).toBe(true);
  });

  it('Einschätzung, Fehlerkategorien, Radar', () => {
    expect(allowedActions({ errorTopics: ['c1-emphasis'], nextLesson: null })).toEqual(expect.arrayContaining(['grammar:c1-hedging', 'errors:c1-emphasis']));
    expect(isKnownAction('grammar:c1-precision')).toBe(true);
    expect(actionTopic('errors:c1-nominal')).toBe('c1-nominal');
    for (const id of C1_IDS) {
      expect(ERROR_CATS).toContain(id);
      expect(topicCat(id)).not.toBe('tense');
    }
  });
});

// ------------------------------------------------------------------ Eine Botschaft, drei Tonlagen

const TEXTS = {
  slack: 'Hey, quick heads-up: the migration will delay for two weeks because the export takes longer.',
  cfo: 'The migration will delay for two weeks. The export from the old system takes longer than we planned, sorry.',
  meeting: 'We hereby inform you that the migration is postponed by two weeks.',
};

describe('Sachverhalte', () => {
  it('etwa 20 Stück, überwiegend Beruf, eindeutige Kennungen, beide Sprachen', () => {
    expect(TONE_MESSAGES.length).toBeGreaterThanOrEqual(18);
    expect(new Set(TONE_MESSAGES.map((m) => m.id)).size).toBe(TONE_MESSAGES.length);
    expect(TONE_MESSAGES.filter((m) => m.kind === 'job').length / TONE_MESSAGES.length).toBeGreaterThan(0.7);
    for (const m of TONE_MESSAGES) {
      expect(isWrongLang(m.de, 'de'), m.de).toBe(false);
      expect(isWrongLang(m.en, 'en'), m.en).toBe(false);
      for (const w of m.en.toLowerCase().match(/[a-z]+/g) ?? []) expect(toUS(w), m.en).toBe(w);
    }
  });

  it('Auswahl je Tag fest, „Anderer Sachverhalt“ geht weiter', () => {
    const a = messageFor(TONE_MESSAGES, '2026-09-27');
    expect(messageFor(TONE_MESSAGES, '2026-09-27')).toBe(a);
    expect(messageFor(TONE_MESSAGES, '2026-09-27', 1)).not.toBe(a);
    expect(messageFor([], '2026-09-27')).toBeNull();
  });
});

describe('tone-check@1', () => {
  const sample = createFakeSample(() => 'ok', () => ({}), 0);
  beforeAll(() => registerCannedReplies());
  const vars = (uiLang: 'de' | 'en', texts = TEXTS): ToneCheckVars => ({ message: 'The archive migration will be delayed by two weeks.', texts, uiLang });

  it('Kopfzeile, default, zwischengespeichert, drei Fassungen im Rahmen, Größe unter der Grenze', () => {
    const p = toneCheck.build(vars('en'));
    expect(p.split('\n')[0]).toBe('[tone-check@1]');
    expect(toneCheck.tier).toBe('default');
    expect(toneCheck.cache).toBe(true);
    expect(p.match(/<<<TEXT/g)).toHaveLength(3);
    expect(p).toContain('Explanation language: English');
    expect(p).toContain('British spelling and British words are ALWAYS correct');
    const huge = 'word '.repeat(5000);
    expect(promptBytes(toneCheck.build(vars('de', { slack: huge, cfo: huge, meeting: huge })))).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('Beispiel und feste Testantwort bestehen das Schema (DE und EN); Korrekturen stehen wörtlich im Text', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      expect(toneCheckSchema(vars(uiLang)).safeParse(JSON.parse(toneCheckExample(uiLang))).success).toBe(true);
      const raw = await sample.json<unknown>(toneCheck.build(vars(uiLang)));
      const r = toneCheckSchema(vars(uiLang)).safeParse(raw);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      expect(r.data.versions.map((v) => v.reg)).toEqual([...TONE_REGISTERS]);
      expect(r.data.versions.map((v) => v.tone)).toEqual(['fits', 'too_direct', 'too_stiff']);
      expect(r.data.corrections.map((c) => c.reg)).toEqual(['slack', 'cfo']);
      for (const c of r.data.corrections) expect(TEXTS[c.reg]).toContain(c.wrong);
    }
  });

  it('tolerant: Versionen als Objekt, Synonyme, fehlende Korrekturen; nicht auffindbare Fehler fallen weg', () => {
    const v = vars('de');
    const r = toneCheckSchema(v).parse({
      versions: {
        Slack: { tone: 'appropriate', why: 'Locker und passend unter Kollegen.', model: 'Heads-up: two more weeks.' },
        email: { tone: 'too formal', why: 'Zu förmlich für diese kurze Nachricht.', model: 'Dear Ms. Keller, the migration will take two more weeks.' },
        spoken: { tone: 'blunt', why: 'Das klingt im Meeting recht schroff.', model: "We're looking at two extra weeks." },
      },
      corrections: [
        { reg: 'cfo', wrong: 'will delay for two weeks', right: 'will be delayed by two weeks', why: 'Verschoben um: be delayed by.' },
        { reg: 'meeting', wrong: 'something I never wrote', right: 'x', why: 'Steht nicht im Text.' },
      ],
      tip: 'Beim CFO zuerst die Wirkung, dann die Lösung.',
    });
    expect(r.versions.map((x) => [x.reg, x.tone])).toEqual([
      ['slack', 'fits'],
      ['cfo', 'too_stiff'],
      ['meeting', 'too_direct'],
    ]);
    expect(r.corrections).toHaveLength(1);
    const noCorr = toneCheckSchema(v).parse({ versions: r.versions, tip: 'Beim CFO zuerst die Wirkung, dann die Lösung.' });
    expect(noCorr.corrections).toEqual([]);
  });

  it('fehlende Tonlage und falsche Sprache werden abgelehnt (einmaliger Neuversuch des KI-Tors)', () => {
    const v = vars('de');
    const two = { versions: [{ reg: 'slack', tone: 'fits', why: 'Passt gut zu Kollegen.', model: 'Heads-up.' }, { reg: 'cfo', tone: 'fits', why: 'Passt gut zum CFO.', model: 'Dear Ms. Keller.' }], corrections: [], tip: 'Beim CFO zuerst die Wirkung.' };
    expect(toneCheckSchema(v).safeParse(two).success).toBe(false);
    const three = { ...two, versions: [...two.versions, { reg: 'meeting', tone: 'fits', why: 'This sounds very natural when you say it in the meeting.', model: 'Quick update.' }] };
    expect(toneCheckSchema(v).safeParse(three).success).toBe(false);
  });

  it('zzjson → keine JSON-Antwort (Fehlerzustand)', async () => {
    await expect(sample.json<unknown>(toneCheck.build(vars('de', { ...TEXTS, slack: 'zzjson test' })))).rejects.toBeTruthy();
  });
});

describe('Tonlagen: Reparatur-Sätze und Monatsdokument', () => {
  it('echte Fehler → ganzer eigener Satz, Quelle tone, je Fassung', () => {
    const r = repairsFromTones(TEXTS, [{ reg: 'cfo', wrong: 'will delay for two weeks', right: 'will be delayed by two weeks', why: 'Verschoben um: be delayed by.' }], 'Migration verschiebt sich');
    expect(r).toEqual([
      {
        wrong: 'The migration will delay for two weeks.',
        right: 'The migration will be delayed by two weeks.',
        why: 'Verschoben um: be delayed by.',
        src: 'tone',
        ctx: 'Migration verschiebt sich',
        fix: ['will be delayed by two weeks'],
      },
    ]);
    expect(repairsFromTones(TEXTS, [{ reg: 'meeting', wrong: 'not there', right: 'x', why: 'y' }], 'c')).toEqual([]);
  });

  const item = (t: number, over: Partial<ToneItem> = {}): ToneItem => ({ id: toneId('migration-delay', t), t, day: '2026-09-27', msg: 'migration-delay', kind: 'job', texts: TEXTS, fb: null, ms: 90_000, lang: 'de', ai: false, ...over });

  it('tones/<Monat>: anlegen, idempotent ersetzen, gültig; unerwarteter Aufbau wird nicht angefasst', () => {
    expect(tonesPath('2026-09-27')).toBe('tones/2026-09');
    const first = upsertToneItem(undefined, item(now));
    expect(first && 'set' in first).toBe(true);
    const doc = (first as { set: Record<string, unknown> }).set;
    expect(validateDoc('tones/2026-09', doc).ok).toBe(true);
    const again = upsertToneItem(doc, item(now, { ai: true }));
    expect((again as { update: { items: unknown[] } }).update.items).toHaveLength(1);
    expect(upsertToneItem({ items: 'kaputt' }, item(now))).toBeNull();
    expect(upsertToneItem({ v: 1, month: '2026-09', items: [{ id: 5 }] }, item(now))).toBeNull();
  });

  it('verdichtet unter 200 KiB: zuerst Rückmeldungen, dann Texte der ältesten', () => {
    const long = 'x'.repeat(800);
    const fb = { versions: TONE_REGISTERS.map((reg) => ({ reg, tone: 'fits' as const, why: 'y'.repeat(200), model: 'z'.repeat(800) })), corrections: [], tip: 't'.repeat(200) };
    const many = Array.from({ length: 200 }, (_, i) => item(now + i, { texts: { slack: long, cfo: long, meeting: long }, fb }));
    const out = compactTones(many, '2026-09');
    expect(out).toHaveLength(200);
    expect(jsonBytes({ v: 1, month: '2026-09', items: out })).toBeLessThanOrEqual(TONES_DOC_MAX_BYTES);
    const last = out[out.length - 1] as ToneItem;
    expect(last.texts.cfo).toBe(long);
  });

  it('Abschluss zählt als Extra (Bonus 15), nie als Pflichtkanal', () => {
    expect(roundBonus({ day: '2026-09-27', act: 'tones', partial: false, n: 1, right: 1, activeMs: 60_000 })).toBe(15);
  });
});
