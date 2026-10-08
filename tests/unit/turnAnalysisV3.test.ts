import { describe, expect, it } from 'vitest';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { TEMPLATES } from '../../src/prompts/registry';
import { turnAnalysisV3, turnAnalysisV3Schema, TA3_PATS_MAX, TA3_USED_MAX, type TurnAnalysisV3Vars } from '../../src/prompts/turnAnalysisV3';
import { talkPatIds, turnAnalysisV3Reply } from '../../src/platform/dev/canned/lp3/p51';
import { chapterTalk, goalProgress, talkProd, talkProdId, turnErrors, TALK_PATS_MAX } from '../../src/domain/speak/chapterTalk';
import { repairsFromText } from '../../src/domain/repair/sources';
import type { AnalysisSlot, AnalysisView, Turn } from '../../src/domain/speak/types';
import { markSpans } from '../../src/features/speak/RetrySay';

// turn-analysis@3 (Lernplattform 3.0 P51, KT T7): Prompt (Kopfzeile, Größe bei Höchstwerten), Schema (`pat` nur aus der Liste, `used`, `count`,
// Verstoß → der eine Neuversuch), feste Testantwort, Kapitelziel, K7-Eintrag `s: 'talk'`, „Sag’s nochmal“-Markierung.

const PATS = [
  { id: 'mod.must-have', en: 'must vs. have to' },
  { id: 'prp.no-prep', en: 'verbs without a preposition' },
  { id: 'cnd.second', en: 'second conditional' },
];
const vars = (sentence: string, over: Partial<TurnAnalysisV3Vars> = {}): TurnAnalysisV3Vars => ({
  goal: 'Keep Q2.',
  role: 'Reinhard Vogt, CFO',
  personaLine: 'Convince me otherwise.',
  history: [],
  sentence,
  focusWords: ['exposure'],
  uiLang: 'de',
  pats: PATS,
  ...over,
});
const parse = (v: TurnAnalysisV3Vars) => turnAnalysisV3Schema(v).safeParse(JSON.parse(turnAnalysisV3Reply(turnAnalysisV3.build(v))));

