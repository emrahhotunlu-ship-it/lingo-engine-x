import { describe, expect, it } from 'vitest';
import { c1Schema, grammarSchema } from '../../src/data/schemas';
import { programChapters } from '../../src/domain/c1/chapters';
import { chooseChapter, chosenChapterOf, C1_LIMITS, programStartedOf, readC1 } from '../../src/domain/c1/c1doc';
import { chapterNow, chapterPlanInput, effectiveChapter, topicStep } from '../../src/domain/c1/cursor';
import { chapterState } from '../../src/domain/c1/state';
import { freezeGrammarDay, isNewTopic } from '../../src/domain/grammar/path';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { nextTt, readTt, ttPassed } from '../../src/domain/grammar/topicTest';
import { grammarWrite } from '../../src/domain/grammar/write';
import { refreezeAllowed, refreezePlan } from '../../src/domain/plan/refreeze';
import { readUnitMeta } from '../../src/domain/plan/unitMeta';
import { answer } from './learnHelpers';

// Kapitel-Arbeit (Rückmeldung 5, `docs/umbau/kapitel-plan.md` K0–K5): Kapitelwahl, Cursor, Tagesplan im Kapitel, Themen-Test, einmaliges Neufestlegen.

type Doc = Record<string, unknown>;
const TODAY = '2026-10-11';
const NOW = Date.parse('2026-10-11T09:00:00+02:00');
const DAY = 86_400_000;
const INTRO_PLAN_OF = (t: string) => patternsOf(t)?.introPlan ?? null;

const pid = (topic: string): string[] => patternsOf(topic)?.patterns.map((p) => p.id) ?? [];

/** Thema: alle Muster sicher (zwei Tage ohne Hilfe). */
function safeDoc(topic: string): Doc {
  const pats: Doc = {};
  for (const id of pid(topic)) pats[id] = { n: 3, c: 3, last: NOW - DAY, h: 0, r: 3, k: 2, dd: ['2026-10-09', '2026-10-10'], i: '2026-09-01', s: '2026-10-10' };
  return { n: 6, c: 6, S: 4, D: 5, last: NOW - DAY, pats };
}

/** Thema: alle Muster eingeführt, aber wackelig (`n` Antworten, davon `c` richtig). */
function shakyDoc(topic: string, n = 1, c = 0, errors = 0): Doc {
  const pats: Doc = {};
  for (const id of pid(topic)) pats[id] = { n, c, last: NOW - DAY, h: 0, r: 0, k: 1, dd: [], i: '2026-10-01' };
  const errs = Array.from({ length: errors }, (_, k) => ({ q: `Satz ${k}`, given: 'x', ans: 'y', t: NOW - 3 * DAY, box: 0, due: NOW - DAY, done: false, last: NOW - 3 * DAY }));
  return { n: n * pid(topic).length, c: c * pid(topic).length, S: 1, D: 6, last: NOW - DAY, pats, errors: errs };
}

const docsOf = (o: Record<string, Doc>) => new Map(Object.entries(o));
const K = programChapters();

describe('effectiveChapter: eine Quelle', () => {
  it('Wahl 1–7 gilt, sonst das abgeleitete Kapitel', () => {
    expect(effectiveChapter(4, 0)).toBe(3);
    expect(effectiveChapter(null, 2)).toBe(2);
    expect(effectiveChapter(undefined, 1)).toBe(1);
    expect(effectiveChapter(0, 1)).toBe(1);
    expect(effectiveChapter(8, 1)).toBe(1);
    expect(effectiveChapter(2.5, 1)).toBe(1);
  });
});

