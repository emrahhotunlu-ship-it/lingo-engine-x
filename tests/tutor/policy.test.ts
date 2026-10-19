import { describe, expect, it } from 'vitest';
import { chapters, patternById, patternsOf } from '../../src/domain/grammar/patterns';
import type { GrammarTask, GrammarTaskType } from '../../src/domain/learn/types';
import type { LearnerModel, PatternKnow } from '../../src/domain/tutor/learner';
import {
  EXPLAIN_AFTER,
  LESSON_MAX_LINES,
  QUOTA_WINDOW,
  SHIFT_EVERY,
  applyMove,
  decideMove,
  factOf,
  formsFor,
  hintLadder,
  knownPatterns,
  lessonKey,
  levelOf,
  maxHint,
  miniLesson,
  newSession,
  nextTasks,
  quota,
  recordAnswer,
  roundMove,
  whyOf,
  type AnswerFact,
  type Session,
} from '../../src/domain/tutor/policy';
import { proofText, refName, whyText } from '../../src/features/tutor/whyText';

// Zug-Entscheidung der Tutor-Engine (S2/S3): reine Funktionen, deterministisch. Alle Daten sind erfunden.

const DAY = '2026-10-19';
const at = (day: string): number => new Date(`${day}T12:00:00`).getTime();

const know = (pat: string, p: number, extra: Partial<PatternKnow> = {}): PatternKnow => ({
  pat,
  p,
  certainty: 3,
  q28: { n: 0, ok: 0 },
  freeDays: 0,
  lastWrong: null,
  state: p > 0.7 ? 'safe' : p > 0.3 ? 'learning' : 'new',
  ...extra,
});
const model = (ks: PatternKnow[], extra: Partial<LearnerModel> = {}): LearnerModel => ({
  asOf: at(DAY),
  day: DAY,
  patterns: new Map(ks.map((k) => [k.pat, k])),
  uses: new Map(),
  words: new Map(),
  hyps: [],
  pace: {},
  goals: { chapter: null, c1: [], ctx: null },
  ...extra,
});
const task = (key: string, pat: string | null, type: GrammarTaskType = 'gap', extra: Partial<GrammarTask> = {}): GrammarTask => ({
  key,
  topic: 'tp',
  type,
  prompt: type === 'gap' || type === 'transform' ? `We ___ it (${key}).` : `Sentence ${key}.`,
  answer: 'did',
  accepted: [],
  options: type === 'mc' ? ['did', 'do'] : null,
  hint: null,
  expl: { de: null, en: null },
  src: 'seed',
  ref: null,
  errorT: null,
  pat,
  ...extra,
});
const fact = (f: Partial<AnswerFact>): AnswerFact => ({ typed: true, wrong: false, ok: true, fresh: true, pat: 'a', cause: null, blind: false, ...f });
const feed = (s: Session, fs: AnswerFact[]): Session => fs.reduce(recordAnswer, s);

