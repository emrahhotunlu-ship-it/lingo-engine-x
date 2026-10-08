import { afterEach, describe, expect, it } from 'vitest';
import { c1EvidenceLines, c1EvidenceText, c1Way, openCrit, saneC1, type WayInput } from '../../src/domain/c1/way';
import { emptyC1 } from '../../src/domain/c1/c1doc';
import { allowedActions } from '../../src/domain/assessment/actions';
import { fullData, readAssessData } from '../../src/domain/assessment/envelope';
import { buildEvidence, evidenceText } from '../../src/domain/assessment/evidence';
import { readAssess } from '../../src/domain/assessment/envelope';
import { assess4, assess4Example, assess4Schema, c1VerdictSchema, cleanMissing, type Assess4Vars } from '../../src/prompts/assess4';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { assessReply, setAssessBad } from '../../src/platform/dev/canned/assess';
import { assessDataSchema } from '../../src/data/schemas';
import { loadSeed, berlin, type Doc } from './helpers';

// assess@4 (Lernplattform 3.0 P45): Urteil „Weg zu C1“ in Worten aus Belegen, keine Punktzahl; Sprachtreue; feste Antwort des Entwicklungs-Adapters.

const seed = loadSeed();
const today = '2026-09-20';
const nowMs = berlin(today, 21);

function collection(name: string): Map<string, Doc> {
  const out = new Map<string, Doc>();
  for (const [p, d] of Object.entries(seed)) if (p.startsWith(`${name}/`) && p.split('/').length === 2) out.set(p.slice(name.length + 1), d);
  return out;
}

const wayIn = (over: Partial<WayInput> = {}): WayInput => ({
  today,
  nowMs,
  c1: undefined,
  grammar: new Map(),
  profile: undefined,
  cards: [],
  patterns: undefined,
  logs: null,
  itemOf: () => null,
  ...over,
});

const C1_RAW = {
  v: 1,
  checks: [
    { d: '2026-07-20', f: 'A', inp: 'desk', p: [5, 4, 4, 6], pts: 19, max: 36 },
    { d: '2026-08-20', f: 'B', inp: 'touch', p: [5, 5, 4, 7], pts: 21, max: 36 },
    { d: '2026-09-19', f: 'A', inp: 'desk', p: [6, 5, 5, 8], pts: 24, max: 36 },
    { d: 'kaputt', p: [1], pts: 3 },
  ],
  gates: [{ d: '2026-09-01', ch: 1, g: [17, 20], w: [8, 8], ok: true }, { d: '2026-09-02', ch: 2, g: [1] }],
  prod: [{ d: '2026-09-18', s: 'mail', w: 120, e: 5 }, { d: 'x', w: 10, e: 1 }],
  place: { d: '2026-07-01', se: 0.3, n: 24, th: 0.4, skip: [] },
  bad: [],
};

function vars(lang: 'de' | 'en' = 'de', c1Raw: unknown = C1_RAW): Assess4Vars {
  const logs = new Map<string, Doc>();
  for (const [id, d] of collection('log')) logs.set(id, d);
  const pack = buildEvidence({ nowMs, today, profile: seed['app/profile']!, grammar: collection('grammar'), radar: seed['app/radar'] ?? null, vocab: collection('vocab'), logs, prev: readAssess(seed['app/assess']) });
  const w = c1Way(wayIn({ c1: c1Raw, grammar: collection('grammar'), profile: seed['app/profile'] }));
  const lines = c1EvidenceLines(w);
  return {
    lang,
    evidence: evidenceText(pack),
    ids: pack.ids,
    allowed: allowedActions({ errorTopics: ['passive'], nextLesson: 'l07' }),
    prev: null,
    today,
    c1: { evidence: c1EvidenceText(lines), ids: lines.map((l) => l.id), open: openCrit(w.crit) },
  };
}

afterEach(() => setAssessBad(false));