describe('Emrahs Bild: Kapitel 1 offen, 33 Fehlersätze, Passiv in Kapitel 4 begonnen', () => {
  const k1 = K[0]!.topics[0]!;
  const docs = docsOf({ [k1]: shakyDoc(k1, 2, 1, 33), passive: shakyDoc('passive', 1, 0) });
  it('ohne Wahl: „Du bist hier“ und „Als Nächstes“ beide in Kapitel 1', () => {
    const { state, cursor } = chapterNow({ docs, today: TODAY, nowMs: NOW, chosen: null });
    expect(state.current).toBe(0);
    expect(cursor?.chapter).toBe(0);
    expect(state.chapters[0]?.status).toBe('current');
    expect(cursor?.topic).toBe(k1);
  });
  it('mit Wahl Kapitel 4: beide in Kapitel 4, trotz 33 Fehlersätzen nichts gesperrt', () => {
    const { state, cursor } = chapterNow({ docs, today: TODAY, nowMs: NOW, chosen: 4 });
    expect(state.current).toBe(3);
    expect(state.chosen).toBe(true);
    expect(state.chapters[3]?.status).toBe('current');
    expect(state.chapters.filter((c) => c.status === 'current')).toHaveLength(1);
    expect(cursor?.n).toBe(4);
    expect(cursor?.topic).toBe('passive');
    // Nächstes neues Thema im Kapitel ist erreichbar, sobald Passiv geschafft ist (Themen-Test bestanden), trotz 33 Fehlersätzen.
    const docs2 = docsOf({ [k1]: shakyDoc(k1, 2, 1, 33), passive: { ...shakyDoc('passive', 3, 2), tt: { d: '2026-10-10', c: 5, n: 6, ok: true, k: 1 } } });
    const c2 = chapterNow({ docs: docs2, today: TODAY, nowMs: NOW, chosen: 4 }).cursor;
    expect(c2?.topic).toBe(K[3]!.topics[1]);
    expect(c2?.phase).toBe('intro');
  });
});

describe('Gleichheit „Du bist hier“ = „Als Nächstes“ (200 Zufallsstände)', () => {
  it('Cursor-Kapitel = aktuelles Kapitel = einziges Kapitel mit Status „current“', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const all = K.flatMap((c) => c.topics).filter((t) => pid(t).length);
    for (let run = 0; run < 200; run++) {
      const o: Record<string, Doc> = {};
      for (const t of all) {
        const r = rnd();
        if (r < 0.15) o[t] = safeDoc(t);
        else if (r < 0.25) o[t] = shakyDoc(t, Math.floor(rnd() * 5), Math.floor(rnd() * 3), Math.floor(rnd() * 15));
      }
      const chosen = rnd() < 0.5 ? null : 1 + Math.floor(rnd() * 7);
      const { state, cursor } = chapterNow({ docs: docsOf(o), today: TODAY, nowMs: NOW, chosen });
      if (state.current < 0) {
        expect(cursor).toBeNull();
        continue;
      }
      expect(cursor?.chapter).toBe(state.current);
      if (chosen) expect(state.current).toBe(chosen - 1);
      const cur = state.chapters.map((c, k) => (c.status === 'current' ? k : -1)).filter((k) => k >= 0);
      expect(cur.length).toBeLessThanOrEqual(1);
      if (cur.length) expect(cur[0]).toBe(state.current);
      const plan = chapterPlanInput({ docs: docsOf(o), today: TODAY, nowMs: NOW, chosen });
      expect(plan?.n).toBe(state.current + 1);
    }
  });
  it('ohne Wahl unverändert wie bisher (Rückweg)', () => {
    const k1 = K[0]!.topics[0]!;
    const docs = docsOf({ [k1]: shakyDoc(k1) });
    const a = chapterState({ docs, today: TODAY, nowMs: NOW });
    const b = chapterState({ docs, today: TODAY, nowMs: NOW, chosen: null });
    expect(b.current).toBe(a.current);
    expect(b.chapters.map((c) => c.status)).toEqual(a.chapters.map((c) => c.status));
    expect(b.chosen).toBe(false);
  });
});