describe('factOf', () => {
  const h0 = { level: 0 as const };
  it('getippt, falsch, Quote ohne Hilfe, Ursache', () => {
    const t = task('k1', 'a');
    expect(factOf({ task: t, verdict: 'wrong', dontKnow: false, help: h0, tj: { v: 'w', h: 'tense' } }, true)).toEqual({ typed: true, wrong: true, ok: false, fresh: true, pat: 'a', cause: 'tense', blind: false });
    expect(factOf({ task: t, verdict: 'near', dontKnow: false, help: h0 }, true).wrong).toBe(false);
    expect(factOf({ task: t, verdict: 'correct', dontKnow: false, help: h0 }, true).ok).toBe(true);
    expect(factOf({ task: t, verdict: 'correct', dontKnow: false, help: h0, firstWrong: 'x' }, true)).toMatchObject({ wrong: false, ok: false });
    expect(factOf({ task: t, verdict: 'correct', dontKnow: true, help: h0 }, false)).toMatchObject({ wrong: true, fresh: false, blind: true });
    expect(factOf({ task: t, verdict: 'correct', dontKnow: true, help: h0, firstWrong: 'x' }, false).blind).toBe(false);
  });
  it('M1: mit Hilfe (Tipp, erster Buchstabe) zählt nicht als „richtig ohne Hilfe“', () => {
    const t = task('k1', 'a');
    expect(factOf({ task: t, verdict: 'correct', dontKnow: false, help: { level: 1 } }, true)).toMatchObject({ wrong: false, ok: false });
    expect(factOf({ task: t, verdict: 'correct', dontKnow: false, help: { level: 2 } }, true).ok).toBe(false);
  });
  it('Auswahl zählt nicht als getippt; c1x nur mit free', () => {
    expect(factOf({ task: task('k', 'a', 'mc'), verdict: 'wrong', dontKnow: false, help: h0 }, true).typed).toBe(false);
    expect(factOf({ task: task('k', 'a', 'meaning'), verdict: 'wrong', dontKnow: false, help: h0 }, true).typed).toBe(false);
    expect(factOf({ task: task('k', 'a', 'gap'), verdict: 'wrong', dontKnow: false, help: h0, c1k: 'kwt' }, true).typed).toBe(false);
    expect(factOf({ task: task('k', 'a', 'gap'), verdict: 'wrong', dontKnow: false, help: h0, c1k: 'kwt', free: true }, true).typed).toBe(true);
  });
});

describe('recordAnswer und quota', () => {
  it('Fenster hält nur die letzten 20 neu gestellten', () => {
    let s = newSession(true);
    for (let i = 0; i < 25; i++) s = recordAnswer(s, fact({ ok: i >= 5 }));
    expect(s.lastNew20).toHaveLength(QUOTA_WINDOW);
    expect(quota(s)).toBe(1);
    s = recordAnswer(s, fact({ fresh: false, ok: false }));
    expect(s.lastNew20).toHaveLength(QUOTA_WINDOW);
    expect(quota(s)).toBe(1);
  });
  it('unter 5 Antworten keine Quote', () => {
    expect(quota(feed(newSession(true), [fact({}), fact({}), fact({}), fact({})]))).toBeNull();
    expect(quota(feed(newSession(true), [fact({}), fact({}), fact({}), fact({}), fact({ ok: false })]))).toBeCloseTo(0.8);
  });
  it('wrongRun zählt nur getippte Antworten, eine richtige getippte setzt zurück', () => {
    let s = feed(newSession(true), [fact({ wrong: true, ok: false }), fact({ wrong: true, ok: false })]);
    expect(s.wrongRun).toBe(2);
    s = recordAnswer(s, fact({ typed: false, wrong: true, ok: false }));
    expect(s.wrongRun).toBe(2);
    s = recordAnswer(s, fact({ typed: false, wrong: false }));
    expect(s.wrongRun).toBe(2);
    s = recordAnswer(s, fact({ wrong: false }));
    expect(s.wrongRun).toBe(0);
  });
  it('S3: „Weiß ich nicht“ ohne Tippversuch verlängert die Serie nicht', () => {
    let s = feed(newSession(true), [fact({ wrong: true, ok: false }), fact({ wrong: true, ok: false })]);
    s = feed(s, [fact({ wrong: true, ok: false, blind: true }), fact({ wrong: true, ok: false, blind: true })]);
    expect(s.wrongRun).toBe(2);
    expect(s.lastNew20).toEqual([false, false, false, false]);
    s = recordAnswer(s, fact({ wrong: true, ok: false }));
    expect(s.wrongRun).toBe(3);
  });
  it('K4: Erfolg nach Mini-Lektion wird beobachtet (nächste Antwort zum Muster)', () => {
    let s = feed(newSession(true), [fact({ wrong: true, cause: 'tense' }), fact({ wrong: true, cause: 'tense' })]);
    s = applyMove(s, { move: 'explain', why: 'supported' });
    expect(s.lessonPat).toBe('a');
    s = recordAnswer(s, fact({ pat: 'b' }));
    expect(s.afterLesson).toEqual({ n: 0, ok: 0 });
    s = recordAnswer(s, fact({ pat: 'a' }));
    expect(s.afterLesson).toEqual({ n: 1, ok: 1 });
    expect(s.lessonPat).toBeNull();
    s = recordAnswer(s, fact({ pat: 'a', ok: false }));
    expect(s.afterLesson).toEqual({ n: 1, ok: 1 });
  });
  it('gleiche Ursache je Muster; Tippfehler und unklar zählen nicht', () => {
    const s = feed(newSession(true), [fact({ wrong: true, cause: 'tense' }), fact({ wrong: true, cause: 'typo' }), fact({ wrong: true, cause: 'unknown' }), fact({ wrong: true, cause: 'tense', pat: 'b' }), fact({ wrong: false, cause: 'tense' })]);
    expect(s.sameCause).toEqual({ 'a|tense': 1, 'b|tense': 1 });
    expect(lessonKey(s)).toBeNull();
  });
});

