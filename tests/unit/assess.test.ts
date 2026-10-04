import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJsonText, resetAiGate } from '../../src/ai/gate';
import { allowedActions, focusChannels, isKnownAction } from '../../src/domain/assessment/actions';
import { assessDue } from '../../src/domain/assessment/due';
import { assessWrite, fullData, HIST_MAX, readAssess, readAssessData, type AssessResult } from '../../src/domain/assessment/envelope';
import { buildEvidence, EVIDENCE_BUDGET, evidenceText, fitBudget, sectionBytes } from '../../src/domain/assessment/evidence';
import { writingSources } from '../../src/domain/assessment/sources';
import { allStrengths, dimStrength } from '../../src/domain/assessment/strength';
import { DIMS, type AssessData, type EvidenceCounts } from '../../src/domain/assessment/types';
import { capConfidence, finalizeAssess } from '../../src/domain/assessment/validate';
import { assess, assessExample, assessSchema } from '../../src/prompts/assess';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { assessReply, setAssessBad } from '../../src/platform/dev/canned/assess';
import { loadSeed, berlin, type Doc } from './helpers';
import { createFakeClaude } from '../../src/platform/dev/fakeRuntime';
import type * as AssessRunMod from '../../src/features/progress/assessRun';
import type * as LiveMod from '../../src/data/live';

const seed = loadSeed();
const today = '2026-09-20';
const nowMs = berlin(today, 21);

function collection(name: string): Map<string, Doc> {
  const out = new Map<string, Doc>();
  for (const [p, d] of Object.entries(seed)) if (p.startsWith(`${name}/`) && p.split('/').length === 2) out.set(p.slice(name.length + 1), d);
  return out;
}

function evidenceFromSeed(over: Partial<Parameters<typeof buildEvidence>[0]> = {}) {
  const logs = new Map<string, Doc>();
  for (const [id, d] of collection('log')) logs.set(id, d);
  return buildEvidence({
    nowMs,
    today,
    profile: seed['app/profile']!,
    grammar: collection('grammar'),
    radar: seed['app/radar'] ?? null,
    vocab: collection('vocab'),
    logs,
    prev: readAssess(seed['app/assess']),
    ...over,
  });
}

const counts = (o: Partial<EvidenceCounts> = {}): EvidenceCounts => ({
  answers14: 0,
  grammarN: 0,
  grammarTopics: 0,
  vocabReviews30: 0,
  vtestDays: null,
  vtestD: null,
  ...o,
});