describe('topicStep: Einführung → Übung → Themen-Test', () => {
  const topic = 'passive';
  it('neu → intro mit dem ersten Einführungsschritt', () => {
    const s = topicStep(topic, undefined, TODAY);
    expect(s.phase).toBe('intro');
    expect(s.pats).toEqual((patternsOf(topic)?.introPlan[0] ?? []).slice(0, 2));
  });
  it('eingeführt und wackelig → practice mit den schwächsten Mustern', () => {
    const s = topicStep(topic, shakyDoc(topic, 1, 0), TODAY);
    expect(s.phase).toBe('practice');
    expect(s.pats.length).toBeGreaterThan(0);
    expect(s.pats.length).toBeLessThanOrEqual(2);
  });
  it('jedes Muster mit 3 Antworten → test; heute nicht bestanden → practice; morgen → test (retry)', () => {
    const d = shakyDoc(topic, 3, 2);
    expect(topicStep(topic, d, TODAY).phase).toBe('test');
    const failed = { ...d, tt: { d: TODAY, c: 3, n: 6, ok: false, k: 1 } };
    expect(topicStep(topic, failed, TODAY).phase).toBe('practice');
    const next = topicStep(topic, failed, '2026-10-12');
    expect(next.phase).toBe('test');
    expect(next.retry).toBe(true);
  });
  it('bestandener Test → Thema geschafft, Cursor geht weiter', () => {
    const d = { ...shakyDoc(topic, 3, 2), tt: { d: TODAY, c: 5, n: 6, ok: true, k: 1 } };
    const c = chapterNow({ docs: docsOf({ passive: d }), today: TODAY, nowMs: NOW, chosen: 4 }).cursor;
    expect(c?.topic).toBe(K[3]!.topics[1]);
  });
  it('„Nächstes Thema trotzdem beginnen“ (`tt.s`) → Cursor überspringt das Thema', () => {
    const d = { ...shakyDoc(topic, 3, 2), tt: { d: '2026-10-10', c: 2, n: 6, ok: false, k: 1, s: TODAY } };
    const c = chapterNow({ docs: docsOf({ passive: d }), today: TODAY, nowMs: NOW, chosen: 4 }).cursor;
    expect(c?.topic).toBe(K[3]!.topics[1]);
  });
});

describe('Themen-Test (K4)', () => {
  it('bestanden ab 5 von 6, höchstens eine falsch; unter 4 Aufgaben nie', () => {
    expect(ttPassed(5, 6)).toBe(true);
    expect(ttPassed(4, 6)).toBe(false);
    expect(ttPassed(4, 5)).toBe(true);
    expect(ttPassed(3, 4)).toBe(true);
    expect(ttPassed(3, 3)).toBe(false);
  });
  it('nextTt: ok bleibt, k zählt, s fällt weg', () => {
    const a = nextTt(null, { day: '2026-10-10', c: 3, n: 6 });
    expect(a).toEqual({ d: '2026-10-10', c: 3, n: 6, ok: false, k: 1 });
    const b = nextTt({ ...a, s: '2026-10-10' }, { day: TODAY, c: 6, n: 6 });
    expect(b).toEqual({ d: TODAY, c: 6, n: 6, ok: true, k: 2 });
    expect(nextTt(b, { day: '2026-10-12', c: 1, n: 6 }).ok).toBe(true);
  });
  it('readTt tolerant: kaputte Werte → null', () => {
    expect(readTt({ tt: 'x' })).toBeNull();
    expect(readTt({ tt: { d: 'gestern' } })).toBeNull();
    expect(readTt({})).toBeNull();
    expect(readTt({ tt: { d: TODAY, c: '2', n: 6, ok: 1, k: 1, s: 'nein' } })).toEqual({ d: TODAY, c: 0, n: 6, ok: false, k: 1 });
  });
  it('Schreibweg: die letzte Testantwort legt `tt` an, andere Felder bleiben', () => {
    const cur: Doc = { id: 'future-perf-cont', p: 0.5, n: 4, c: 3, last: NOW - DAY, hist: [], errors: [], seen: [], seenText: [], recent: [], tt: { d: '2026-10-10', c: 3, n: 6, ok: false, k: 1, s: '2026-10-10' } };
    const w = grammarWrite(cur, answer({ t: NOW, day: TODAY, tt: { c: 5, n: 6 } }));
    expect(w.kind).toBe('update');
    if (w.kind === 'update') expect(w.patch.tt).toEqual({ d: TODAY, c: 5, n: 6, ok: true, k: 2 });
    const plain = grammarWrite(cur, answer({ t: NOW, day: TODAY }));
    if (plain.kind === 'update') expect(plain.patch).not.toHaveProperty('tt');
  });
});