describe('decideMove', () => {
  const m = model([know('a', 0.3), know('k', 0.9)]);
  const wrong3 = feed(newSession(true), [fact({ wrong: true, ok: false }), fact({ wrong: true, ok: false, pat: 'b' }), fact({ wrong: true, ok: false, pat: 'c' })]);

  it('Rang 1: erster Versuch falsch → hint', () => {
    expect(decideMove(wrong3, m, true).move).toBe('hint');
    expect(applyMove(wrong3, { move: 'hint', why: 'mix' })).toBe(wrong3);
  });
  it('Rang 2: nach 3 getippten Fehlern etwas Bekanntes (nur mit bekanntem Muster und Modell)', () => {
    expect(decideMove(wrong3, m, false)).toEqual({ move: 'win', why: 'known' });
    expect(decideMove(wrong3, null, false).move).not.toBe('win');
    expect(decideMove(wrong3, model([know('a', 0.3), know('n', 0.9, { state: 'new' })]), false).move).not.toBe('win');
    const two = feed(newSession(true), [fact({ wrong: true }), fact({ wrong: true, pat: 'b' })]);
    expect(decideMove(two, m, false).move).toBe('ask');
    expect(applyMove(wrong3, { move: 'win', why: 'known' }).wrongRun).toBe(0);
  });
  it('S3: win höchstens einmal je Runde; noWin → nächste Regel', () => {
    const won = applyMove(wrong3, { move: 'win', why: 'known' });
    expect(won.won).toBe(true);
    const again = feed(won, [fact({ wrong: true }), fact({ wrong: true, pat: 'b' }), fact({ wrong: true, pat: 'c' })]);
    expect(again.wrongRun).toBe(3);
    expect(decideMove(again, m, false).move).toBe('ask');
    expect(decideMove(wrong3, m, false, { noWin: true }).move).toBe('ask');
    expect(newSession(true).won).toBe(false);
  });
  it('S2: Mini-Lektion hat Vorrang vor win (drei Fehler, davon zwei mit derselben Ursache)', () => {
    const s = feed(newSession(true), [fact({ wrong: true, cause: 'tense' }), fact({ wrong: true, pat: 'b' }), fact({ wrong: true, cause: 'tense' })]);
    expect(s.wrongRun).toBe(3);
    expect(decideMove(s, m, false)).toEqual({ move: 'explain', why: 'supported' });
    // Nach der Mini-Lektion (nie zweimal hintereinander) darf win kommen.
    const after = feed(applyMove(s, { move: 'explain', why: 'supported' }), [fact({ wrong: true, cause: 'tense', pat: 'c' }), fact({ wrong: true, cause: 'tense', pat: 'c' })]);
    expect(decideMove(after, m, false).move).toBe('win');
  });
  it('Rang 3: zwei Fehler mit derselben Ursache → explain, nie zweimal hintereinander', () => {
    const s = feed(newSession(true), [fact({ wrong: true, cause: 'tense' }), fact({ wrong: false }), fact({ wrong: true, cause: 'tense' })]);
    expect(EXPLAIN_AFTER).toBe(2);
    expect(decideMove(s, m, false).move).toBe('explain');
    const after = applyMove(s, { move: 'explain', why: 'supported' });
    expect(after.sameCause['a|tense']).toBeUndefined();
    // Gleich danach wieder zwei Fehler an anderer Stelle: kein zweites explain ohne ask dazwischen.
    const again = feed(after, [fact({ wrong: true, cause: 'form', pat: 'b' }), fact({ wrong: true, cause: 'form', pat: 'b', typed: false })]);
    expect(lessonKey(again)).not.toBeNull();
    expect(decideMove(again, m, false).move).not.toBe('explain');
    const asked = applyMove(again, { move: 'ask', why: 'mix' });
    expect(decideMove(asked, m, false).move).toBe('explain');
  });
  it('Stufe: > 85 % → freier, < 75 % → gestützter, höchstens ein Wechsel je 5 Antworten', () => {
    let s = feed(newSession(true), Array.from({ length: 5 }, () => fact({})));
    expect(decideMove(s, m, false)).toEqual({ move: 'ask', why: 'freer' });
    s = applyMove(s, { move: 'ask', why: 'freer' });
    expect(s.shift).toBe(1);
    expect(s.sinceShift).toBe(0);
    for (let i = 0; i < SHIFT_EVERY - 1; i++) {
      s = recordAnswer(s, fact({}));
      expect(decideMove(s, m, false).why).toBe('mix');
    }
    // Schon ganz frei: kein weiterer Schritt nach oben.
    s = recordAnswer(s, fact({}));
    expect(decideMove(s, m, false).why).toBe('mix');
    // Schlechte Quote: gestützter, aber erst wieder nach 5 Antworten.
    let w = feed(newSession(true), [fact({}), fact({ ok: false }), fact({ ok: false }), fact({}), fact({})]);
    expect(decideMove(w, m, false)).toEqual({ move: 'ask', why: 'supported' });
    w = applyMove(w, { move: 'ask', why: 'supported' });
    expect(w.shift).toBe(-1);
    w = feed(w, Array.from({ length: SHIFT_EVERY }, () => fact({ ok: false })));
    expect(decideMove(w, m, false).why).toBe('mix');
  });
  it('Quote zählt nur neu gestellte Aufgaben', () => {
    const s = feed(newSession(true), Array.from({ length: 8 }, () => fact({ fresh: false })));
    expect(quota(s)).toBeNull();
    expect(decideMove(s, m, false).why).toBe('mix');
  });
  it('deterministisch', () => {
    const s = feed(newSession(false), [fact({ wrong: true, cause: 'x' }), fact({ ok: false }), fact({})]);
    expect(decideMove(s, m, false)).toEqual(decideMove(s, m, false));
  });
});