describe('app/assess: beide Formen lesen, Hülle schreiben (A6.10)', () => {
  it('liest die Hülle der alten App und die flache Form aus Anhang B', () => {
    const env = readAssess(seed['app/assess']);
    expect(env?.data.cefr).toBe('B2');
    expect(env?.lang).toBe('de');
    expect(env?.data.dims).toHaveLength(6);
    const flat = readAssess({ level: 'Solides B2 mit Luft nach oben', cefr: 'B2+', trend: 'up', dims: [{ id: 'grammar', level: 'B2', confidence: 'good' }] });
    expect(flat?.data.cefr).toBe('B2+');
    expect(flat?.lang).toBe('de');
    expect(readAssess({ d: '2026-01-01' })).toBeNull();
    expect(readAssess(null)).toBeNull();
  });

  it('tolerant: unbekannte Stufe → null, unbekannte Belastbarkeit → thin, doppelte Fertigkeit nur einmal', () => {
    const d = readAssessData({ cefr: 'Z9', dims: [{ id: 'grammar', level: 'X', confidence: 'great' }, { id: 'grammar', level: 'B2' }, { id: 'foo' }] });
    expect(d.cefr).toBeNull();
    expect(d.dims).toEqual([{ id: 'grammar', level: null, confidence: 'thin', why: null }]);
  });

  const result = (data: AssessData, t = nowMs + 1000): AssessResult => ({ day: today, t, lang: 'de', answers: 2000, writings: 7, tier: 'complex', basis: { answers14: 10 }, data });

  it('fehlt das Dokument → set mit Hülle; sonst update mit vollständigem data inkl. null; flache Altfelder bleiben', () => {
    const data = readAssessData({ cefr: 'B2', level: 'x', dims: [] });
    const created = assessWrite(undefined, result(data), nowMs);
    expect(created && 'set' in created).toBe(true);
    const cur = { level: 'ALT flach', d: '2026-09-18', t: nowMs - 1000, data: { cefr: 'B1', extra: 1 }, hist: [] };
    const op = assessWrite(cur, result(data), nowMs);
    expect(op && 'update' in op).toBe(true);
    const upd = (op as { update: Doc }).update;
    expect(upd.level).toBeUndefined(); // flaches Altfeld unberührt
    const d = upd.data as Doc;
    for (const k of ['level', 'cefr', 'levelWhy', 'trend', 'trendWhy', 'today', 'c1gap', 'strengths', 'blockers', 'dims', 'focus']) expect(k in d).toBe(true);
    expect(d.trend).toBeNull();
    expect(d.focus).toBeNull();
    expect(upd.pv).toBe('assess@3');
    expect(upd.v).toBe(2);
  });

  it('Befund W2/H3: Altform der alten App (gr…fl, low/mid/high) wird gelesen und beim ersten neuen Lauf in hist übernommen', () => {
    // Form wie in den echten Daten, Werte erfunden.
    const legacy = {
      d: '2026-09-18', t: nowMs - 1000, lang: 'de', answers: 900, writings: 3,
      data: {
        level: 'Solides B2', cefr: 'B2', trend: 'flat',
        dims: [
          { id: 'gr', level: 'B2', confidence: 'mid', why: 'a' },
          { id: 'vo', level: 'B2', confidence: 'mid', why: 'b' },
          { id: 're', level: 'B2', confidence: 'low', why: 'c' },
          { id: 'li', level: 'B1+', confidence: 'low', why: 'd' },
          { id: 'wr', level: 'B2', confidence: 'high', why: 'e' },
          { id: 'fl', level: 'B2', confidence: 'low', why: 'f' },
        ],
      },
    };
    const a = readAssess(legacy)!;
    expect(a.data.dims.map((x) => [x.id, x.confidence])).toEqual([
      ['grammar', 'fair'], ['vocabulary', 'fair'], ['reading', 'thin'], ['listening', 'thin'], ['writing', 'good'], ['speaking', 'thin'],
    ]);
    expect(a.data.dims.find((x) => x.id === 'listening')?.level).toBe('B1+');
    const op = assessWrite(legacy, result(readAssessData({ cefr: 'B2+' })), nowMs) as { update: Doc };
    const h = op.update.hist as Doc[];
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ d: '2026-09-18', cefr: 'B2', trend: 'flat', dims: { grammar: 'B2', vocabulary: 'B2', reading: 'B2', listening: 'B1+', writing: 'B2', speaking: 'B2' } });
    expect(h[1]).toMatchObject({ d: today, cefr: 'B2+' });
    // Mit vorhandenem hist wird nichts nachgetragen.
    const again = assessWrite({ ...legacy, hist: [] }, result(readAssessData({ cefr: 'B2+' })), nowMs) as { update: Doc };
    expect(again.update.hist as Doc[]).toHaveLength(1);
    expect(readAssess({ d: 'x', hist: [{ d: '2026-09-01', cefr: 'B2', dims: { gr: 'B2', fl: 'B1' } }], data: { cefr: 'B2' } })!.hist[0]!.dims).toEqual({ grammar: 'B2', speaking: 'B1' });
  });

  it('das andere Gerät war schneller (cur.t > startedAt) → nichts schreiben', () => {
    const data = readAssessData({ cefr: 'B2' });
    expect(assessWrite({ t: nowMs + 5 }, result(data), nowMs)).toBeNull();
  });

  it('hist wächst um einen Eintrag je Tag, höchstens 60', () => {
    const hist = Array.from({ length: 70 }, (_, i) => ({ d: `2026-06-${String((i % 28) + 1).padStart(2, '0')}-${i}`, cefr: 'B2' }));
    const op = assessWrite({ t: 0, hist }, result(readAssessData({ cefr: 'B2+' })), nowMs) as { update: Doc };
    const h = op.update.hist as Doc[];
    expect(h).toHaveLength(HIST_MAX);
    expect(h[h.length - 1]).toMatchObject({ d: today, cefr: 'B2+' });
  });

  it('fullData setzt jeden Schlüssel', () => {
    expect(Object.keys(fullData(readAssessData({})))).toHaveLength(11);
  });
});

