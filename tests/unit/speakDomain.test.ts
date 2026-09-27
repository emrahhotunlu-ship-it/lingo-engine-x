import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { isDocPath } from '../../src/data/paths';
import { chunkId, chunkPresence, containsPhrase, newChunkDoc, takeChunkOp, type NewChunkInput } from '../../src/domain/chunks/newChunk';
import { buildSituation, checkSituation, letterHint, situationEligible, situationRound, typedForm } from '../../src/domain/chunks/situation';
import { dayKey } from '../../src/domain/date';
import { radarEvents, radarOp, RADAR_MAX } from '../../src/domain/progress/radarPatch';
import { mergeScenes, sceneView } from '../../src/domain/speak/library';
import { reportStats } from '../../src/domain/speak/reportStats';
import { aiSceneId, sceneRunOp } from '../../src/domain/speak/sceneDoc';
import { compactRuns, jsonBytes, monthOf, TALK_DOC_MAX_BYTES, upsertRun } from '../../src/domain/speak/talkDoc';
import { buildRun, runId, talkLines } from '../../src/domain/speak/transcript';
import type { AnalysisSlot, AnalysisView, TalkRun, Turn } from '../../src/domain/speak/types';
import legacyScenes from '../../src/content/legacy/scenes.json';
import { berlin, loadSeed } from './helpers';

// Domäne Sprechen (Plan §3, §9.1): neue Wendung, M15, Gesprächsdokument, Radar, Szenen.

type Doc = Record<string, unknown>;
const legacy = legacyScenes as unknown as Doc[];

const input = (over: Partial<NewChunkInput> = {}): NewChunkInput => ({
  en: 'push back the go-live',
  de: 'den Go-live verschieben',
  def: 'to move the launch to a later date',
  kind: 'collocation',
  register: 'neutral',
  why: 'Klingt nach Planung.',
  whyLang: 'de',
  level: 'C1',
  src: { kind: 'scene', scene: 'sc-vida', sceneTitle: 'Holding the Q2 e-invoicing deadline', utterance: 'We must delay the start.', upgraded: 'If we push back the go-live, the exposure is yours, not ours.', turn: 3 },
  nowMs: 1_790_488_800_000,
  ...over,
});

describe('neue Wendung (chunk/c-<slug>)', () => {
  it('Kennung gültig nach der Pfadgrammatik', () => {
    expect(chunkId('push back the go-live')).toBe('c-push-back-the-go-live');
    expect(chunkId('I take your point, but …')).toBe('c-i-take-your-point-but');
    expect(isDocPath(`chunk/${chunkId('x'.repeat(200)) as string}`)).toBe(true);
    expect(chunkId('…')).toBeNull();
  });

  it('en ⊄ upgraded → null; zu lang oder ohne de/def → null', () => {
    expect(newChunkDoc(input({ en: 'sign off on' }))).toBeNull();
    expect(newChunkDoc(input({ en: 'one two three four five six seven eight nine', src: { ...input().src, upgraded: 'one two three four five six seven eight nine' } }))).toBeNull();
    expect(newChunkDoc(input({ de: ' ' }))).toBeNull();
    expect(newChunkDoc(input({ def: '' }))).toBeNull();
    expect(containsPhrase('I take your point, but the risk is real.', 'I take your point, but …')).toBe(true);
  });

  it('Dokument im alten Format plus Ergänzungen, besteht das Schema', () => {
    const made = newChunkDoc(input());
    expect(made).not.toBeNull();
    const doc = made!.doc;
    expect(validateDoc(`chunk/${made!.id}`, doc).ok).toBe(true);
    expect(doc).toMatchObject({ id: 'c-push-back-the-go-live', en: 'push back the go-live', kind: 'collocation', state: 'new', S: 0, D: 5, due: 0, stage: 0, also: [], whyLang: 'de' });
    expect(doc.src).toMatchObject({ kind: 'scene', scene: 'sc-vida', utterance: 'We must delay the start.', turn: 3, ts: 1_790_488_800_000 });
    expect(doc.origin).toMatchObject({ v: 1, kind: 'scene', ref: 'scene/sc-vida' });
    const biz = newChunkDoc(input({ src: { kind: 'biz', ref: 'playbook/agree#a-price', title: 'Agreeing', utterance: '', upgraded: 'We push back the go-live in return for a discount.' } }));
    expect(biz!.doc.origin).toMatchObject({ kind: 'biz', ref: 'playbook/agree#a-price' });
    expect((biz!.doc.src as Doc).scene).toBeUndefined();
  });

  it('vorhanden → nie schreiben (auch nicht bei hidden)', () => {
    const made = newChunkDoc(input())!;
    expect(takeChunkOp(undefined, made)).toEqual({ set: made.doc });
    expect(takeChunkOp({ en: 'x' }, made)).toBeNull();
    expect(takeChunkOp({ en: 'x', hidden: true }, made)).toBeNull();
    expect(chunkPresence({ hidden: true })).toBe('hidden');
    expect(chunkPresence({ en: 'x' })).toBe('present');
    expect(chunkPresence(undefined)).toBe('absent');
  });
});