describe('Formstufen', () => {
  it('levelOf und formsFor mit Verschiebung (geklemmt)', () => {
    expect([levelOf(0.1), levelOf(0.4), levelOf(0.7), levelOf(0.71)]).toEqual([0, 1, 1, 2]);
    expect(formsFor(0.5, 0)).toEqual(['gap', 'find', 'kwt']);
    expect(formsFor(0.5, 1)).toEqual(['correct', 'kwt', 'find']);
    expect(formsFor(0.5, -1)).toEqual(['meaning', 'mc', 'gap']);
    expect(formsFor(0.1, -2)).toEqual(formsFor(0.1, 0));
    expect(formsFor(0.9, 5, 'touch')).toEqual(['kwt', 'find']);
  });
});

describe('nextTasks', () => {
  const m = model([know('a', 0.2, { lastWrong: at('2026-10-10') }), know('b', 0.5, { lastWrong: at('2026-10-18') }), know('k', 0.9)]);
  const pool = [task('a1', 'a', 'mc'), task('a2', 'a', 'gap'), task('b1', 'b', 'gap'), task('b2', 'b', 'find'), task('k1', 'k', 'gap'), task('k2', 'k', 'correct'), task('e1', 'a', 'mc', { errorT: at('2026-10-01') }), task('x1', null, 'gap')];

  it('größter Bedarf zuerst, je Muster eine, Grund und Muster als ref', () => {
    const out = nextTasks(m, pool, 'mix', 's', 3, 0);
    expect(out.map((p) => p.task.key)).toEqual(['a1', 'b1', 'k2']);
    expect(out.every((p) => p.why === 'mix')).toBe(true);
    expect(out.map((p) => p.ref)).toEqual(['a', 'b', 'k']);
  });
  it('due nimmt zuerst das zuletzt falsche Muster', () => {
    expect(nextTasks(m, pool, 'due', 's', 1, 0)[0]?.task.key).toBe('b1');
    expect(nextTasks(m, pool, 'due', 's', 1, 0)[0]?.why).toBe('due');
  });
  it('known: nur p > 0,7, eine Form leichter', () => {
    const out = nextTasks(m, pool, 'known', 's', 2, 0);
    expect(out.map((p) => p.task.key)).toEqual(['k1']);
    expect(out[0]?.why).toBe('known');
  });
  it('nie Fehlersätze, nie ohne Muster, Ausschluss und Profil', () => {
    const all = nextTasks(m, pool, 'mix', 's', 10, 0).map((p) => p.task.key);
    expect(all).not.toContain('e1');
    expect(all).not.toContain('x1');
    expect(nextTasks(m, pool, 'mix', 's', 3, 0, { exclude: new Set(['a1']) }).map((p) => p.task.key)).toContain('a2');
    expect(nextTasks(m, pool, 'mix', 's', 3, 0, { profile: 'touch' }).map((p) => p.task.key)).not.toContain('k2');
    expect(nextTasks(m, pool, 'mix', 's', 3, 0, { avoid: new Set(['a']) }).map((p) => p.ref)).not.toContain('a');
  });
  it('Verschiebung ändert Form und Grund; n ≤ 0 und leerer Pool', () => {
    const fr = nextTasks(m, pool, 'mix', 's', 3, 1);
    expect(fr.every((p) => p.why === 'freer')).toBe(true);
    expect(fr.find((p) => p.ref === 'b')?.task.key).toBe('b2');
    expect(nextTasks(m, pool, 'mix', 's', 3, -1).every((p) => p.why === 'supported')).toBe(true);
    expect(nextTasks(m, pool, 'mix', 's', 0, 0)).toEqual([]);
    expect(nextTasks(m, [], 'mix', 's', 3, 0)).toEqual([]);
  });
  it('deterministisch über den Seed', () => {
    const p2 = [...pool, task('a3', 'a', 'mc'), task('a4', 'a', 'mc')];
    expect(nextTasks(m, p2, 'mix', 'x', 3, 0)).toEqual(nextTasks(m, p2, 'mix', 'x', 3, 0));
  });
});