describe('Weg zu C1: reine Zusammenfassung (way.ts)', () => {
  it('ohne Daten: Leerzustand, alle sieben „zu wenig Daten“', () => {
    const w = c1Way(wayIn());
    expect(w.empty).toBe(true);
    expect(w.crit.list.map((c) => c.state)).toEqual(['few', 'few', 'few', 'few', 'few', 'few', 'few']);
    expect(w.view.kind).toBe('wait');
    expect(openCrit(w.crit)).toHaveLength(7);
  });

  it('saneC1 lässt kaputte Einträge weg, ohne etwas zu löschen', () => {
    const w = c1Way(wayIn({ c1: C1_RAW }));
    expect(w.c1.checks).toHaveLength(3);
    expect(w.c1.gates).toHaveLength(1);
    expect(w.c1.prod).toHaveLength(1);
    expect(w.c1.place?.n).toBe(24);
    expect(w.empty).toBe(false);
    expect(saneC1({ ...emptyC1(), place: { d: 'x', se: 1, n: 1, skip: [] } }).place).toBeUndefined();
  });

  it('Belegzeilen: sieben Kriterien, Checks je Monat, Kapitelprüfung, Einstufung; kein „% C1“', () => {
    const lines = c1EvidenceLines(c1Way(wayIn({ c1: C1_RAW })));
    expect(lines.map((l) => l.id)).toEqual(['c1:k1', 'c1:k2', 'c1:k3', 'c1:k4', 'c1:k5', 'c1:k6', 'c1:k7', 'chk:2026-07', 'chk:2026-08', 'chk:2026-09', 'gate:1', 'place']);
    const text = c1EvidenceText(lines);
    expect(text).toContain('does not measure speaking, listening or reading');
    expect(text).toContain('[chk:2026-08] C1 check on 2026-08-20 (phone): 21/36');
    expect(text).not.toMatch(/% C1/);
  });

  it('höchstens sechs Check-Monate', () => {
    const checks = Array.from({ length: 9 }, (_, k) => ({ d: `2026-0${k + 1}-10`, f: 'A', inp: 'desk', p: [4, 4, 4, 6], pts: 18, max: 36 }));
    const ids = c1EvidenceLines(c1Way(wayIn({ c1: { ...C1_RAW, checks } }))).filter((l) => l.id.startsWith('chk:'));
    expect(ids.map((l) => l.id)).toEqual(['chk:2026-04', 'chk:2026-05', 'chk:2026-06', 'chk:2026-07', 'chk:2026-08', 'chk:2026-09']);
  });
});