describe('Vorlage turn-analysis@3', () => {
  it('Kopfzeile, complex, zwischengespeichert, Version 3 in der Registry, Musterliste im Prompt', () => {
    const p = turnAnalysisV3.build(vars('We must delay the start.'));
    expect(p.split('\n')[0]).toBe('[turn-analysis@3]');
    expect(turnAnalysisV3.tier).toBe('complex');
    expect(turnAnalysisV3.cache).toBe(true);
    expect(TEMPLATES.filter((t) => t.id === 'turn-analysis')).toHaveLength(1);
    expect(TEMPLATES.find((t) => t.id === 'turn-analysis')?.version).toBe(3);
    expect(p).toContain('mod.must-have: must vs. have to');
    expect(p).toContain('never judge pronunciation');
    expect(talkPatIds(p)).toEqual(PATS.map((x) => x.id));
    expect(turnAnalysisV3.build(vars('Fine.', { pats: [] }))).toContain('(id: name):\n(none)');
  });

  it('Höchstwerte (Satz, Verlauf, Figur, 30 lange Muster, Fokuswörter, Beobachtungen): unter 8 KB', () => {
    // Kennungen bis 32 Zeichen (die längste echte hat 21), Namen beliebig lang; eine überlange Kennung kommt gar nicht in die Liste.
    const pats = [{ id: `abcdef.${'q'.repeat(40)}`, en: 'too long' }, ...Array.from({ length: 45 }, (_, i) => ({ id: `abcdef.${'p'.repeat(22)}${String(i).padStart(3, '0')}`, en: 'n'.repeat(400) }))];
    const big = turnAnalysisV3.build({
      ...vars('x '.repeat(5000)),
      goal: 'g'.repeat(2000),
      role: 'r'.repeat(2000),
      history: Array.from({ length: 10 }, () => ({ persona: 'p '.repeat(3000), me: 'm '.repeat(3000) })),
      personaLine: 'l '.repeat(3000),
      focusWords: Array.from({ length: 30 }, () => 'w'.repeat(200)),
      watch: Array.from({ length: 20 }, () => 'v'.repeat(300)),
      pats,
    });
    expect(promptBytes(big)).toBeLessThan(8 * 1024);
    expect(PROMPT_MAX_BYTES).toBeLessThanOrEqual(64 * 1024);
    expect(talkPatIds(big)).toHaveLength(TA3_PATS_MAX);
    expect(big).not.toContain('q'.repeat(40));
  });

  it('feste Antworten bestehen das Schema; `pat` aus der Liste, `used` bei sauberem Satz, `count` = Fehler', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const bad = parse(vars('We must delay the start.', { uiLang }));
      expect(bad.success, JSON.stringify(bad.error?.issues)).toBe(true);
      if (!bad.success) continue;
      expect(bad.data.errors.length).toBeGreaterThan(0);
      expect(bad.data.errors.every((e) => e.pat === 'mod.must-have')).toBe(true);
      expect(bad.data.count).toBe(bad.data.errors.length);
      const clean = parse(vars('That depends on your test team and the exposure.', { uiLang }));
      expect(clean.success && clean.data.used).toEqual(['mod.must-have']);
    }
  });

  it('`pat` außerhalb der Liste und fremde `used` fallen still weg (kein Schemaverstoß)', () => {
    const r = parse(vars('We must delay zzpat the start.'));
    expect(r.success).toBe(true);
    expect(r.success && r.data.errors.every((e) => e.pat === undefined)).toBe(true);
    const u = parse(vars('That depends zzused on the exposure.'));
    expect(u.success && u.data.used).toEqual(['mod.must-have']);
    const schema = turnAnalysisV3Schema(vars('Fine.'));
    const many = schema.safeParse({ verdict: 'clean', english: true, errors: [], upgraded: 'Fine.', changes: [], lands: 'Kurz und klar für ihn.', chunks: [], targets: [], used: ['mod.must-have', 'mod.must-have', 'prp.no-prep', 'cnd.second', 'x.y', 7], count: '0' });
    expect(many.success && many.data.used).toEqual(['mod.must-have', 'prp.no-prep', 'cnd.second']);
    expect(many.success && many.data.used!.length).toBeLessThanOrEqual(TA3_USED_MAX);
    expect(many.success && many.data.count).toBe(0);
    const noCount = schema.safeParse({ verdict: 'clean', english: true, errors: [], upgraded: 'Fine.', changes: [], lands: 'Kurz und klar für ihn.', chunks: [], targets: [], count: 'viele' });
    expect(noCount.success && noCount.data.count).toBe(null);
  });

  it('Schemaverstoß der drei Schichten → Fehler (der eine Neuversuch nach A6.3); kein JSON bleibt kein JSON', () => {
    const v = vars('zzqx we test');
    expect(turnAnalysisV3Schema(v).safeParse(JSON.parse(turnAnalysisV3Reply(turnAnalysisV3.build(v)))).success).toBe(false);
    expect(turnAnalysisV3Schema(v).safeParse({ verdict: 'great' }).success).toBe(false);
    expect(() => void JSON.parse(turnAnalysisV3Reply(turnAnalysisV3.build(vars('zzjson'))))).toThrow();
  });
});