describe('roundMove', () => {
  const m = model([know('a', 0.5), know('b', 0.5), know('k', 0.9)]);
  const pool = [task('a1', 'a', 'gap'), task('a2', 'a', 'mc'), task('b1', 'b', 'gap'), task('b2', 'b', 'correct'), task('k1', 'k', 'gap')];
  const base = { m, profile: 'keys' as const, seed: 's', pool, seen: new Set<string>(), shift: 0 as const, pat: 'a' };

  it('win: Zahl bleibt gleich, Bekanntes rückt an die nächste Stelle', () => {
    const tasks = [task('a1', 'a'), task('b1', 'b'), task('a9', 'a')];
    const r = roundMove({ ...base, tasks, pos: 1, end: 3, d: { move: 'win', why: 'known' } });
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks.map((t) => t.key)).toEqual(['a1', 'k1', 'a9']);
    expect(r.at).toBe(1);
    expect(r.why).toBe('known');
    expect(r.displaced?.key).toBe('b1');
  });
  it('win ersetzt nie einen Fehlersatz und nie im Wiederholungsteil', () => {
    const err = task('e1', 'b', 'gap', { errorT: at('2026-10-01') });
    const tasks = [task('a1', 'a'), err, task('b1', 'b'), task('r1', 'b')];
    const r = roundMove({ ...base, tasks, pos: 1, end: 3, d: { move: 'win', why: 'known' } });
    expect(r.tasks.map((t) => t.key)).toEqual(['a1', 'k1', 'e1', 'r1']);
    const onlyErr = roundMove({ ...base, tasks: [task('a1', 'a'), err, task('r1', 'b')], pos: 1, end: 2, d: { move: 'win', why: 'known' } });
    expect(onlyErr.at).toBeNull();
    expect(onlyErr.tasks.map((t) => t.key)).toEqual(['a1', 'e1', 'r1']);
    const inRepeat = roundMove({ ...base, tasks, pos: 3, end: 3, d: { move: 'win', why: 'known' } });
    expect(inRepeat.at).toBeNull();
  });
  it('win ohne bekanntes Muster: nichts', () => {
    const r = roundMove({ ...base, m: model([know('a', 0.5)]), tasks: [task('a1', 'a'), task('b1', 'b')], pos: 1, end: 2, d: { move: 'win', why: 'known' } });
    expect(r.at).toBeNull();
  });
  it('explain: nächste Aufgabe dasselbe Muster eine Stufe leichter; nie auf einen Fehlersatz', () => {
    const tasks = [task('a1', 'a'), task('b1', 'b')];
    const r = roundMove({ ...base, tasks, pos: 1, end: 2, d: { move: 'explain', why: 'supported' } });
    expect(r.tasks.map((t) => t.key)).toEqual(['a1', 'a2']);
    expect(r.why).toBe('supported');
    const err = roundMove({ ...base, tasks: [task('a1', 'a'), task('e1', 'b', 'gap', { errorT: 1 })], pos: 1, end: 2, d: { move: 'explain', why: 'supported' } });
    expect(err.at).toBeNull();
  });
  it('ask mit Verschiebung: Form passt nicht → dasselbe Muster in passender Form; passt sie, bleibt alles', () => {
    const tasks = [task('a1', 'a'), task('b1', 'b')];
    const r = roundMove({ ...base, shift: 1, tasks, pos: 1, end: 2, d: { move: 'ask', why: 'freer' } });
    expect(r.tasks.map((t) => t.key)).toEqual(['a1', 'b2']);
    expect(r.why).toBe('freer');
    expect(roundMove({ ...base, tasks, pos: 1, end: 2, d: { move: 'ask', why: 'mix' } }).at).toBeNull();
  });
  it('am Ende der Runde: nichts', () => {
    expect(roundMove({ ...base, tasks: [task('a1', 'a')], pos: 1, end: 1, d: { move: 'win', why: 'known' } }).at).toBeNull();
  });
});