describe('M15 – Wendungen aus der Situation', () => {
  const scene = sceneView('sc-vida', legacy[0] as Doc, 'legacy', 'de');
  const doc: Doc = { en: 'I take your point, but …', de: 'Ich verstehe Ihren Einwand, aber …', def: 'polite way to disagree', stage: 4, src: { scene: 'sc-vida', sceneTitle: 'Holding', utterance: 'I understand you, but the risk is high.', upgraded: 'I take your point, but the penalty risk is real.' } };

  it('geeignet nur mit Szene, Stufe ≥ 4, nicht ausgeblendet', () => {
    expect(situationEligible(doc)).toBe(true);
    expect(situationEligible({ ...doc, stage: 2 })).toBe(false);
    expect(situationEligible({ ...doc, stage: 2 }, 0)).toBe(true);
    expect(situationEligible({ ...doc, hidden: true })).toBe(false);
    expect(situationEligible({ ...doc, src: 'lesson' })).toBe(false);
  });

  it('Aufgabe: Szene und Absicht in Oberflächensprache, danach „Damals hattest du gesagt“', () => {
    const ex = buildSituation('c-x', doc, scene, 'de')!;
    expect(ex.intent).toBe('Ich verstehe Ihren Einwand, aber …');
    expect(ex.situation).toContain('Industriekunde');
    expect(ex.then).toBe('I understand you, but the risk is high.');
    expect(ex.accepted).toContain('I take your point, but');
    expect(buildSituation('c-x', doc, scene, 'en')!.intent).toBe('polite way to disagree');
    expect(buildSituation('c-x', doc, null, 'de')!.sceneTitle).toBe('Holding');
  });

  it('Prüfung: genau, britisch, Tippfehler, ganzer Satz mit der Wendung', () => {
    const ex = buildSituation('c-x', doc, scene, 'de')!;
    expect(checkSituation('I take your point, but', ex).verdict).toBe('correct');
    expect(checkSituation('i take your point but', ex).verdict).toBe('correct');
    expect(checkSituation('I take your piont, but', ex).verdict).toBe('near');
    expect(checkSituation('Well, I take your point, but the numbers say otherwise.', ex).verdict).toBe('correct');
    expect(checkSituation('I see what you mean', ex).verdict).toBe('wrong');
    const uk = buildSituation('c-y', { ...doc, en: 'prioritize the rollout' }, scene, 'de')!;
    expect(checkSituation('prioritise the rollout', uk)).toMatchObject({ verdict: 'correct', variant: 'uk' });
  });

  it('Tipp: Platzhalter, dann Anfangsbuchstaben; Reihenfolge nach Fälligkeit', () => {
    expect(typedForm('I take your point, but …')).toBe('I take your point, but');
    expect(letterHint('push back the go-live', false)).toBe('____ ____ ___ __-____');
    expect(letterHint('push back the go-live', true)).toBe('p___ b___ t__ g_-l___');
    const a = buildSituation('a', { ...doc, due: 5 }, scene, 'de')!;
    const b = buildSituation('b', { ...doc, due: 1 }, scene, 'de')!;
    expect(situationRound([a, b]).map((x) => x.chunkId)).toEqual(['b', 'a']);
  });
});

const view = (verdict: AnalysisView['verdict'], cats: string[] = []): AnalysisView => ({
  verdict,
  english: true,
  errors: cats.map((c) => ({ wrong: 'x', right: 'y', cat: c, why: 'z' })),
  upgraded: 'Upgraded sentence.',
  changes: [],
  lands: 'Weil.',
  chunks: [],
  targets: verdict === 'clean' ? ['exposure'] : [],
});

