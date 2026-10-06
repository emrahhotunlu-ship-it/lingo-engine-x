import { expect } from 'vitest';
import { addDays, addLocalDays, dayKey } from '../../src/domain/date';
import { addError as addErrorReal, errorsOf, REVIEW_DAYS, reviewError as reviewErrorReal, type ErrorEntry } from '../../src/domain/grammar/errors';
import { canIntroduce, dueErrorCount, introTopic, pathTopics } from '../../src/domain/grammar/path';
import { fehlersaetzeDue } from '../../src/domain/metrics';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { mulberry32 } from '../../src/domain/random';
import { buildUnitStored, unitStepArgs } from '../../src/domain/unit/plan';
import { dowOf } from '../../src/domain/unit/planFor';
import { INTRO_BLOCK_ERRORS } from '../../src/domain/grammar/path';

// Schlangen-Simulation (Lernplattform 2.0 §2.3 „Durchsatz“, §4.9, §10.4 P4): Trägt die Fehlerschlange? 60 Lerntage, Fehlerquote 30 % und 50 %,
// Sonntage nach Plan (Schritt 4 mit Grenze 3), Boxen 1/3/9, echter Tagesplan (`buildUnitStored` mit rv 2), echte Auswahl (`dueFehlersaetze`),
// echte Zählung der Bremse (`dueErrorCount`, `canIntroduce`). Regeln der Schlange:
//  - „heute“: die echten `addError`/`reviewError` aus `domain/grammar/errors` (jeder Satz einzeln, falsch = Box 0);
//  - „P2“: die Regeln aus §5.7 (ein offener Eintrag je Muster, falsch = eine Box zurück), hier als dünne Hülle um die echten Funktionen.
//    Im P4-Nachtrag wird die Hülle durch die echten Funktionen von P2 ersetzt (`P2_REAL` unten).
// Abnahme: An mindestens 80 % der Tage sind weniger als 10 Grammatikfehler fällig, und mindestens 1 neues Thema je 6 Lerntage ist möglich.

type Doc = Record<string, unknown>;
type NewErr = { q: string; given: string; ans: string; t: number; src: string; pat: string };
export type Rules = {
  add(list: readonly ErrorEntry[], e: NewErr): readonly ErrorEntry[];
  review(list: readonly ErrorEntry[], t: number, r: { ok: boolean; given: string; grade: 1 | 3; t: number }): ErrorEntry[] | null;
};

export const CURRENT: Rules = {
  add: (list, e) => addErrorReal(list, e),
  review: (list, t, r) => reviewErrorReal(list, t, r),
};

/** §5.7 in einer Hülle um die echten Funktionen. */
export const P2_RULES: Rules = {
  add(list, e) {
    const open = list.findIndex((x) => x.done !== true && x.pat === e.pat);
    if (open >= 0) {
      const x = list[open]!;
      const more = [...(Array.isArray(x.more) ? (x.more as unknown[]) : []), { q: e.q, given: e.given, ans: e.ans, t: e.t }].slice(-3);
      const out = [...list];
      out[open] = { ...x, box: 0, due: addLocalDays(e.t, 1), more };
      return out;
    }
    const out = [...addErrorReal(list, e)];
    const idx = out.findIndex((x) => x.t === e.t && x.q === e.q);
    if (idx >= 0) out[idx] = { ...out[idx]!, pat: e.pat };
    return out;
  },
  review(list, t, r) {
    const before = typeof list.find((x) => x.t === t)?.box === 'number' ? (list.find((x) => x.t === t)!.box as number) : 0;
    const out = reviewErrorReal(list, t, r);
    if (!out) return out;
    const idx = out.findIndex((x) => x.t === t);
    const e = out[idx]!;
    const rh = [...(Array.isArray(e.rh) ? (e.rh as unknown[]) : []), [r.t, before, r.ok ? 1 : 0]].slice(-6);
    // Falsch = eine Box zurück; der Abstand folgt der neuen Box (Box 0: 1 Tag, Box 1: 3 Tage, Box 2: 9 Tage).
    const back = Math.max(0, before - 1);
    out[idx] = { ...e, rh, ...(r.ok ? {} : { box: back, due: addLocalDays(r.t, REVIEW_DAYS[back]!) }) };
    return out;
  },
};

// Im P4-Nachtrag: P2_REAL = die echten `addError(…, pat)` und `reviewError` aus P2 Stufe 1 (siehe stand.md).
export const P2_REAL: Rules | null = null;