describe('whyOf', () => {
  const hyp = { id: 'h', from: 'a', to: 'b', l1: null, n: 4, days: 3, lastT: 0, state: 'open' as const, ev: [] };
  it('Zug der Sitzung zuerst, ohne Zusatz', () => {
    expect(whyOf(task('k', 'a'), model([know('a', 0.5)], { hyps: [hyp] }), 'known')).toEqual({ code: 'known', pat: 'a', topic: 'tp' });
  });
  it('Fehlersatz mit Tagen (ohne Modell ohne Tage)', () => {
    const t = task('e', 'a', 'gap', { errorT: at('2026-10-16') });
    expect(whyOf(t, model([]))).toMatchObject({ code: 'due', days: 3 });
    expect(whyOf(t, null)).toEqual({ code: 'due', pat: 'a', topic: 'tp' });
  });
  it('S1: der Platz aus selectRound ist der Grund; ohne Platz „gehört zu deiner Runde“', () => {
    for (const slot of ['intro', 'chapter', 'focus', 'need', 'family', 'chosen', 'mix'] as const) expect(whyOf(task('k', 'a', 'gap', { slot }), model([])).code).toBe(slot);
    expect(whyOf(task('k', 'a'), model([])).code).toBe('plan');
    expect(whyOf(task('k', 'a'), null)).toEqual({ code: 'plan', pat: 'a', topic: 'tp' });
  });
  it('S1: Datenbelege nur als Zusatz: Annahme, schwache Quote, Fehler in 14 Tagen', () => {
    const t = task('k', 'a', 'gap', { slot: 'chapter' });
    expect(whyOf(t, model([know('a', 0.5)], { hyps: [hyp] }))).toEqual({ code: 'chapter', pat: 'a', topic: 'tp', extra: { k: 'hyp', n: 4, vs: 'b' } });
    expect(whyOf(t, model([know('a', 0.5, { q28: { n: 9, ok: 4 } })])).extra).toEqual({ k: 'weakQ', n: 9, ok: 4 });
    expect(whyOf(t, model([know('a', 0.5, { q28: { n: 9, ok: 8 }, lastWrong: at('2026-10-18') })])).extra).toEqual({ k: 'weakD', days: 1 });
    expect(whyOf(t, model([know('a', 0.5, { lastWrong: at('2026-09-01') })])).extra).toBeUndefined();
    const e = task('e', 'a', 'gap', { errorT: at('2026-10-16') });
    expect(whyOf(e, model([know('a', 0.5, { q28: { n: 9, ok: 4 } })]))).toMatchObject({ code: 'due', days: 3, extra: { k: 'weakQ' } });
  });
  it('wenig Daten: keine Quote unter 3 Antworten', () => {
    expect(whyOf(task('k', 'a'), model([know('a', 0.5, { q28: { n: 2, ok: 0 } })])).extra).toBeUndefined();
  });
});