describe('Gesprächslauf und talk/<Monat>', () => {
  const turns: Turn[] = [
    { role: 'persona', text: 'Convince me.', t: 0 },
    { role: 'me', text: 'The exposure is real.', t: 1 },
    { role: 'persona', text: 'Why?', t: 2 },
    { role: 'me', text: 'We must delay.', t: 3, usedChip: true },
    { role: 'persona', text: 'Fine.', t: 4 },
    { role: 'me', text: 'Ok.', t: 5 },
  ];
  const analyses: Record<number, AnalysisSlot> = { 1: { state: 'done', data: view('clean') }, 3: { state: 'done', data: view('errors', ['modals-deduction', 'register']) }, 5: { state: 'skipped' } };
  const scene = sceneView('sc-vida', legacy[0] as Doc, 'legacy', 'de');

  it('fester Berichtsteil: Tatsachen ohne Punktestand', () => {
    const s = reportStats(turns, analyses, ['a', 'a'], 0, 125_000);
    expect(s).toMatchObject({ turns: 3, analysed: 2, clean: 1, minutes: 2, chipTurns: 1, targets: ['exposure'], taken: ['a'] });
    expect(s.errs).toEqual({ 'modals-deduction': 1, register: 1 });
  });

  it('Lauf mit verdichteten Zeilen', () => {
    const run = buildRun({ id: runId(1000), startedAt: 1000, endedAt: 61_000, day: '2026-09-20', scene, turns, analyses, taken: ['sign off on'], lang: 'de', tier: 'quick' });
    expect(run).toMatchObject({ id: 'rrs', turns: 3, clean: 1, scene: 'sc-vida', src: 'legacy', report: null, v: 1 });
    expect(talkLines(turns, analyses)[1]).toEqual({ u: 'We must delay.', up: 'Upgraded sentence.', v: 'errors', c: ['modals-deduction', 'register'] });
    expect(talkLines(turns, analyses)[2]!.v).toBe('na');
  });

  const run = (i: number, fat = false): TalkRun => ({
    id: `r${i}`,
    t: 1_790_000_000_000 + i,
    day: '2026-09-20',
    scene: 'sc-vida',
    title: 'Holding',
    src: 'legacy',
    turns: 6,
    ms: 1000,
    end: 'user',
    goal: null,
    clean: 3,
    errs: { register: 1 },
    taken: [],
    lines: Array.from({ length: 16 }, () => ({ u: fat ? 'u'.repeat(200) : 'u', up: fat ? 'p'.repeat(200) : 'p', v: 'minor' as const, c: ['register'] })),
    report: fat
      ? { lang: 'de', t: 1, goal: { state: 'partly', why: 'w'.repeat(240) }, summary: 's'.repeat(500), strengths: [{ quote: 'q'.repeat(300), why: 'w'.repeat(200) }, { quote: 'q'.repeat(300), why: 'w'.repeat(200) }], focus: [{ title: 't', said: 's'.repeat(300), better: 'b'.repeat(300), why: 'w'.repeat(200), cat: 'register' }], phrases: [] }
      : null,
    lang: 'de',
    tier: 'quick',
    v: 1,
  });

  it('upsertRun: fehlt → set, idempotent über id (zweimal ⇒ ein Lauf)', () => {
    const first = upsertRun(undefined, run(1)) as { set: Doc };
    expect(first.set).toMatchObject({ v: 1, month: '2026-09' });
    expect(validateDoc('talk/2026-09', first.set).ok).toBe(true);
    const again = upsertRun(first.set, run(1)) as { update: { runs: unknown[] } };
    expect(again.update.runs).toHaveLength(1);
    const two = upsertRun(first.set, run(2)) as { update: { runs: unknown[] } };
    expect(two.update.runs).toHaveLength(2);
  });

  it('100 Läufe im schlimmsten Fall bleiben ≤ 200 KiB; zuerst die Zeilen des ältesten', () => {
    const runs = Array.from({ length: 100 }, (_, i) => run(i, true));
    const out = compactRuns(runs, '2026-09') as Array<Doc>;
    expect(jsonBytes({ v: 1, month: '2026-09', runs: out })).toBeLessThanOrEqual(TALK_DOC_MAX_BYTES);
    expect(out).toHaveLength(100);
    expect(out.every((r) => r.turns === 6 && r.clean === 3)).toBe(true);
    // Etwas über der Grenze: nur die ältesten verlieren ihre Zeilen, die neuesten bleiben vollständig.
    const some = compactRuns(Array.from({ length: 30 }, (_, i) => run(i, true)), '2026-09') as Array<Doc>;
    expect(jsonBytes({ v: 1, month: '2026-09', runs: some })).toBeLessThanOrEqual(TALK_DOC_MAX_BYTES);
    expect(some[0]!.lines).toEqual([]);
    expect((some[29]!.lines as unknown[]).length).toBe(16);
    expect((some[29]!.report as Doc).focus).toBeDefined();
  });

  it('Monatsschlüssel am Lerntag: 03:59 zählt zum Vortag, Monatswechsel', () => {
    expect(monthOf(dayKey(berlin('2026-10-01', 3, 59)))).toBe('2026-09');
    expect(monthOf(dayKey(berlin('2026-10-01', 4, 1)))).toBe('2026-10');
  });
});