describe('assessDue (Plan §4.4)', () => {
  const a = readAssess({ ...seed['app/assess'], d: '2026-09-19', answers: 1000, writings: 2 })!;
  const base = { assess: a, uiLang: 'de' as const, today, profileAnswers: 1100, lastAutoDay: null };
  it('alle Gründe in ihrer Reihenfolge', () => {
    expect(assessDue({ ...base, lastAutoDay: today })).toBe('none');
    expect(assessDue({ ...base, assess: null, profileAnswers: 99 })).toBe('none');
    expect(assessDue({ ...base, assess: null, profileAnswers: 100 })).toBe('first');
    expect(assessDue({ ...base, uiLang: 'en' })).toBe('lang');
    expect(assessDue({ ...base, assess: { ...a, d: today } })).toBe('none');
    expect(assessDue({ ...base, assess: { ...a, d: '2026-09-17' } })).toBe('age');
    expect(assessDue({ ...base, profileAnswers: 1300 })).toBe('answers');
    expect(assessDue(base)).toBe('none');
  });
  it('Sprachwechsel wirkt auch am selben Tag, aber nur einmal je Tag automatisch', () => {
    expect(assessDue({ ...base, uiLang: 'en', assess: { ...a, d: today } })).toBe('lang');
    expect(assessDue({ ...base, uiLang: 'en', lastAutoDay: today })).toBe('none');
  });
});

describe('Belegstärke und Nachprüfung (Plan §4.3)', () => {
  it('Schwellen je Fertigkeit', () => {
    expect(dimStrength('grammar', counts())).toBe('none');
    expect(dimStrength('grammar', counts({ grammarN: 30 }))).toBe('thin');
    expect(dimStrength('grammar', counts({ grammarN: 60 }))).toBe('fair');
    expect(dimStrength('grammar', counts({ grammarN: 250, grammarTopics: 8 }))).toBe('good');
    expect(dimStrength('vocabulary', counts({ vtestDays: 20, vocabReviews30: 400 }))).toBe('good');
    expect(dimStrength('vocabulary', counts({ vtestDays: 120, vocabReviews30: 400 }))).toBe('fair');
  });
  it('Belastbarkeit = min(KI, Code); ohne Belege keine Stufe und kein KI-Text', () => {
    expect(capConfidence('good', 'fair')).toBe('fair');
    expect(capConfidence('thin', 'good')).toBe('thin');
    const d = readAssessData({ dims: DIMS.map((id) => ({ id, level: 'C1', confidence: 'good', why: 'KI sagt gut' })), focus: { title: 'x', why: 'y', action: 'write', days: 2 } });
    const out = finalizeAssess(d, { ...allStrengths(counts({ grammarN: 60 })) });
    const g = out.dims.find((x) => x.id === 'grammar')!;
    expect(g).toMatchObject({ level: 'C1', confidence: 'fair' });
    // Seit assess@3 nur noch Grammatik und Wortschatz; ohne Belege (Wortschatz) keine Stufe.
    const v = out.dims.find((x) => x.id === 'vocabulary')!;
    expect(v).toEqual({ id: 'vocabulary', level: null, confidence: 'thin', why: null });
    expect(out.dims.map((x) => x.id)).toEqual(['grammar', 'vocabulary']);
    expect(out.focus?.channels).toEqual(['write']);
  });
});

describe('Aktionen', () => {
  it('Katalog und Kanäle des Fokus', () => {
    const allowed = allowedActions({ errorTopics: ['passive', 'nope'], nextLesson: 'l07' });
    expect(allowed).toContain('grammar:mixed-cond');
    expect(allowed).toContain('errors:passive');
    expect(allowed).not.toContain('errors:nope');
    expect(allowed).toContain('lesson:l07');
    expect(allowed.every(isKnownAction)).toBe(true);
    expect(isKnownAction('grammar:unknown')).toBe(false);
    expect(focusChannels('grammar:passive')).toEqual(['gram', 'order']);
    expect(focusChannels('business:nego')).toEqual(['speak', 'write']);
    expect(focusChannels('lesson:l07')).toEqual([]);
  });
});