describe('whyText und proofText', () => {
  it('jeder Grund ergibt einen Satz in beiden Sprachen, Zahlen nur aus dem Fakt', () => {
    expect(whyText({ code: 'due', pat: 'a', topic: 'tp', days: 3 }, 'de')).toContain('vor 3 Tagen');
    expect(whyText({ code: 'due', pat: 'a', topic: 'tp' }, 'en')).not.toMatch(/\d/);
    expect(whyText({ code: 'known', pat: 'a', topic: 'tp' }, 'de')).toBe('Kurz etwas Bekanntes, dann weiter.');
    for (const code of ['due', 'intro', 'chapter', 'focus', 'need', 'family', 'chosen', 'mix', 'plan', 'known', 'freer', 'supported'] as const)
      for (const lang of ['de', 'en'] as const) {
        const s = whyText({ code, pat: 'a', topic: 'tp' }, lang);
        expect(s.length).toBeGreaterThan(10);
        expect(s).not.toMatch(/\{|\}|undefined/);
      }
  });
  it('S1: Zusatz „Passt dazu“ steht hinter dem Grund, nie als Grund', () => {
    const de = whyText({ code: 'chapter', pat: 'a', topic: 'tp', extra: { k: 'weakQ', n: 9, ok: 4 } }, 'de');
    expect(de).toContain('Passt dazu');
    expect(de).toContain('4 von 9');
    expect(de.indexOf('Passt dazu')).toBeGreaterThan(0);
    expect(whyText({ code: 'chapter', pat: 'a', topic: 'tp', extra: { k: 'weakQ', n: 9, ok: 4 } }, 'en')).toContain('4 of 9');
    for (const extra of [{ k: 'hyp', n: 4, vs: 'b' }, { k: 'weakD', days: 0 }, { k: 'weakD', days: 1 }, { k: 'weakD', days: 5 }] as const)
      for (const lang of ['de', 'en'] as const) expect(whyText({ code: 'plan', pat: 'a', topic: 'tp', extra }, lang)).not.toMatch(/\{|\}|undefined/);
    expect(whyText({ code: 'plan', pat: 'a', topic: 'tp' }, 'de')).not.toContain('Passt dazu');
  });
  it('Gebrauchsmuster und Fortschrittsbeleg (M2: „ohne Hilfe richtig“)', () => {
    expect(refName('use:depend+on', 'de')).toBe('depend on');
    expect(refName('unbekannt', 'en')).toBe('unbekannt');
    expect(proofText('x', { thenOk: 4, thenN: 9, nowOk: 8, nowN: 9, weeks: 3, trend: 'up' }, 'de')).toBe('x: vor 3 Wochen 4 von 9 ohne Hilfe richtig, jetzt 8 von 9.');
    expect(proofText('x', { thenOk: 4, thenN: 9, nowOk: 8, nowN: 9, weeks: 3, trend: 'up' }, 'en')).toBe('x: 3 weeks ago 4 of 9 right without help, now 8 of 9.');
  });
});