describe('assess@4: Vorlage und Schema', () => {
  it('Kopfzeile, complex, kein Zwischenspeicher, text-json; Liste der offenen Kriterien im Prompt', () => {
    const v = vars();
    const p = assess4.build(v);
    expect(p.split('\n')[0]).toBe('[assess@4]');
    expect(assess4.tier).toBe('complex');
    expect(assess4.cache).toBe(false);
    expect(assess4.verb).toBe('text-json');
    expect(p).toContain(`Open criteria now: ${v.c1.open.join(', ')}.`);
    expect(p).toContain('[c1:k5] K5 exam formats');
    expect(p).toContain('no score, no percentage');
    expect(promptBytes(p)).toBeLessThanOrEqual(PROMPT_MAX_BYTES);
  });

  it('das Beispiel besteht sein eigenes Schema (DE und EN)', () => {
    for (const lang of ['de', 'en'] as const) {
      const v = vars(lang);
      const r = assess4Schema(v).safeParse(structuredClone(assess4Example(v)));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });

  it('c1 darf fehlen oder null sein (dann gilt der feste Satz)', () => {
    const v = vars();
    const rest: Record<string, unknown> = structuredClone(assess4Example(v));
    delete rest.c1;
    expect(assess4Schema(v).safeParse(rest).success).toBe(true);
    expect(assess4Schema(v).safeParse({ ...rest, c1: null }).success).toBe(true);
  });

  it('„ready“ nur bei Etappe; sonst wird es zu „on_track“', () => {
    const v = vars();
    const c1 = { ...assess4Example(v).c1!, status: 'ready' };
    const r = c1VerdictSchema(v).parse(c1);
    expect(r.status).toBe('on_track');
    const stage = { ...v, c1: { ...v.c1, open: [] } };
    expect(c1VerdictSchema(stage).parse({ ...c1, missing: [] }).status).toBe('ready');
    expect(c1VerdictSchema(v).parse({ ...c1, status: 'On Track' }).status).toBe('on_track');
  });

  it('keine Punktzahl oder Prozentzahl im Urteil', () => {
    const v = vars();
    const c1 = assess4Example(v).c1!;
    expect(c1VerdictSchema(v).safeParse({ ...c1, why: 'Du stehst bei 72 % C1, gut gemacht.' }).success).toBe(false);
    expect(c1VerdictSchema(v).safeParse({ ...c1, why: 'Im Check hattest du 24 von 36 Punkte, das reicht noch nicht.' }).success).toBe(false);
  });

  it('fehlende Kriterien: nur offene, ohne Doppel, höchstens drei; ohne Etappe mindestens eines', () => {
    const open = ['k3', 'k5', 'k6', 'k7'];
    expect(cleanMissing([{ crit: 'K5', title: 'a' }, { id: '[c1:k5]', title: 'b' }, { crit: 'k1', title: 'c' }, { crit: 'k3', title: 'd' }, { crit: 'k6', title: 'e' }, { crit: 'k7', title: 'f' }], open)).toEqual([
      { crit: 'k5', title: 'a' },
      { crit: 'k3', title: 'd' },
      { crit: 'k6', title: 'e' },
    ]);
    const v = vars();
    const c1 = assess4Example(v).c1!;
    expect(c1VerdictSchema(v).safeParse({ ...c1, missing: [] }).success).toBe(false);
  });

  it('Belege: unbekannte Kennungen fallen weg, mindestens eine bekannte nötig', () => {
    const v = vars();
    const c1 = assess4Example(v).c1!;
    expect(c1VerdictSchema(v).parse({ ...c1, ev: ['c1:k9', 'chk:2026-09'] }).ev).toEqual(['chk:2026-09']);
    expect(c1VerdictSchema(v).safeParse({ ...c1, ev: ['erfunden'] }).success).toBe(false);
  });

  it('Sprachtreue: englisches Urteil bei deutscher Oberfläche wird abgelehnt', () => {
    const de = vars('de');
    const en = assess4Example(vars('en')).c1!;
    expect(c1VerdictSchema(de).safeParse({ ...en, ev: assess4Example(de).c1!.ev }).success).toBe(false);
  });

  it('feste Antwort des Adapters besteht das Schema (DE/EN); im Fehlermodus erst beim einen Neuversuch', () => {
    for (const lang of ['de', 'en'] as const) {
      const v = vars(lang);
      const prompt = assess4.build(v);
      const out = JSON.parse(assessReply(prompt)) as { c1?: { ev: string[]; missing: Array<{ crit: string }> } };
      const r = assess4Schema(v).safeParse(out);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      expect(out.c1?.ev[0]).toMatch(/^c1:k[1-7]$/);
      expect(out.c1?.missing.every((m) => v.c1.open.includes(m.crit))).toBe(true);
    }
    const v = vars();
    const prompt = assess4.build(v);
    setAssessBad(true);
    expect(assess4Schema(v).safeParse(JSON.parse(assessReply(prompt))).success).toBe(false);
    expect(assess4Schema(v).safeParse(JSON.parse(assessReply(`${prompt}\nYour previous reply did not match the required format`))).success).toBe(true);
  });
});

describe('app/assess: Feld c1 lesen und schreiben', () => {
  it('liest c1 tolerant, schreibt es immer (null wenn nicht da); Datenbank-Schema erlaubt es', () => {
    const c1 = { status: 'on_track', why: 'Gut unterwegs.', missing: [{ crit: 'k4', title: 'Mehr Wörter' }], ev: ['c1:k4'] };
    const d = readAssessData({ cefr: 'B2', c1 });
    expect(d.c1).toMatchObject({ status: 'on_track', missing: [{ crit: 'k4' }] });
    expect(fullData(readAssessData({})).c1).toBeNull();
    expect(readAssessData({ c1: { status: 'erfunden' } }).c1).toBeNull();
    expect(assessDataSchema.safeParse({ c1 }).success).toBe(true);
    expect(assessDataSchema.safeParse({ c1: null }).success).toBe(true);
  });
});
