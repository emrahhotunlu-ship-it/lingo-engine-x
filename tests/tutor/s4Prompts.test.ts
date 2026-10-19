/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- contract/sample.d.ts: `sample` lehnt mit schlichten Objekten ab. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { askJson, resetAiGate } from '../../src/ai/gate';
import { resetAiBudget } from '../../src/ai/budget';
import { AiFailure } from '../../src/ai/types';
import { acceptGrammarItem } from '../../src/domain/tutor/acceptGrammarItem';
import { acceptBankItem } from '../../src/domain/tutor/sentenceBank';
import { patListText } from '../../src/domain/tutor/patList';
import { diagnoseReplyS4, solveCheckReply, wordBankReply } from '../../src/platform/dev/canned/s4';
import { grammarItemsReplyV3 } from '../../src/platform/dev/canned/lp2/p5';
import { initCapabilities, markSampleConfirmed, useCapabilities } from '../../src/platform/capabilities';
import type { SampleFn } from '../../src/platform/types';
import { PROMPT_MAX_BYTES } from '../../src/prompts/common';
import { DIAGNOSE2_EXAMPLE, diagnoseV2, diagnoseV2Schema, type DiagnoseV2Vars } from '../../src/prompts/diagnoseV2';
import { grammarItems, type GrammarItemsVars } from '../../src/prompts/grammarItems';
import { TEMPLATES } from '../../src/prompts/registry';
import { SOLVE_CHECK_EXAMPLE, solveCheck, taskLine, TASK_MAX_BYTES, type SolveCheckTask } from '../../src/prompts/solveCheck';
import { WORD_BANK_EXAMPLE, wordBank, type WordBankVars } from '../../src/prompts/wordBank';

// Tutor-Engine v3, Scheibe S4: diagnose@2 (complex, Annahmen), solve-check@1 (zweiter Löser für E5), word-bank@1 (Satzbank E6).
// Schemas, Prompts, Test-Antworten und der Fehlerweg nach A6.3 (genau ein Neuversuch nur bei Schemafehler, nie bei kaputtem JSON).

const bytes = (s: string): number => new TextEncoder().encode(s).length;

const HYP = 'h:psp.finished-time>psp.result-now';
const dVars: DiagnoseV2Vars = {
  lang: 'de',
  today: '2026-11-02',
  stats: [{ pat: 'psp.finished-time', n: 9, w: 5, prevN: 4, prevW: 3, weeks: [1, 1, 2, 1] }],
  evidence: `[cf:psp.finished-time>psp.result-now] have done where did was needed: 4× on 3 days\n[p:psp.finished-time] finished time: 9 attempts, 5 wrong`,
  ids: ['cf:psp.finished-time>psp.result-now', 'p:psp.finished-time'],
  hyps: [{ id: HYP, from: 'psp.finished-time', to: 'psp.result-now', state: 'open', n: 4, days: 3, l1: 'l1:perfekt' }],
  l1: [{ id: 'l1:perfekt', trigger: 'Deutsches Perfekt für Abgeschlossenes' }],
  patList: patListText(),
};