describe('miniLesson und Hinweisleiter', () => {
  const real = chapters()
    .flatMap((c) => c.topics)
    .flatMap((tp) => patternsOf(tp)?.patterns ?? [])
    .find((p) => !!p.contrast && p.ex.length > 0);
  it('höchstens 3 Erklärzeilen (Beispiel zählt mit), Kontrast nur mit Beleg', () => {
    expect(real).toBeTruthy();
    if (!real) return;
    for (const lang of ['de', 'en'] as const)
      for (const proof of [null, 'confuse', 'hyp'] as const) {
        const l = miniLesson(real, proof, lang);
        expect(l.lines.length + l.examples.length).toBeLessThanOrEqual(LESSON_MAX_LINES);
        expect(l.lines[0]?.k).toBe('why');
        expect(l.lines.some((x) => x.k === 'contrast')).toBe(proof !== null);
        expect(l.examples).toHaveLength(1);
      }
    expect(patternById(real.id)).not.toBeNull();
  });
  it('S4: die eigene Antwort bleibt (yours vor der Regel, mistake danach); das Beispiel fällt zuerst weg', () => {
    expect(real).toBeTruthy();
    if (!real) return;
    const yours = { k: 'yours' as const, given: 'did', text: 'Du hast „did“ geschrieben.' };
    const a = miniLesson(real, 'confuse', 'de', yours);
    expect(a.lines.map((x) => x.k)).toEqual(['yours', 'why', 'contrast']);
    expect(a.examples).toEqual([]);
    const b = miniLesson(real, null, 'de', yours);
    expect(b.lines.map((x) => x.k)).toEqual(['yours', 'why']);
    expect(b.examples).toHaveLength(1);
    const mistake = { k: 'mistake' as const, bad: 'did', good: 'have done', cause: null };
    expect(miniLesson(real, null, 'en', mistake).lines.map((x) => x.k)).toEqual(['why', 'mistake']);
    expect(miniLesson(real, null, 'en', { k: 'why', text: 'x' }).lines.map((x) => x.k)).toEqual(['why']);
  });
  it('K3: Beispiel aus Besprechung oder Mail zuerst', () => {
    const p = { use: { de: 'Regel.', en: 'Rule.' }, contrast: null, ex: [{ en: 'Small talk.', ctx: 'small' }, { en: 'Per my mail.', ctx: 'mail' }] };
    expect(miniLesson(p as never, null, 'en').examples[0]?.en).toBe('Per my mail.');
    expect(miniLesson({ ...p, ex: [p.ex[0]] } as never, null, 'en').examples[0]?.en).toBe('Small talk.');
  });
  it('Regel in einem Satz', () => {
    const l = miniLesson({ use: { de: 'Erster Satz. Zweiter Satz.', en: 'First one. Second one.' }, ex: [], contrast: null } as never, null, 'en');
    expect(l.lines).toEqual([{ k: 'why', text: 'First one.' }]);
    expect(l.examples).toEqual([]);
  });
  it('erster Buchstabe nur bei Lücken', () => {
    expect(hintLadder(task('g', 'a', 'gap'))).toEqual(['nudge', 'formula', 'firstLetter']);
    expect(maxHint(task('g', 'a', 'gap'))).toBe(3);
    expect(maxHint(task('c', 'a', 'correct'))).toBe(2);
    expect(maxHint(task('m', 'a', 'mc'))).toBe(2);
    expect(maxHint(task('f', 'a', 'find'))).toBe(2);
    expect(maxHint(task('w', 'a', 'gap', { prompt: 'Whole sentence without gap.' }))).toBe(2);
    expect(maxHint(task('t', 'a', 'transform'))).toBe(3);
    // S5: kwt zeigt in der Maske keinen Buchstaben → keine dritte Stufe.
    expect(hintLadder(task('w', 'a', 'kwt', { prompt: 'It ___ late.' }))).toEqual(['nudge', 'formula']);
  });
});

describe('knownPatterns', () => {
  it('nur p > 0,7 und nicht neu, sicherste zuerst', () => {
    const m = model([know('a', 0.71), know('b', 0.95), know('c', 0.7), know('d', 0.9, { state: 'new' })]);
    expect(knownPatterns(m).map((k) => k.pat)).toEqual(['b', 'a']);
  });
});