describe('app/c1: Kapitelwahl (nur ergänzend)', () => {
  it('chooseChapter setzt ch und hängt an chh (≤ 20); gleiche Wahl → null', () => {
    let d = readC1({ v: 1 });
    for (let k = 0; k < 25; k++) d = chooseChapter(d, (k % 7) + 1, TODAY) ?? d;
    expect(d.chh).toHaveLength(C1_LIMITS.chh);
    expect(d.ch?.n).toBe(((24 % 7) + 1));
    expect(chooseChapter(d, d.ch!.n, TODAY)).toBeNull();
    expect(chooseChapter(d, 9, TODAY)).toBeNull();
  });
  it('chosenChapterOf und programStartedOf: nur die Wahl ist kein Programmstart', () => {
    expect(chosenChapterOf({ v: 1, ch: { n: 3, d: TODAY } })).toEqual({ n: 3, d: TODAY });
    expect(chosenChapterOf({ v: 1, ch: { n: 0, d: TODAY } })).toBeNull();
    expect(chosenChapterOf(null)).toBeNull();
    expect(programStartedOf({ v: 1, ch: { n: 3, d: TODAY }, chh: [[3, TODAY]] })).toBe(false);
    expect(programStartedOf({ v: 1, bad: ['x'] })).toBe(true);
    expect(programStartedOf(undefined)).toBe(false);
    // Rückweg: ein Dokument ohne Wahl gilt wie bisher als begonnen, auch leer.
    expect(programStartedOf({ v: 1, checks: [], gates: [], prod: [], bad: [] })).toBe(true);
  });
  it('Schemas: alte Dokumente ohne neue Felder gültig; neue Felder gelesen; unbekannte bleiben', () => {
    expect(c1Schema.safeParse({ v: 1 }).success).toBe(true);
    const r = c1Schema.safeParse({ v: 1, ch: { n: 2, d: TODAY, x: 1 }, chh: [[2, TODAY], 'kaputt'] });
    expect(r.success).toBe(true);
    expect(grammarSchema.safeParse({ id: 'passive', n: 1 }).success).toBe(true);
    expect(grammarSchema.safeParse({ id: 'passive', tt: { d: TODAY, c: 5, n: 6, ok: true, k: 1, s: TODAY } }).success).toBe(true);
    expect(readC1({ v: 1, chh: [[2, TODAY], 'kaputt', [9, TODAY]] }).chh).toEqual([[2, TODAY]]);
  });
});

describe('Tagesplan im Kapitel (K3)', () => {
  const k1 = K[0]!.topics[0]!;
  it('Einführung aus dem Kapitel, dazu Kapitel-Thema und eine Wiederholung von außerhalb; gt.ch gesetzt', () => {
    const docs = docsOf({ [k1]: shakyDoc(k1, 3, 2), passive: safeDoc('passive'), 'passive-plus': shakyDoc('passive-plus', 3, 2) });
    const chapter = chapterPlanInput({ docs, today: TODAY, nowMs: NOW, chosen: 4 });
    expect(chapter?.n).toBe(4);
    const { gt } = freezeGrammarDay({ docs, today: TODAY, nowMs: NOW, introPlanOf: INTRO_PLAN_OF, seed: TODAY, chapter });
    expect(gt.ch).toBe(4);
    expect(gt.topics.length).toBeLessThanOrEqual(3);
    // Etwa ein Drittel Wiederholung: ein Thema aus einem anderen Kapitel, das schon begonnen ist.
    const outside = gt.topics.filter((t) => !K[3]!.topics.includes(t));
    expect(outside).toEqual([k1]);
    for (const t of gt.topics) expect(isNewTopic(docs.get(t))).toBe(t === gt.intro);
  });
  it('ohne Kapitel (Schalter aus) unverändert: kein ch', () => {
    const docs = docsOf({ [k1]: shakyDoc(k1, 3, 2) });
    const { gt } = freezeGrammarDay({ docs, today: TODAY, nowMs: NOW, introPlanOf: INTRO_PLAN_OF, seed: TODAY });
    expect(gt).not.toHaveProperty('ch');
  });
  it('höchstens eine Einführung je Tag: heute schon außerhalb eingeführt → keine weitere', () => {
    const intro = { ...shakyDoc(k1, 1, 0), pats: Object.fromEntries(pid(k1).map((id) => [id, { n: 1, c: 0, last: NOW, h: 0, r: 0, k: 1, dd: [], i: TODAY }])) };
    const docs = docsOf({ [k1]: intro });
    const chapter = chapterPlanInput({ docs, today: TODAY, nowMs: NOW, chosen: 4 });
    const { gt } = freezeGrammarDay({ docs, today: TODAY, nowMs: NOW, introPlanOf: INTRO_PLAN_OF, seed: TODAY, chapter });
    expect(gt.intro).toBeNull();
    expect(gt.ch).toBe(4);
  });
  it('unitMeta liest gt.ch nur 1–7 (Rückweg: alte Pläne ohne ch bleiben gültig)', () => {
    const u = (gt: unknown) => ({ v: 1, b: [], goalMin: 25, min: 25, shape: 'normal', gt });
    expect(readUnitMeta(u({ intro: null, pats: [], topics: ['passive'] }))?.gt).toEqual({ intro: null, pats: [], topics: ['passive'] });
    expect(readUnitMeta(u({ intro: null, pats: [], topics: ['passive'], ch: 4 }))?.gt?.ch).toBe(4);
    expect(readUnitMeta(u({ intro: null, pats: [], topics: ['passive'], ch: 12 }))?.gt).not.toHaveProperty('ch');
  });
});