describe('diagnose@2: Prompt', () => {
  it('Kopfzeile, complex, kein Zwischenspeicher, Budget 1, eigenes Lesen; Annahmen und Regel „gutes Englisch“', () => {
    const p = diagnoseV2.build(dVars);
    expect(p.split('\n')[0]).toBe('[diagnose@2]');
    expect(diagnoseV2.tier).toBe('complex');
    expect(diagnoseV2.cache).toBe(false);
    expect(diagnoseV2.budget).toEqual({ bgPerDay: 1 });
    expect(diagnoseV2.verb).toBe('text-json');
    expect(p).toContain(`${HYP} | used psp.result-now where psp.finished-time was right | state=open | 4 cases on 3 days | l1:perfekt`);
    expect(p).toContain('Good English is never an error');
    expect(p).toContain('In American English the simple past with just, already and yet is correct; accept it: such a case is not evidence for an error.');
    expect(p).toContain('l1:perfekt: Deutsches Perfekt');
  });

  it('Höchstwerte bleiben unter der Grenze (Statistik 2 KB, Annahmen 1 KB, Belege 4,9 KB)', () => {
    const stats = Array.from({ length: 80 }, (_, i) => ({ pat: `psp.x${i}`, n: 20, w: 10, prevN: 5, prevW: 2, weeks: [1, 2, 3, 4] as [number, number, number, number] }));
    const hyps = Array.from({ length: 40 }, (_, i) => ({ ...dVars.hyps[0]!, id: `h:psp.a${i}>psp.b${i}` }));
    const p = diagnoseV2.build({ ...dVars, stats, hyps, evidence: `[p:x] ${'a'.repeat(4890)}` });
    expect(bytes(p)).toBeLessThan(14_000);
    expect(bytes(p)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('einmal registriert unter `diagnose` (Version 2)', () => {
    expect(TEMPLATES.filter((t) => t.id === 'diagnose')).toEqual([diagnoseV2]);
  });
});

describe('diagnose@2: Schema', () => {
  const parse = (o: unknown) => diagnoseV2Schema(dVars).safeParse(o);
  const good = JSON.parse(DIAGNOSE2_EXAMPLE) as Record<string, unknown>;

  it('das Beispiel im Prompt besteht', () => {
    const r = parse(good);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(r.data?.hyps[0]).toMatchObject({ id: HYP, verdict: 'likely', ev: ['cf:psp.finished-time>psp.result-now'] });
    expect(r.data?.focus).toEqual(['psp.finished-time']);
  });

  it('erfundene Annahmen, Belege und Muster fallen still weg; Urteil unbekannt → unclear; Präfix pattern: wird entfernt', () => {
    const h = (good.hyps as Array<Record<string, unknown>>)[0]!;
    const r = parse({
      ...good,
      hyps: [{ ...h, verdict: 'maybe', ev: ['p:erfunden', '[p:psp.finished-time]'] }, { ...h }, { ...h, id: 'h:erfunden>x' }],
      focus: ['pattern:psp.finished-time', 'zz.erfunden', 'psp.finished-time'],
    });
    expect(r.success).toBe(true);
    expect(r.data?.hyps).toHaveLength(1);
    expect(r.data?.hyps[0]?.verdict).toBe('unclear');
    expect(r.data?.hyps[0]?.ev).toEqual(['p:psp.finished-time']);
    expect(r.data?.focus).toEqual(['psp.finished-time']);
  });

  it('fehlende oder englische Zusammenfassung ist ein Schemafehler (Grundlage des einen Neuversuchs)', () => {
    expect(parse({ ...good, summary: undefined }).success).toBe(false);
    expect(parse({ ...good, summary: { de: 'This week the tense after finished time is the main topic.', en: 'This week the tense after finished time is the main topic.' } }).success).toBe(false);
  });

  it('Annahme ohne gültige Begründung fällt einzeln weg; leere Listen sind erlaubt', () => {
    const h = (good.hyps as Array<Record<string, unknown>>)[0]!;
    expect(parse({ ...good, hyps: [{ ...h, why: { de: '', en: '' } }] }).data?.hyps).toEqual([]);
    expect(parse({ summary: good.summary }).data).toEqual({ hyps: [], focus: [], summary: good.summary });
  });

  it('Test-Antwort: zitiert nur Kennungen aus dem Prompt; @1-Prompts gehen an die alte Antwort', () => {
    const r = parse(JSON.parse(diagnoseReplyS4(diagnoseV2.build(dVars))));
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(r.data?.hyps.map((x) => x.id)).toEqual([HYP]);
    expect(r.data?.focus).toEqual(['psp.finished-time']);
    expect(JSON.parse(diagnoseReplyS4('[diagnose@1]\nAllowed actions: pattern:art.definite\n'))).toHaveProperty('headline');
  });
});

describe('diagnose@2: durch das KI-Tor (A6.3, Budget)', () => {
  class MemStorage {
    private m = new Map<string, string>();
    getItem(k: string): string | null {
      return this.m.get(k) ?? null;
    }
    setItem(k: string, v: string): void {
      this.m.set(k, v);
    }
    removeItem(k: string): void {
      this.m.delete(k);
    }
  }
  const prompts: string[] = [];
  const sample = Object.assign(
    ((input: string) => {
      prompts.push(input);
      return Promise.resolve({ text: diagnoseReplyS4(input), truncated: false } as Claude.sample.SampleResult);
    }) as unknown as SampleFn,
    { json: () => Promise.reject({ code: 'invalid_request' }), limits: () => Promise.resolve({ maxPromptBytes: 65536 }) },
  );
  const stub = (): void => {
    vi.stubGlobal('window', { localStorage: new MemStorage(), sessionStorage: new MemStorage(), claude: { use: (n: string) => Promise.resolve(n === 'sample' ? sample : null) }, addEventListener: () => undefined, removeEventListener: () => undefined });
  };
  const run = (priority: 'user' | 'background') => askJson({ template: diagnoseV2, vars: dVars, signal: new AbortController().signal, priority });
  const mode = (m: string): void => void ((globalThis as { __LINGO_FAKE__?: { diagnoseMode?: string } }).__LINGO_FAKE__ = { diagnoseMode: m });

  beforeAll(async () => {
    stub();
    initCapabilities();
    await vi.waitFor(() => expect(useCapabilities.getState().sample).toBe('ready'));
  });
  beforeEach(() => {
    prompts.length = 0;
    stub();
    resetAiGate();
    resetAiBudget();
    useCapabilities.setState({ sampleRevoked: false });
    markSampleConfirmed();
    mode('');
  });
  afterEach(() => {
    delete (globalThis as { __LINGO_FAKE__?: unknown }).__LINGO_FAKE__;
  });

  it('gültige Antwort: genau ein Aufruf, Stufe complex', async () => {
    const r = await run('user');
    expect(prompts).toHaveLength(1);
    expect(r.data.hyps[0]?.verdict).toBe('likely');
  });

  it('erfundene Kennungen fallen ohne Neuversuch weg', async () => {
    mode('zzinvent');
    const r = await run('user');
    expect(prompts).toHaveLength(1);
    expect(r.data.hyps.map((h) => h.id)).toEqual([HYP]);
    expect(r.data.hyps[0]?.ev).not.toContain('p:invented.one');
  });

  it('Schemafehler: genau ein Neuversuch mit angehängtem Mangel', async () => {
    mode('zzschema');
    const r = await run('user');
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('did not match the required format');
    expect(r.data.summary.de.length).toBeGreaterThan(9);
  });

  it('kein JSON: kein automatischer Neuversuch', async () => {
    mode('zzjson');
    await expect(run('user')).rejects.toBeInstanceOf(AiFailure);
    expect(prompts).toHaveLength(1);
  });

  it('Hintergrund: höchstens ein Aufruf am Tag', async () => {
    await run('background');
    await expect(run('background')).rejects.toMatchObject({ kind: 'busy', code: 'budget' });
    expect(prompts).toHaveLength(1);
  });
});

describe('solve-check@1', () => {
  const tasks: SolveCheckTask[] = [
    { type: 'gap', prompt: 'Report 12 ___ (send) to Lena yesterday afternoon.', options: null, hint: '(send)' },
    { type: 'mc', prompt: 'Report 13 ___ by Tom every Monday morning.', options: ['checks', 'is checked', 'is checking'], hint: '' },
    { type: 'correct', prompt: 'Report 14 was send to Mia last week.', options: null, hint: '', goal: { de: 'Der Bericht ging letzte Woche an Mia.', en: 'The report went to Mia last week.' } },
  ];

  it('Kopfzeile, quick, kein Zwischenspeicher, Budget; die Lösung steht nie im Prompt', () => {
    const p = solveCheck.build({ tasks });
    expect(p.split('\n')[0]).toBe('[solve-check@1]');
    expect(solveCheck.tier).toBe('quick');
    expect(solveCheck.cache).toBe(false);
    expect(solveCheck.budget).toEqual({ bgPerDay: 2 });
    expect(p).toContain('#1 | type=mc | sentence=Report 13 ___ by Tom every Monday morning. | options=checks / is checked / is checking');
    expect(p).toContain('goal=The report went to Mia last week.');
    expect(p).not.toContain('was sent');
    expect(p).toContain('British forms and spellings are also correct');
  });

  it('eine Aufgabe höchstens 600 Byte; Umformung als Quelle und Ziel', () => {
    expect(bytes(taskLine({ type: 'gap', prompt: `${'ä'.repeat(400)} ___.`, options: null, hint: 'x'.repeat(80) }, 0))).toBeLessThanOrEqual(TASK_MAX_BYTES);
    expect(taskLine({ type: 'transform', prompt: 'Tom updates the report every week. → The report ___ every week.', options: null, hint: '' }, 2)).toContain('source=Tom updates the report every week. | target=The report ___ every week.');
  });

  it('Schema: Beispiel besteht; tolerant (nacktes Array, Text statt Liste), unbekannte Indizes fallen weg', () => {
    const s = solveCheck.schema({ tasks });
    expect(s.safeParse(JSON.parse(SOLVE_CHECK_EXAMPLE)).success).toBe(true);
    // Gegenlesung S4: zwei gleichwertige Formen sind NICHT mehrdeutig (beide stehen in answers); echte Mehrdeutigkeit = ohne Zeitangabe.
    const three = Array.from({ length: 3 }, () => tasks[0] as SolveCheckTask);
    const ex = solveCheck.schema({ tasks: three }).parse(JSON.parse(SOLVE_CHECK_EXAMPLE));
    expect(ex.results.map((x) => x.ambiguous)).toEqual([false, false, true]);
    expect(ex.results[1]?.answers).toEqual(['has worked', 'has been working']);
    const r = s.safeParse([{ i: 2, answers: 'Report 14 was sent to Mia last week.', ambiguous: false, why: { de: 'a', en: 'b' } }, { i: 9, answers: ['x'] }, { i: 0, answers: ['was sent'] }, { i: 0, answers: ['x'] }]);
    expect(r.success).toBe(true);
    expect(r.data?.results.map((x) => x.i)).toEqual([0, 2]);
    expect(r.data?.results[0]).toMatchObject({ ambiguous: true, why: { de: '', en: '' } });
    expect(r.data?.results[1]?.answers).toEqual(['Report 14 was sent to Mia last week.']);
  });

  it('kein brauchbares Ergebnis → Schemafehler (ein Neuversuch nach A6.3)', () => {
    expect(solveCheck.schema({ tasks }).safeParse({ results: [{ i: 7, answers: ['x'] }] }).success).toBe(false);
  });

  it('Test-Antwort löst die Test-Aufgaben von grammar-items; zusammen mit acceptGrammarItem bleiben sie gültig', () => {
    const vars: GrammarItemsVars = { topic: 'passive', nameEn: 'Passive voice', ruleEn: 'be + past participle', examples: [], p: 0.5, types: ['gap', 'mc', 'correct', 'transform'], seenText: [], errors: [], count: 4 };
    const gen = grammarItems.schema(vars).safeParse(JSON.parse(grammarItemsReplyV3(grammarItems.build(vars))));
    expect(gen.success, JSON.stringify(gen.error?.issues)).toBe(true);
    const items = (gen.data as { items: Array<Record<string, unknown>> }).items;
    const solveTasks = items.map((it) => ({ type: it.type, prompt: it.prompt, options: it.options ?? null, hint: typeof it.hint_de === 'string' ? it.hint_de : '', goal: it.goal }) as SolveCheckTask);
    const out = solveCheck.schema({ tasks: solveTasks }).parse(JSON.parse(solveCheckReply(solveCheck.build({ tasks: solveTasks }))));
    expect(out.results).toHaveLength(items.length);
    items.forEach((it, i) => {
      const sc = out.results.find((r) => r.i === i) ?? null;
      expect(acceptGrammarItem(it, { solve: sc }).reasons, `${String(it.type)} ${String(it.prompt)}`).toEqual([]);
    });
  });
});

describe('word-bank@1', () => {
  const vars: WordBankVars = {
    cards: [
      { id: 'v_reliable', en: 'reliable', pos: 'adj', de: 'zuverlässig', ex: 'Our supplier is very reliable.', kind: 'word', have: ['Our supplier is very reliable.'] },
      { id: 'v_zzuk', en: 'leverage', pos: 'verb', de: 'nutzen', ex: '', kind: 'word', have: [] },
    ],
    ctx: 'SaaS sales, partner deals',
  };

  it('Kopfzeile, quick, kein Zwischenspeicher, Budget 3; Regeln zu Satzarten und Wendungen', () => {
    const p = wordBank.build(vars);
    expect(p.split('\n')[0]).toBe('[word-bank@1]');
    expect(wordBank.tier).toBe('quick');
    expect(wordBank.cache).toBe(false);
    expect(wordBank.budget).toEqual({ bgPerDay: 3 });
    expect(p).toContain('- id=v_reliable | word=reliable | pos=adj | meaning=zuverlässig | card sentence=Our supplier is very reliable. | already has=Our supplier is very reliable.');
    expect(p).toContain('fill sb/sth differently');
    expect(TEMPLATES).toContain(wordBank);
    expect(bytes(wordBank.build({ ...vars, cards: Array.from({ length: 12 }, (_, i) => ({ ...vars.cards[0]!, id: `v${i}`, have: ['x'.repeat(200), 'y', 'z', 'w'] })) }))).toBeLessThan(8_000);
  });

  it('Beispiel: Schema und Satzprüfung bestehen (4 Sätze: 2 Beruf, 1 Alltag, 1 Satzform)', () => {
    const out = wordBank.schema(vars).parse(JSON.parse(WORD_BANK_EXAMPLE));
    const r = acceptBankItem(out.items[0], { id: 'v_reliable', en: 'reliable' }, new Set(), 1, 'word-bank@1');
    expect(r.rejected).toEqual([]);
    expect(r.sb.map((s) => s.k)).toEqual(['work', 'work', 'life', 'form']);
  });

  it('tolerant: nacktes Array; leere Antwort ist ein Schemafehler', () => {
    expect(wordBank.schema(vars).safeParse([{ id: 'a' }]).success).toBe(true);
    expect(wordBank.schema(vars).safeParse({ items: [] }).success).toBe(false);
  });

  it('Test-Antwort: je Karte 4 Sätze; britisch markierte fallen bei der Prüfung weg', () => {
    const out = wordBank.schema(vars).parse(JSON.parse(wordBankReply(wordBank.build({ ...vars, cards: [vars.cards[0]!, { ...vars.cards[1]!, en: 'zzuk' }] }))));
    const a = acceptBankItem(out.items[0], { id: 'v_reliable', en: 'reliable' }, new Set(), 1, 'word-bank@1');
    expect(a.sb).toHaveLength(4);
    const b = acceptBankItem(out.items[1], { id: 'v_zzuk', en: 'zzuk' }, new Set(), 1, 'word-bank@1');
    expect(b.rejected).toEqual(['british']);
    expect(b.sb).toHaveLength(3);
  });
});