describe('Belegpaket (Plan §4.2)', () => {
  it('aus den Testdaten: Kennungen eindeutig, Abschnitte gefüllt, im Budget', () => {
    const pack = evidenceFromSeed();
    expect(new Set(pack.ids).size).toBe(pack.ids.length);
    expect(pack.ids).toContain('p:14d');
    expect(pack.ids.some((i) => i.startsWith('g:'))).toBe(true);
    expect(pack.ids.some((i) => /^(w|rd|li|s|pp):/.test(i))).toBe(false);
    expect(pack.ids.some((i) => i.startsWith('r:'))).toBe(true);
    expect(sectionBytes(pack.sections)).toBeLessThanOrEqual(EVIDENCE_BUDGET);
    expect(evidenceText(pack)).toMatch(/^## Activity/);
  });

  it('fehlende Quellen ergeben leere Abschnitte, nie einen Fehler', () => {
    const empty = new Map<string, Doc>();
    const pack = buildEvidence({ nowMs, today, profile: {}, grammar: empty, radar: null, vocab: empty, logs: empty, prev: null });
    expect(pack.ids).toEqual(['p:14d', 'v:cards']);
    expect(pack.counts.grammarN).toBe(0);
  });

  it('beide Fehlerformen in Texten (orig/fix und wrong/right)', () => {
    const ws = writingSources(collection('writing'));
    const all = ws.flatMap((w) => w.errors);
    expect(all.some((e) => e.wrong === 'has problems with the chips' && e.right === 'is facing chip shortages')).toBe(true);
    expect(all.some((e) => e.wrong === 'save costs for servers' && e.right === 'save on server costs')).toBe(true);
  });

  it('Großdatensatz: ≤ 46 KB; Prompt ≤ 60.000 B', () => {
    const big = (s: string) => s.repeat(40);
    const radar = { events: Array.from({ length: 400 }, (_, i) => ({ c: 'tense', s: 'g', t: nowMs - i * 1000, q: big('long sentence '), g: big('x'), a: big('y') })) };
    const pack = evidenceFromSeed({ radar });
    expect(sectionBytes(pack.sections)).toBeLessThanOrEqual(EVIDENCE_BUDGET);
    const vars = { lang: 'de' as const, evidence: evidenceText(pack), ids: pack.ids, allowed: allowedActions({ errorTopics: [], nextLesson: 'l07' }), prev: null, today };
    expect(promptBytes(assess.build(vars))).toBeLessThanOrEqual(PROMPT_MAX_BYTES);
  });

  it('fitBudget kürzt zuerst r, dann l, dann g', () => {
    const line = (id: string) => ({ id, text: 'x'.repeat(90) });
    const secs = (['r', 'l', 'g'] as const).map((key) => ({ key, title: key, lines: Array.from({ length: 5 }, (_, i) => line(`${key}:${i}`)) }));
    const total = sectionBytes(secs);
    const out = fitBudget(secs, total - 400);
    expect(out.find((s) => s.key === 'r')?.lines.length ?? 0).toBeLessThan(5);
    expect(out.find((s) => s.key === 'g')?.lines).toHaveLength(5);
  });
});

describe('assess@3: Vorlage und Schema (Kap. 12 „Einschätzungs-Validierung")', () => {
  const pack = evidenceFromSeed();
  const allowed = allowedActions({ errorTopics: ['passive'], nextLesson: 'l07' });
  const vars = { lang: 'de' as const, evidence: evidenceText(pack), ids: pack.ids, allowed, prev: null, today };
  const ok = () => structuredClone(assessExample(vars));

  it('Kopfzeile, complex, kein Zwischenspeicher, text-json', () => {
    expect(assess.build(vars).split('\n')[0]).toBe('[assess@3]');
    expect(assess.tier).toBe('complex');
    expect(assess.cache).toBe(false);
    expect(assess.verb).toBe('text-json');
  });

  it('das Beispiel besteht sein eigenes Schema (DE und EN)', () => {
    expect(assessSchema(vars).safeParse(ok()).success).toBe(true);
    const en = { ...vars, lang: 'en' as const };
    expect(assessSchema(en).safeParse(assessExample(en)).success).toBe(true);
  });

  it('lehnt unbekannte Stufe, falsche Sprache, deutschen fix, unbekannte Aktion und unbekannte Belege ab', () => {
    const s = assessSchema(vars);
    expect(s.safeParse({ ...ok(), cefr: 'Z9' }).success).toBe(false);
    expect(s.safeParse({ ...ok(), levelWhy: 'Your texts are well structured but conditionals still go wrong often.' }).success).toBe(false);
    const fixDe = ok();
    fixDe.blockers[0]!.fix = 'Wenn wir früher getestet hätten, wären wir jetzt nicht hier.';
    expect(s.safeParse(fixDe).success).toBe(false);
    const act = ok();
    act.focus.action = 'grammar:unknown';
    expect(s.safeParse(act).success).toBe(false);
    const ev = ok();
    ev.strengths[0]!.ev = ['g:erfunden'];
    expect(s.safeParse(ev).success).toBe(false);
  });

  it('Befund H7/W6: höchstens so viele Belege wie angewiesen (überzählige fallen weg), Titel in der Oberflächensprache', () => {
    const s = assessSchema(vars);
    const many = ok();
    many.strengths[0]!.ev = pack.ids.slice(0, 4);
    expect(pack.ids.length).toBeGreaterThanOrEqual(4);
    expect(s.parse(many).strengths[0]!.ev).toEqual(pack.ids.slice(0, 3));
    expect(assess.build(vars)).toContain('cites 1–3 evidence ids');
    const title = ok();
    title.strengths[0]!.title = 'Your emails are clear and well structured';
    expect(s.safeParse(title).success).toBe(false);
    expect(ok().blockers.every((b) => !/^(Mixed|Present)/.test(b.title))).toBe(true);
  });

  it('genau 2 eindeutige Fertigkeiten: doppelte und fremde fallen weg, fehlende kommen als „thin" ohne Stufe dazu (W6)', () => {
    const dup = ok();
    dup.dims[1] = { ...dup.dims[0]! };
    const d1 = assessSchema(vars).parse(dup).dims;
    expect(d1.map((d) => d.id)).toEqual(['grammar', 'vocabulary']);
    expect(d1[1]).toEqual({ id: 'vocabulary', level: null, confidence: 'thin', why: null });
    const extra = ok();
    extra.dims.push({ id: 'speaking' as never, level: 'B2', confidence: 'fair', why: 'x' });
    expect(assessSchema(vars).parse(extra).dims.map((d) => d.id)).toEqual(['grammar', 'vocabulary']);
    const five = ok();
    five.dims.shift();
    const d2 = assessSchema(vars).parse(five).dims;
    expect(d2).toHaveLength(2);
    expect(d2[0]).toEqual({ id: 'grammar', level: null, confidence: 'thin', why: null });
  });

  it('W6: realistische Antworten werden normalisiert statt abgelehnt', () => {
    const s = assessSchema(vars);
    const id0 = pack.ids[0]!;
    // Freie Werte, wie Claude sie liefert – am Typ vorbei gesetzt.
    const set = (o: object, k: string, v: unknown) => {
      (o as Record<string, unknown>)[k] = v;
    };
    const r = ok();
    set(r, 'level', 'Solides B2');
    set(r, 'cefr', 'B2/C1');
    set(r, 'trend', 'stable');
    r.today = 'Heute: 10 Minuten Mixed Conditionals mit eigenen Beispielen aus deinem Vertriebsalltag üben, danach eine kurze E-Mail an einen Kunden schreiben, in der du zwei Bedingungssätze verwendest.';
    r.c1gap = ['Gemischte Bedingungssätze (Mixed Conditionals) spontan und fehlerfrei in Verhandlungen anwenden', 'Kritik diplomatisch äußern'];
    r.strengths[0]!.ev = [`[${id0}]`];
    r.strengths[0]!.why = 'Deine Wortschatzarbeit ist sehr konstant: Du hast in den letzten 14 Tagen jeden Tag geübt, die Trefferquote liegt bei gut 80 Prozent, und selbst schwierige Kollokationen sitzen inzwischen deutlich sicherer als noch vor einem Monat.';
    r.blockers[0]!.title = 'Present Perfect Continuous bei laufenden Projekten und Entwicklungen';
    r.blockers.push(structuredClone(r.blockers[0]!), structuredClone(r.blockers[0]!));
    r.blockers[0]!.action = 'mixed-cond';
    r.focus.action = 'grammar: passive';
    set(r.focus, 'days', '3');
    set(r.dims[0]!, 'level', 'B2-');
    set(r.dims[0]!, 'confidence', 'medium');
    set(r.dims[1]!, 'why', null);
    const res = s.safeParse(r);
    expect(res.error?.issues ?? []).toEqual([]);
    const o = res.data!;
    expect(o.cefr).toBe('B2');
    expect(o.trend).toBe('flat');
    expect(Array.from(o.today).length).toBeLessThanOrEqual(160);
    expect(o.today.endsWith('…')).toBe(true);
    expect(o.c1gap[0]!.length).toBeLessThanOrEqual(90);
    expect(o.strengths[0]!.ev).toEqual([id0]);
    expect(o.blockers).toHaveLength(3);
    expect(o.blockers[0]!.action).toBe('grammar:mixed-cond');
    expect(o.focus).toMatchObject({ action: 'grammar:passive', days: 3 });
    expect(o.dims[0]).toMatchObject({ level: 'B2', confidence: 'fair' });
    expect(o.dims[1]!.why).toBeNull();
  });

  it('feste Antwort des Adapters besteht das Schema; im Fehlermodus erst beim Neuversuch', () => {
    const prompt = assess.build(vars);
    expect(assessSchema(vars).safeParse(JSON.parse(assessReply(prompt))).success).toBe(true);
    setAssessBad(true);
    expect(assessSchema(vars).safeParse(JSON.parse(assessReply(prompt))).success).toBe(false);
    expect(assessSchema(vars).safeParse(JSON.parse(assessReply(`${prompt}\nYour previous reply did not match the required format`))).success).toBe(true);
    setAssessBad(false);
  });
});

describe('parseJsonText (dieselben drei Regeln wie sample.json)', () => {
  it('ganzer Text, ein Codeblock, erstes { bis letztes }', () => {
    expect(parseJsonText('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonText('Here:\n```json\n{"a":2}\n```\nDone.')).toEqual({ a: 2 });
    expect(parseJsonText('Sure. {"a":3} Hope it helps.')).toEqual({ a: 3 });
    expect(parseJsonText('no json here')).toBeUndefined();
    expect(parseJsonText('{"a":1} and {"b":2}')).toBeUndefined();
  });
});

// ---------------------------------------------------------------- Ablauf gegen die nachgebildete Laufzeit

describe('Ablauf der Einschätzung (Plan §4.5)', () => {
  let stop: (() => void) | null = null;
  type Mods = { run: typeof AssessRunMod; live: typeof LiveMod; fake: ReturnType<typeof createFakeClaude> };
  let m: Mods;

  beforeAll(async () => {
    const fake = createFakeClaude({ seed: structuredClone(seed), useDelayMs: 0 });
    (globalThis as { window?: unknown }).window = { claude: fake.claude, addEventListener: () => undefined };
    const caps = await import('../../src/platform/capabilities');
    caps.initCapabilities();
    await vi.waitFor(() => expect(caps.useCapabilities.getState().sample).toBe('ready'));
    await vi.waitFor(() => expect(caps.useCapabilities.getState().db).toBe('ready'));
    const live = await import('../../src/data/live');
    stop = live.startLive(caps.getDb()!);
    await vi.waitFor(() => expect(live.useLive.getState().status).toBe('ready'));
    m = { run: await import('../../src/features/progress/assessRun'), live, fake };
  });
  afterAll(() => stop?.());
  beforeEach(() => {
    resetAiGate();
    m.run.resetAssessRunForTests();
    m.fake.control.sampleCalls.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('belegt (anderes Gerät hält die Sperre) → busy, kein Aufruf', async () => {
    await m.fake.control.db.db.doc('app/assess').acquire({ holder: 'anderes-geraet', ttlMs: 1000 });
    const phase = await m.run.runAssess('manual', nowMs);
    expect(phase).toBe('busy');
    expect(m.fake.control.sampleCalls).toHaveLength(0);
    // Die Sperre läuft von selbst ab (kein Freigeben, db.d.ts).
    await new Promise((r) => setTimeout(r, 1100));
  });

  it('manuell: ein Aufruf, Hülle mit v:2, tier, hist und Belegen gespeichert', async () => {
    const phase = await m.run.runAssess('manual', nowMs);
    expect(phase).toBe('done');
    expect(m.fake.control.sampleCalls.filter((c) => c.id === 'assess')).toHaveLength(1);
    expect(m.fake.control.sampleCalls[0]?.tier).toBe('complex');
    expect(m.fake.control.sampleCalls[0]?.cache).toBe(false);
    const doc = m.fake.control.db.dump()['app/assess']!;
    expect(doc).toMatchObject({ v: 2, pv: 'assess@3', tier: 'complex', lang: 'de', d: today });
    expect((doc.data as Doc).dims).toHaveLength(2);
    expect((doc.hist as Doc[]).length).toBeGreaterThanOrEqual(1);
    const read = readAssess(doc)!;
    expect(read.data.strengths.every((s) => s.ev.length > 0)).toBe(true);
  });

});