describe('Einmaliges Neufestlegen (Zähltest, kein neu gewürfelter Plan)', () => {
  const gt = { intro: null, pats: [], topics: ['pres-simple-cont'] };
  const ok = { n: 4, gt, step2: { done: false, progress: 0 }, running: false, choseToday: false };
  it('nur unberührt, nur einmal am Tag, nur bei anderem Kapitel', () => {
    expect(refreezeAllowed(ok)).toBe(true);
    expect(refreezeAllowed({ ...ok, choseToday: true })).toBe(false);
    expect(refreezeAllowed({ ...ok, running: true })).toBe(false);
    expect(refreezeAllowed({ ...ok, step2: { done: false, progress: 1 } })).toBe(false);
    expect(refreezeAllowed({ ...ok, step2: { done: true, progress: 0 } })).toBe(false);
    expect(refreezeAllowed({ ...ok, gt: { ...gt, ch: 4 } })).toBe(false);
    expect(refreezeAllowed({ ...ok, gt: null })).toBe(false);
  });
  it('ersetzt nur u.gt/u.ps: Pflichtschritte, Ziel, Blöcke, Fremdfelder bleiben; zweite Wahl am Tag ändert nichts', () => {
    const plan = { v: 1, at: 123, duty: ['a', 'b'], goal: 25, x: 'fremd', u: { v: 1, b: [{ k: 1 }, { k: 2 }], goalMin: 25, rv: 2, gt, ps: { old: 1 }, y: 'fremd' } };
    const ngt = { intro: 'passive', pats: ['p1'], topics: ['passive'], ch: 4 };
    const out = refreezePlan(plan, ngt, { p1: 0 });
    expect(out).toMatchObject({ v: 1, at: 123, duty: ['a', 'b'], goal: 25, x: 'fremd' });
    expect(out?.u).toEqual({ v: 1, b: [{ k: 1 }, { k: 2 }], goalMin: 25, rv: 2, gt: ngt, ps: { p1: 0 }, y: 'fremd' });
    expect(refreezePlan({ v: 1 }, ngt, {})).toBeNull();
    // Zähltest: nach der ersten Wahl (choseToday) und mit gt.ch = Wahl wird nie wieder neu festgelegt.
    let count = 0;
    let cur = { gt: gt as typeof gt & { ch?: number }, choseToday: false };
    for (const n of [4, 4, 5, 2, 4]) {
      if (refreezeAllowed({ ...ok, n, gt: cur.gt, choseToday: cur.choseToday })) {
        count++;
        cur = { gt: { ...cur.gt, ch: n }, choseToday: true };
      } else cur = { ...cur, choseToday: true };
    }
    expect(count).toBe(1);
  });
});
