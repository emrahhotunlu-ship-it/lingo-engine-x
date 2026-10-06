import { describe, expect, it } from 'vitest';
import { freezeGrammarDay, introStepFor, lastIntroDay, PS_MAX, dueErrorCount, canIntroduce, pathTopics } from '../../src/domain/grammar/path';
import { grammarErrorsDue } from '../../src/domain/metrics';
import { addError } from '../../src/domain/grammar/errors';
import { buildUnitStored } from '../../src/domain/unit/plan';
import { addDays } from '../../src/domain/date';

// Das Grammatikthema des Tages ist eingefroren (Lernplattform 2.0 §2.3, Leitsatz 7): gleicher Stand → gleiche Antwort, und im Lauf des Tages
// ändern erledigte oder neue Fehlersätze weder Thema noch Rundenthemen.

type Doc = Record<string, unknown>;
const TODAY = '2026-10-06';
const NOW = Date.parse(`${TODAY}T10:00:00+02:00`);
const PATH = pathTopics();

/** Ein begonnenes Thema (n Antworten, erster Tag `from`). */
const started = (from: string, extra: Doc = {}): Doc => ({ n: 12, p: 0.7, last: NOW - 86_400_000, hist: [{ d: from, ok: 1 }], ...extra });

/** Pfadanfang begonnen, das nächste Thema im Pfad ist neu. Letzte Einführung liegt `ago` Tage zurück. */
function docs(opts: { began?: number; ago?: number; extra?: Record<string, Doc> } = {}): Map<string, Doc> {
  const m = new Map<string, Doc>();
  const began = opts.began ?? 4;
  PATH.slice(0, began).forEach((t, k) => m.set(t, started(addDays(TODAY, -(opts.ago ?? 9) - (began - 1 - k) * 4))));
  for (const [k, v] of Object.entries(opts.extra ?? {})) m.set(k, { ...(m.get(k) ?? {}), ...v });
  return m;
}

/** Ein falscher Satz je Thema, fällig seit gestern. */
function withErrors(m: Map<string, Doc>, topics: readonly string[], per: number): Map<string, Doc> {
  const out = new Map(m);
  let k = 0;
  for (const topic of topics) {
    let list: readonly Record<string, unknown>[] = [];
    for (let i = 0; i < per; i++) {
      k++;
      list = addError(list, { q: `She have went to work ${k}.`, given: 'have went', ans: `She has gone to work ${k}.`, t: NOW - 3 * 86_400_000 - k, src: 'review' });
    }
    out.set(topic, { ...(out.get(topic) ?? started(addDays(TODAY, -30))), errors: list });
  }
  return out;
}

const NO_PLAN = (): string[][] | null => null;
const freeze = (d: Map<string, Doc>, plan: (t: string) => string[][] | null = NO_PLAN) => freezeGrammarDay({ docs: d, today: TODAY, nowMs: NOW, introPlanOf: plan, seed: TODAY });