const PATH = pathTopics();
const TOPICS16 = PATH.slice(0, 16);
const PATTERNS = TOPICS16.flatMap((t) => [0, 1, 2].map((k) => ({ topic: t, id: `${t.slice(0, 4)}.p${k}`.replace('-', '') })));
/** Schwierigkeit je Muster (Zipf): einige Muster fallen oft, die meisten selten – wie in echten Daten. */
const WEIGHT = PATTERNS.map((_, j) => 1 / (j + 1) ** 0.8);
const MEAN_W = WEIGHT.reduce((a, b) => a + b, 0) / WEIGHT.length;

export const DAYS = 60;
/** Annahme aus §2.3 („Durchsatz“): 75 % richtig beim Wiederholen, unabhängig von der Fehlerquote bei neuen Aufgaben. */
export const REVIEW_WRONG = 0.25;
export const START = '2026-07-06'; // Montag, ohne Zeitumstellung im Fenster

export type Result = { dueSeries: number[]; lowShare: number; introductions: number; maxDue: number; avgDue: number; dropped: number; done: number; limitsUsed: number[] };

export function simulate(rules: Rules, wrongRate: number, seed: number): Result {
  const rng = mulberry32(seed);
  const docs = new Map<string, Doc>();
  TOPICS16.forEach((t, k) => docs.set(t, { n: 30, p: 0.7, last: 0, hist: [{ d: addDays(START, -200 + k), ok: 1 }], errors: [] }));
  let counter = 0;
  let low = 0;
  let intro = 0;
  let maxDue = 0;
  let sumDue = 0;
  const dueSeries: number[] = [];
  let dropped = 0;
  const limitsUsed: number[] = [];
  const write = (topic: string, list: readonly ErrorEntry[]): void => void docs.set(topic, { ...(docs.get(topic) ?? {}), errors: list });

  for (let d = 0; d < DAYS; d++) {
    const day = addDays(START, d);
    const now = Date.parse(`${day}T10:00:00+02:00`);
    expect(dayKey(now)).toBe(day);
    const sunday = dowOf(day) === 7;

    // Morgens: Bremse und Zählung wie in der App.
    const dueGrammar = dueErrorCount(docs, now);
    sumDue += dueGrammar;
    dueSeries.push(dueGrammar);
    maxDue = Math.max(maxDue, dueGrammar);
    if (dueGrammar < INTRO_BLOCK_ERRORS) low++;
    if (canIntroduce(docs, day, now).ok) {
      const next = introTopic(docs, day, now);
      if (next) {
        intro++;
        docs.set(next, { n: 4, p: 0.5, last: now, hist: [{ d: day, ok: 1 }], errors: [] });
      }
    }

    // Plan des Tages (rv 2): die Grenze von Schritt 4 aus dem echten Planbau.
    const fixDue = fehlersaetzeDue({ grammarDocs: docs, repairDoc: null, nowMs: now, today: day });
    const plan = buildUnitStored({ day, nowMs: now, week: null, goalMin: 25, review: { goal: 30, due: 27, fresh: 3, repairs: 0 }, fixDue, rv: 2 });
    const limit = plan.duty.includes('ch:u-again') ? (unitStepArgs(plan, 5).limit ?? 0) : 0;

    // Schritt 4: die ältesten fälligen Sätze, einzeln beantwortet.
    const todo = dueFehlersaetze({ grammarDocs: docs, repairDoc: null, nowMs: now, today: day, limit });
    limitsUsed.push(todo.length);
    todo.forEach((f, k) => {
      const ok = rng() >= REVIEW_WRONG;
      const doc = docs.get(f.topic!)!;
      const next = rules.review(errorsOf(doc), f.errorT!, { ok, given: ok ? f.right : 'again wrong', grade: ok ? 3 : 1, t: now + 60_000 + k });
      if (next) write(f.topic!, next);
    });

    // Grammatik-Runde (rv 2: ohne Fehlersätze) bzw. Wochen-Check am Sonntag: neue Antworten, falsche werden zu Fehlersätzen.
    const tasks = sunday ? 5 : 6;
    for (let k = 0; k < tasks; k++) {
      const j = Math.floor(rng() * PATTERNS.length);
      const p = PATTERNS[j]!;
      if (rng() >= Math.min(0.95, (wrongRate * WEIGHT[j]!) / MEAN_W)) continue;
      counter++;
      const doc = docs.get(p.topic)!;
      const list = errorsOf(doc);
      const next = rules.add(list, { q: `We has ${counter} meeting today.`, given: 'has', ans: `We have ${counter} meetings today.`, t: now + 3_600_000 + counter, src: 'review', pat: p.id });
      if (next === list) dropped++;
      else write(p.topic, next);
    }
  }
  let done = 0;
  for (const doc of docs.values()) done += errorsOf(doc).filter((e) => e.done === true).length;
  return { dueSeries, lowShare: low / DAYS, introductions: intro, maxDue, avgDue: sumDue / DAYS, dropped, done, limitsUsed };
}

export const SEEDS = [11, 23, 47];