describe('Kapitelziel und K7-Eintrag (chapterTalk)', () => {
  it('aktuelles Kapitel: Muster (≤ 30) und ein festes Ziel 2 × A, 1 × B je Szene', () => {
    const a = chapterTalk({ docs: new Map(), today: '2026-10-08', sceneId: 'cfo-q2' });
    expect(a).not.toBeNull();
    if (!a) return;
    expect(a.pats.length).toBeGreaterThan(0);
    expect(a.pats.length).toBeLessThanOrEqual(TALK_PATS_MAX);
    expect(a.goal.map((g) => g.need)).toEqual(a.pats.length > 1 ? [2, 1] : [2]);
    expect(a.goal.every((g) => a.pats.some((p) => p.id === g.id))).toBe(true);
    expect(chapterTalk({ docs: new Map(), today: '2026-10-08', sceneId: 'cfo-q2' })).toEqual(a);
  });

  const done = (data: Partial<AnalysisView>): AnalysisSlot => ({ state: 'done', lang: 'de', data: { verdict: 'clean', english: true, errors: [], upgraded: '', changes: [], lands: '', chunks: [], targets: [], ...data } });

  it('Stand des Ziels aus `used`, gekappt auf die Sollzahl', () => {
    const goal = [
      { id: 'a.x', need: 2 },
      { id: 'b.y', need: 1 },
    ];
    const p = goalProgress(goal, { 1: done({ used: ['a.x', 'b.y'] }), 3: done({ used: ['a.x', 'a.x'] }), 5: done({ used: ['a.x'] }), 7: { state: 'pending' } });
    expect(p).toEqual([
      { id: 'a.x', need: 2, have: 2 },
      { id: 'b.y', need: 1, have: 1 },
    ]);
  });

  it('turnErrors: Stil zählt nie, Mittelwert mit der zweiten Zählung (höchstens Liste + 2)', () => {
    expect(turnErrors([{ cat: 'vocab' }, { cat: 'register' }], null)).toBe(1);
    expect(turnErrors([{ cat: 'vocab' }], 0)).toBe(1);
    expect(turnErrors([{ cat: 'vocab' }], 3)).toBe(2);
    expect(turnErrors([], 9)).toBe(2);
  });

  const turns: Turn[] = [
    { role: 'persona', text: 'Convince me.', t: 0 },
    { role: 'me', text: 'We must delay the start.', t: 1 },
    { role: 'persona', text: 'Why?', t: 2 },
    { role: 'me', text: 'Because the exposure is real.', t: 3 },
    { role: 'persona', text: 'Hm.', t: 4 },
    { role: 'me', text: 'Push back the go-live.', t: 5, usedChip: true },
  ];
  const analyses = { 1: done({ verdict: 'errors', errors: [{ wrong: 'must delay', right: 'have to push back', cat: 'vocab', why: 'x' }], count: 1 }), 3: done({}), 5: done({}) };

  it('talkProd: Wörter und Fehler der eigenen Züge (ohne eingefügte Wendung), mit Kennung', () => {
    const p = talkProd({ turns, analyses, day: '2026-10-08', runId: 'r1' });
    expect(p).toEqual({ d: '2026-10-08', s: 'talk', w: 10, e: 1, pasted: false, id: talkProdId('r1') });
  });

  it('talkProd: ein eingefügter Zug macht den Eintrag ungültig; ohne zählenden Zug kein Eintrag', () => {
    const pasted = turns.map((t, i) => (i === 3 ? { ...t, pasted: true } : t));
    expect(talkProd({ turns: pasted, analyses, day: '2026-10-08', runId: 'r1' })?.pasted).toBe(true);
    expect(talkProd({ turns, analyses, day: '2026-10-08', runId: 'r1', pastedTexts: new Set(['We must delay the start.']) })?.pasted).toBe(true);
    expect(talkProd({ turns, analyses: {}, day: '2026-10-08', runId: 'r1' })).toBeNull();
  });
});

describe('Fehlersätze tragen `pat` und „Sag’s nochmal“ markiert ohne Lösung', () => {
  it('repairsFromText übernimmt ein gemeinsames `pat`', () => {
    const r = repairsFromText('We must delay the start.', [{ wrong: 'must delay', right: 'have to push back', cat: 'vocab', why: 'x', pat: 'mod.must-have' }], 'talk');
    expect(r[0]?.pat).toBe('mod.must-have');
  });

  it('markSpans markiert die falschen Stellen, ohne die richtige Form', () => {
    const parts = markSpans('We must delay the start.', ['MUST DELAY', 'nicht da']);
    expect(parts).toEqual([
      { text: 'We ', off: false },
      { text: 'must delay', off: true },
      { text: ' the start.', off: false },
    ]);
    expect(markSpans('Fine.', [])).toEqual([{ text: 'Fine.', off: false }]);
  });
});