describe('Fehler-Radar', () => {
  it('nur Grammatikthemen, Kategorie der alten App, Quelle k/b, Format der alten App', () => {
    const ev = radarEvents(
      [
        { cat: 'conditionals', wrong: 'If we would start', right: 'If we started', sentence: 'If we would start later, fine.' },
        { cat: 'register', wrong: 'x', right: 'y', sentence: 's' },
      ],
      'k',
      100,
    );
    expect(ev).toEqual([{ c: 'cond', s: 'k', t: 100, q: 'If we would start later, fine.', g: 'If we would start', a: 'If we started' }]);
    expect(radarEvents([{ cat: 'passive', wrong: 'a', right: 'b', sentence: 'c' }], 'b', 1)[0]!.s).toBe('b');
  });

  it('fehlendes Dokument → set; Kappung 400; doppelte nicht erneut', () => {
    const ev = radarEvents([{ cat: 'passive', wrong: 'a', right: 'b', sentence: 'c' }], 'k', 5);
    expect(radarOp(undefined, ev)).toEqual({ set: { events: ev } });
    const full = { events: Array.from({ length: 400 }, (_, i) => ({ c: 'articles', s: 'g', t: i, q: '', g: '', a: '' })) };
    const r = radarOp(full, ev) as { update: { events: Doc[] } };
    expect(r.update.events).toHaveLength(RADAR_MAX);
    expect(r.update.events[399]).toEqual(ev[0]);
    expect(radarOp({ events: ev }, ev)).toBeNull();
    expect(radarOp({ events: 'kaputt' }, ev)).toBeNull();
  });
});

describe('Szenen-Bibliothek', () => {
  it('Datenbank gewinnt; ungültige fehlen; ohne Eröffnung oder Gegenüber nicht startbar; Sprache mit Rückfall', () => {
    const db = new Map<string, Doc>([
      ['sc-vida', { ...(legacy[0] as Doc), title: 'Changed title', done: true, ts: 5 }],
      ['sc-ai1', { id: 'sc-ai1', src: 'ai', title: 'AI scene', persona: { name: 'X Y', role: 'CFO' }, opening: 'Hello there.', goal: 'Goal en' }],
      ['sc-broken', { id: 'sc-broken', title: 'No persona' }],
      ['sc-bad', { id: 'sc-bad', title: 'Invalid' }],
    ]);
    const list = mergeScenes(legacy, db, new Set(['sc-bad']), 'de');
    expect(list.find((s) => s.id === 'sc-bad')).toBeUndefined();
    const vida = list.find((s) => s.id === 'sc-vida')!;
    expect(vida.titleEn).toBe('Changed title');
    expect(vida.title).toBe((legacy[0] as Doc).title_de);
    expect(vida.src).toBe('legacy');
    expect(vida.runs).toBe(1);
    expect(list.find((s) => s.id === 'sc-ai1')!).toMatchObject({ src: 'ai', valid: true, goal: 'Goal en' });
    expect(list.find((s) => s.id === 'sc-broken')!.valid).toBe(false);
    // nie gespielt zuerst
    expect(list[list.length - 1]!.id).toBe('sc-vida');
  });

  it('Lauf-Vermerk: done nur bei fehlend/false, vorhandener Wert bleibt; Szene nur aus Inhalt → vollständig anlegen', () => {
    expect(sceneRunOp({ done: 3, runs: 2 }, null, 10)).toEqual({ update: { runs: 3, lastRun: 10 } });
    expect(sceneRunOp({ done: false }, null, 10)).toEqual({ update: { runs: 1, lastRun: 10, done: true } });
    expect(sceneRunOp({}, null, 10)).toEqual({ update: { runs: 1, lastRun: 10, done: true } });
    const created = sceneRunOp(undefined, legacy[1] as Doc, 10) as { set: Doc };
    expect(created.set).toMatchObject({ id: (legacy[1] as Doc).id, runs: 1, done: true, lastRun: 10 });
    expect(validateDoc(`scene/${String(created.set.id)}`, created.set).ok).toBe(true);
    expect(sceneRunOp(undefined, null, 10)).toBeNull();
    expect(isDocPath(`scene/${aiSceneId(1_790_000_000_000)}`)).toBe(true);
  });

  it('Testdaten: Szenen der alten App, KI-Szene, unvollständige Szene – alle gültig gelesen', () => {
    const seed = loadSeed();
    const db = new Map(Object.entries(seed).filter(([p]) => p.startsWith('scene/')).map(([p, d]) => [p.slice(6), d]));
    const list = mergeScenes(legacy, db, new Set(), 'en');
    expect(list.filter((s) => s.valid)).toHaveLength(5);
    expect(list.filter((s) => s.src === 'ai')).toHaveLength(1);
    expect(list.find((s) => s.id === 'sc-broken')!.valid).toBe(false);
  });
});