describe('freezeGrammarDay', () => {
  it('ist für denselben Stand deterministisch', () => {
    const d = docs();
    expect(freeze(d)).toEqual(freeze(d));
    expect(freeze(new Map(d))).toEqual(freeze(d));
  });

  it('nimmt das nächste neue Thema des Pfads, wenn die Bremse frei ist, und bis zu 3 Rundenthemen', () => {
    const { gt } = freeze(docs());
    expect(gt.intro).toBe(PATH[4]);
    expect(gt.topics.length).toBeGreaterThan(0);
    expect(gt.topics.length).toBeLessThanOrEqual(3);
    expect(gt.topics).toContain(gt.intro);
    expect(new Set(gt.topics).size).toBe(gt.topics.length);
    expect(gt.pats).toEqual([]);
  });

  it('Bremse: ab 10 fälligen Grammatikfehlern kein neues Thema; Bremse „kürzlich“ nach einem Tag', () => {
    const blocked = withErrors(docs(), PATH.slice(0, 4), 3);
    expect(dueErrorCount(blocked, NOW)).toBe(12);
    expect(canIntroduce(blocked, TODAY, NOW)).toEqual({ ok: false, reason: 'errors' });
    expect(freeze(blocked).gt.intro).toBeNull();
    expect(freeze(docs({ ago: 1 })).gt.intro).toBeNull();
    expect(freeze(docs({ ago: 3 })).gt.intro).toBe(PATH[4]);
  });

  it('die Bremse zählt dieselbe Zahl wie die Anzeige (grammarErrorsDue)', () => {
    const m = withErrors(docs(), PATH.slice(0, 4), 2);
    expect(dueErrorCount(m, NOW)).toBe(grammarErrorsDue({ grammarDocs: m, nowMs: NOW }));
    expect(dueErrorCount(m, NOW)).toBe(8);
  });

  it('nach einem erledigten oder neuen Fehlersatz im Lauf des Tages bleiben intro und topics gleich', () => {
    const morning = docs();
    const frozen = freeze(morning).gt;
    // Im Lauf des Tages kommen 12 Fehlersätze dazu (die Bremse würde jetzt greifen) …
    const noon = withErrors(morning, PATH.slice(0, 4), 3);
    expect(freeze(noon).gt.intro).toBeNull();
    // … der eingefrorene Plan ändert sich nicht: er wird nur beim Anlegen gerechnet und im Plan gespeichert.
    const plan = buildUnitStored({ day: TODAY, nowMs: NOW, week: null, goalMin: 25, review: { goal: 20, due: 17, fresh: 3, repairs: 0 }, fixDue: 4, ...freeze(morning) });
    expect(plan.u!.gt).toEqual(frozen);
    expect((JSON.parse(JSON.stringify(plan)) as { u: { gt: unknown } }).u.gt).toEqual(frozen);
  });

  it('Muster des Tages: höchstens 2, nie aus einem nicht fälligen Folgeschritt', () => {
    const plan = (t: string): string[][] | null => (t === PATH[4] ? [['a.x', 'a.y'], ['a.z', 'a.w']] : null);
    const { gt, ps } = freeze(docs(), plan);
    expect(gt.pats).toEqual(['a.x', 'a.y']);
    expect(Object.keys(ps)).toEqual(expect.arrayContaining(['a.x', 'a.y']));
    expect(ps['a.z']).toBe(0);
    // Ein Plan mit 3 Mustern im Schritt wird auf 2 gekürzt.
    expect(freeze(docs(), () => [['a.1', 'a.2', 'a.3']]).gt.pats).toHaveLength(2);
  });

  it('Folgeschritt: fällig nach 3 Antworten und 2 richtigen, nicht am selben Tag, belegt den Platz des Tages', () => {
    const plan = (t: string): string[][] | null => (t === PATH[1] ? [['b.one'], ['b.two']] : null);
    const ready = docs({ extra: { [PATH[1]!]: { pats: { 'b.one': { n: 4, c: 3, i: addDays(TODAY, -2) } } } } });
    expect(introStepFor({ docs: ready, today: TODAY, nowMs: NOW, introPlanOf: plan })).toEqual({ topic: PATH[1], pats: ['b.two'], fresh: false });
    const fz = freeze(ready, plan);
    expect(fz.gt.intro).toBe(PATH[1]);
    expect(fz.gt.pats).toEqual(['b.two']);
    // zu wenige richtige
    const thin = docs({ extra: { [PATH[1]!]: { pats: { 'b.one': { n: 4, c: 1, i: addDays(TODAY, -2) } } } } });
    expect(introStepFor({ docs: thin, today: TODAY, nowMs: NOW, introPlanOf: plan })?.topic).toBe(PATH[4]);
    // der vorige Schritt ist von heute
    const sameDay = docs({ extra: { [PATH[1]!]: { pats: { 'b.one': { n: 4, c: 3, i: TODAY } } } } });
    expect(introStepFor({ docs: sameDay, today: TODAY, nowMs: NOW, introPlanOf: plan })).toEqual({ topic: PATH[1], pats: [], fresh: false });
  });

  it('heute schon eingeführt (Grammatik-Reiter): die Runde bleibt beim Thema, ohne Muster und Vortest', () => {
    const d = docs({ extra: { [PATH[4]!]: started(TODAY, { n: 3 }) } });
    expect(introStepFor({ docs: d, today: TODAY, nowMs: NOW, introPlanOf: () => [['c.a']] })).toEqual({ topic: PATH[4], pats: [], fresh: false });
    expect(freeze(d).gt.pats).toEqual([]);
  });

  it('Vortest bestanden: das Thema hält das nächste neue Thema nicht auf', () => {
    const recent = docs({ ago: 1 });
    expect(canIntroduce(recent, TODAY, NOW)).toEqual({ ok: false, reason: 'recent' });
    const lastTopic = PATH[3]!;
    const passed = docs({ ago: 1, extra: { [lastTopic]: { vt: { d: addDays(TODAY, -1), ok: true, pats: ['x.y'] } } } });
    expect(lastIntroDay(passed)).not.toBe(addDays(TODAY, -1));
    expect(canIntroduce(passed, TODAY, NOW).ok).toBe(true);
  });

  it('ohne begonnenes Thema und ohne Musterdatei: erstes Pfadthema, keine Muster', () => {
    const { gt, ps } = freeze(new Map());
    expect(gt.intro).toBe(PATH[0]);
    expect(gt.pats).toEqual([]);
    expect(ps).toEqual({});
  });

  it('ps hat höchstens 24 Einträge, nur Zustände 0 bis 3', () => {
    const many = (t: string): string[][] | null => [Array.from({ length: 2 }, (_, k) => `${t.slice(0, 3)}.p${k}`)].concat(Array.from({ length: 8 }, (_, s) => [`${t.slice(0, 3)}.q${s}`]));
    const { ps } = freeze(docs(), many);
    expect(Object.keys(ps).length).toBeLessThanOrEqual(PS_MAX);
    for (const v of Object.values(ps)) expect([0, 1, 2, 3]).toContain(v);
  });
});
